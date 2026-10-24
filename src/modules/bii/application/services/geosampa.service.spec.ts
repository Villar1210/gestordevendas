import { ConflictException } from '@nestjs/common';
import { GEOSAMPA_PAGINA, GeoSampaService, MENSAGEM_SEM_BASE } from './geosampa.service';
import { CamadaGeoSampa, FeatureGeoSampa, GeoSampaIndisponivelError, IGeoSampaWfs } from '../../domain/ports/geosampa-wfs.interface';
import { IGeoSampaRepository, QuadraFiscal } from '../../domain/repositories/geosampa-repository.interface';
import { LoteFiscal } from '../../domain/services/geosampa';

const quadrado = (x: number, y: number, d = 0.001) => ({
  type: 'Polygon',
  coordinates: [[[x, y], [x + d, y], [x + d, y + d], [x, y + d], [x, y]]],
});

function quadraF(setor: string, quadra: string, x: number): FeatureGeoSampa {
  return { properties: { cd_setor_fiscal: setor, cd_quadra_fiscal: quadra, cd_tipo_quadra: 'F' }, geometry: quadrado(x, -23.59) };
}
function loteF(setor: string, quadra: string, lote: string, x: number): FeatureGeoSampa {
  return {
    properties: { cd_setor_fiscal: setor, cd_quadra_fiscal: quadra, cd_lote: lote, cd_condominio: '00', cd_tipo_lote: 'F', tx_situ_lote: 'ATIVO' },
    geometry: quadrado(x, -23.59, 0.0002),
  };
}

class WfsFake implements IGeoSampaWfs {
  falhasRestantes = 0;
  pedidos: Array<{ camada: CamadaGeoSampa; inicio: number }> = [];
  constructor(private readonly dados: Record<CamadaGeoSampa, FeatureGeoSampa[]>) {}
  async contar(c: CamadaGeoSampa) {
    return this.dados[c].length;
  }
  async pagina(c: CamadaGeoSampa, inicio: number, qtd: number) {
    this.pedidos.push({ camada: c, inicio });
    if (this.falhasRestantes > 0) {
      this.falhasRestantes--;
      throw new GeoSampaIndisponivelError('HTTP 503');
    }
    return this.dados[c].slice(inicio, inicio + qtd);
  }
}

class RepoFake implements IGeoSampaRepository {
  quadras = new Map<string, QuadraFiscal>();
  lotes = new Map<string, LoteFiscal>();
  localizados: Array<{ setor: string; importacaoId?: string }> = [];
  async gravarQuadras(q: QuadraFiscal[]) {
    q.forEach((x) => this.quadras.set(x.setor + x.quadra, x));
    return q.length;
  }
  async gravarLotes(l: LoteFiscal[]) {
    l.forEach((x) => this.lotes.set(x.setor + x.quadra + x.lote + x.condominio, x));
    return l.length;
  }
  async contar() {
    return { quadras: this.quadras.size, lotes: this.lotes.size, atualizadoEm: null };
  }
  async setoresDoItbi() {
    return ['160', '148'];
  }
  async localizarSetor(setor: string, importacaoId?: string) {
    this.localizados.push({ setor, importacaoId });
    return { porLote: 2, porQuadra: 5 };
  }
  async coberturaPorPrecisao() {
    return { total: 0, lote: 0, quadra: 0, endereco: 0, semLocal: 0 };
  }
}

function montar(dados?: Partial<Record<CamadaGeoSampa, FeatureGeoSampa[]>>) {
  const wfs = new WfsFake({ quadra_fiscal: dados?.quadra_fiscal ?? [], lote_cidadao: dados?.lote_cidadao ?? [] });
  const repo = new RepoFake();
  const svc = new GeoSampaService(wfs, repo);
  svc.esperaEntreTentativasMs = 1;
  return { wfs, repo, svc };
}

describe('GeoSampaService', () => {
  it('atualizar: junta subquadras da mesma quadra, grava lotes e localiza todos os setores', async () => {
    const { repo, svc } = montar({
      quadra_fiscal: [quadraF('160', '177', -46.55), quadraF('160', '177', -46.549), quadraF('148', '063', -46.6)],
      lote_cidadao: [loteF('148', '063', '0024', -46.6), loteF('148', '063', '0025', -46.5998)],
    });
    await svc.iniciar('atualizar');
    await svc.aguardar();
    const st = svc.status()!;
    expect(st.status).toBe('concluida');
    expect(repo.quadras.size).toBe(2);
    // centro das 2 subquadras (lado a lado): no meio delas
    expect(repo.quadras.get('160177')!.lng).toBeCloseTo(-46.549, 6);
    expect(repo.lotes.size).toBe(2);
    expect(st.localizacao).toEqual({ setores: 2, setoresFeitos: 2, porLote: 4, porQuadra: 10 });
  });

  it('pagina ate acabar e tenta de novo quando o GeoSampa falha', async () => {
    const muitas = Array.from({ length: GEOSAMPA_PAGINA + 5 }, (_, i) =>
      quadraF(String(100 + (i % 200)).padStart(3, '0'), String(i % 999).padStart(3, '0'), -46.6 + (i % 50) * 0.001),
    );
    const { wfs, svc } = montar({ quadra_fiscal: muitas });
    wfs.falhasRestantes = 2;
    await svc.iniciar('atualizar');
    await svc.aguardar();
    expect(svc.status()!.status).toBe('concluida');
    expect(svc.status()!.quadras.lidas).toBe(GEOSAMPA_PAGINA + 5);
    expect(wfs.pedidos.filter((p) => p.camada === 'quadra_fiscal').map((p) => p.inicio)).toEqual([0, 0, 0, GEOSAMPA_PAGINA]);
  });

  it('3 falhas seguidas encerram com erro amigavel (o gravado fica)', async () => {
    const { wfs, svc } = montar({ quadra_fiscal: [quadraF('160', '177', -46.55)] });
    wfs.falhasRestantes = 10;
    await svc.iniciar('atualizar');
    await svc.aguardar();
    expect(svc.status()).toMatchObject({ status: 'erro', etapa: 'quadras' });
    expect(svc.status()!.mensagemErro).toContain('não respondeu');
  });

  it('um job por vez; localizar sem base baixada e recusado', async () => {
    const { svc } = montar({ quadra_fiscal: [quadraF('160', '177', -46.55)] });
    await expect(svc.iniciar('localizar')).rejects.toThrow(MENSAGEM_SEM_BASE);
    const p = svc.iniciar('atualizar');
    await expect(svc.iniciar('atualizar')).rejects.toBeInstanceOf(ConflictException);
    await p;
    await svc.aguardar();
    // agora ha base: localizar aceita
    await svc.iniciar('localizar');
    await svc.aguardar();
    expect(svc.status()!.modo).toBe('localizar');
  });

  it('importacao nova: localiza so as guias dela, silencioso sem base', async () => {
    const { repo, svc } = montar();
    await svc.localizarImportacao('imp-1');
    expect(repo.localizados).toEqual([]);
    repo.quadras.set('160177', { setor: '160', quadra: '177', lat: -23.5, lng: -46.5 });
    await svc.localizarImportacao('imp-1');
    expect(repo.localizados).toEqual([
      { setor: '160', importacaoId: 'imp-1' },
      { setor: '148', importacaoId: 'imp-1' },
    ]);
  });
});
