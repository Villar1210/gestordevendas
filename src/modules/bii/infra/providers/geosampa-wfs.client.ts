// src/modules/bii/infra/providers/geosampa-wfs.client.ts
// Cliente do WFS publico do GeoSampa (Prefeitura de SP). Host FIXO no codigo
// (nunca vem da requisicao nem do .env): o servidor so fala com a Prefeitura.
// Pede as feicoes ja em WGS84 (srsName=EPSG:4326), so os campos usados
// (propertyName) e ordenadas por cd_identificador (paginacao estavel).
// Resposta com teto de tamanho, timeout e sem seguir redirect.
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  CamadaGeoSampa,
  FeatureGeoSampa,
  GeoSampaIndisponivelError,
  IGeoSampaWfs,
} from '../../domain/ports/geosampa-wfs.interface';

export const GEOSAMPA_WFS_URL = 'https://wfs.geosampa.prefeitura.sp.gov.br/geoserver/geoportal/wfs';
export const GEOSAMPA_TIMEOUT_MS = 90_000;
export const GEOSAMPA_MAX_BYTES = 80 * 1024 * 1024;
export const GEOSAMPA_OPCOES = Symbol('GEOSAMPA_OPCOES');

const CAMPOS: Record<CamadaGeoSampa, string[]> = {
  quadra_fiscal: ['cd_setor_fiscal', 'cd_quadra_fiscal', 'cd_tipo_quadra'],
  lote_cidadao: ['cd_setor_fiscal', 'cd_quadra_fiscal', 'cd_lote', 'cd_condominio', 'cd_tipo_lote', 'tx_situ_lote'],
};
// nome da coluna de geometria nas duas camadas (GeoServer devolve no GeoJSON)
const GEOMETRIA = 'ge_poligono';

export function montarUrlGeoSampa(
  camada: CamadaGeoSampa,
  p: { hits: true } | { inicio: number; quantidade: number; comGeometria?: boolean },
): string {
  const q = new URLSearchParams({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: `geoportal:${camada}`,
  });
  if ('hits' in p) {
    q.set('resultType', 'hits');
  } else {
    q.set('outputFormat', 'application/json');
    q.set('srsName', 'EPSG:4326');
    q.set('sortBy', 'cd_identificador');
    q.set('startIndex', String(Math.max(0, Math.floor(p.inicio))));
    q.set('count', String(Math.min(30_000, Math.max(1, Math.floor(p.quantidade)))));
    const campos = p.comGeometria === false ? CAMPOS[camada] : [...CAMPOS[camada], GEOMETRIA];
    q.set('propertyName', campos.join(','));
  }
  return `${GEOSAMPA_WFS_URL}?${q.toString()}`;
}

export function lerTotalHits(xml: string): number | null {
  const m = /numberMatched="(\d+)"/.exec(xml);
  return m ? Number(m[1]) : null;
}

interface OpcoesGeoSampa {
  fetch: typeof fetch;
  timeoutMs: number;
}

@Injectable()
export class GeoSampaWfsClient implements IGeoSampaWfs {
  private readonly logger = new Logger(GeoSampaWfsClient.name);
  private readonly opcoes: OpcoesGeoSampa;
  // a geometria pedida por nome pode nao existir numa versao futura da
  // camada: na 1a recusa (400) tenta uma vez sem propertyName
  private semFiltroCampos = new Set<CamadaGeoSampa>();

  constructor(@Optional() @Inject(GEOSAMPA_OPCOES) opcoes?: Partial<OpcoesGeoSampa>) {
    this.opcoes = {
      fetch: opcoes?.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args)),
      timeoutMs: opcoes?.timeoutMs ?? GEOSAMPA_TIMEOUT_MS,
    };
  }

  private async baixarTexto(url: string, signal?: AbortSignal): Promise<{ status: number; texto: string }> {
    const sinais = [AbortSignal.timeout(this.opcoes.timeoutMs)];
    if (signal) sinais.push(signal);
    let resposta: Response;
    try {
      resposta = await this.opcoes.fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json, text/xml', 'User-Agent': 'gestordevendas-bii/1.0' },
        redirect: 'error',
        signal: AbortSignal.any(sinais),
      });
    } catch (erro) {
      if (signal?.aborted) throw erro;
      const motivo = (erro as Error)?.name === 'TimeoutError' ? 'timeout' : 'falha de rede';
      this.logger.warn(`GeoSampa: ${motivo}`);
      throw new GeoSampaIndisponivelError(motivo);
    }
    const declarado = Number(resposta.headers.get('content-length') ?? '0');
    if (declarado > GEOSAMPA_MAX_BYTES) throw new GeoSampaIndisponivelError('resposta grande demais');
    // le em partes contando os bytes (o content-length pode faltar ou mentir)
    const leitor = resposta.body?.getReader();
    if (!leitor) return { status: resposta.status, texto: '' };
    const partes: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.byteLength;
      if (total > GEOSAMPA_MAX_BYTES) {
        await leitor.cancel().catch(() => undefined);
        throw new GeoSampaIndisponivelError('resposta grande demais');
      }
      partes.push(value);
    }
    return { status: resposta.status, texto: Buffer.concat(partes).toString('utf8') };
  }

  async contar(camada: CamadaGeoSampa, signal?: AbortSignal): Promise<number> {
    const { status, texto } = await this.baixarTexto(montarUrlGeoSampa(camada, { hits: true }), signal);
    if (status !== 200) throw new GeoSampaIndisponivelError(`HTTP ${status}`);
    const n = lerTotalHits(texto);
    if (n === null) throw new GeoSampaIndisponivelError('contagem ausente');
    return n;
  }

  async pagina(camada: CamadaGeoSampa, inicio: number, quantidade: number, signal?: AbortSignal): Promise<FeatureGeoSampa[]> {
    const pedir = async (comFiltro: boolean) =>
      this.baixarTexto(
        comFiltro
          ? montarUrlGeoSampa(camada, { inicio, quantidade })
          : montarUrlGeoSampa(camada, { inicio, quantidade }).replace(/&propertyName=[^&]*/, ''),
        signal,
      );
    let r = await pedir(!this.semFiltroCampos.has(camada));
    if (r.status === 400 && !this.semFiltroCampos.has(camada)) {
      this.semFiltroCampos.add(camada);
      this.logger.warn(`GeoSampa: ${camada} recusou propertyName; seguindo sem filtro de campos`);
      r = await pedir(false);
    }
    if (r.status !== 200) throw new GeoSampaIndisponivelError(`HTTP ${r.status}`);
    let corpo: unknown;
    try {
      corpo = JSON.parse(r.texto);
    } catch {
      throw new GeoSampaIndisponivelError('resposta invalida');
    }
    const features = (corpo as { features?: unknown })?.features;
    if (!Array.isArray(features)) throw new GeoSampaIndisponivelError('resposta sem features');
    return features as FeatureGeoSampa[];
  }
}
