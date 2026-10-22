import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BiiAnaliseCompleta, IBiiAnaliseRepository } from '../../domain/repositories/bii-analise-repository.interface';
import { EstudoCompleto, IEstudoRepository, NovoEstudo } from '../../domain/repositories/estudo-repository.interface';
import { LIMITE_ESTUDOS_POR_TENANT } from '../../domain/services/estudo';
import {
  AtualizarEstudoUseCase,
  CriarEstudoUseCase,
  ExcluirEstudoUseCase,
  GetEstudoUseCase,
  ListEstudosUseCase,
  MENSAGEM_SOMENTE_LEITURA_ESTUDOS,
} from './estudos.use-cases';

const AGORA = new Date('2026-10-22T12:00:00Z');
const ANALISE_ID = 'a0000000-0000-4000-8000-000000000001';

class AnaliseRepoFake implements Partial<IBiiAnaliseRepository> {
  itens = new Map<string, { tenantId: string; a: BiiAnaliseCompleta }>();
  async buscarPorIdETenant(id: string, tenantId: string) {
    const r = this.itens.get(id);
    return r && r.tenantId === tenantId ? r.a : null;
  }
}

class EstudoRepoFake implements IEstudoRepository {
  itens: (EstudoCompleto & { tenantId: string })[] = [];
  seq = 0;
  async criar(d: NovoEstudo) {
    const e = {
      id: `e-${++this.seq}`,
      tenantId: d.tenantId,
      nome: d.nome,
      enderecoFormatado: d.enderecoFormatado,
      raioMetros: d.raioMetros,
      meses: d.meses,
      situacaoResumo: d.situacaoResumo,
      analiseId: d.analiseId,
      conclusao: d.conclusao,
      resultado: d.resultado,
      createdAt: AGORA,
      updatedAt: AGORA,
    };
    this.itens.push(e);
    return e;
  }
  async listarPorTenant(tenantId: string, limite: number) {
    return this.itens.filter((e) => e.tenantId === tenantId).slice(0, limite);
  }
  async buscarPorIdETenant(id: string, tenantId: string) {
    return this.itens.find((e) => e.id === id && e.tenantId === tenantId) ?? null;
  }
  async contarPorTenant(tenantId: string) {
    return this.itens.filter((e) => e.tenantId === tenantId).length;
  }
  async atualizarTextos(id: string, tenantId: string, _u: string, d: { nome?: string; conclusao?: string | null }) {
    const e = this.itens.find((x) => x.id === id && x.tenantId === tenantId);
    if (!e) return false;
    Object.assign(e, d);
    return true;
  }
  async excluir(id: string, tenantId: string) {
    const antes = this.itens.length;
    this.itens = this.itens.filter((e) => !(e.id === id && e.tenantId === tenantId));
    return this.itens.length < antes;
  }
}

const SNAPSHOT = {
  endereco: { digitado: 'Rua X, 1', formatado: 'Rua X, 1, Vila Ema, São Paulo', lat: -23.59, lng: -46.55, precisao: 'rooftop' },
  parametros: { raioMetros: 1000, meses: 12, de: '2025-07-01', ate: '2026-06-30' },
  resumo: { transacoes: 80, precoM2Mediano: 7000, precoM2P25: 6000, precoM2P75: 8000 },
  concorrentes: { itens: [], resumo: { quantidade: 2, precoM2Mediano: 7500, unidadesTotais: 400 } },
};

const REQ = { tenantId: 'tenant-a', requesterRole: 'Administrador', requesterUserId: 'u-1', impersonadoPor: null };
const ENTRADA = {
  ...REQ,
  analiseId: ANALISE_ID,
  nome: '  Terreno   Vila Ema ',
  conclusao: 'Vale lançar\r\n\r\n\r\ncom 2 dorm.',
  tipologias: [{ descricao: '2 dorm.', areaPrivativa: 36, preco: 239_000 }],
  agora: AGORA,
};

function montar() {
  const analises = new AnaliseRepoFake();
  analises.itens.set(ANALISE_ID, { tenantId: 'tenant-a', a: { id: ANALISE_ID, resultado: SNAPSHOT, createdAt: new Date('2026-10-01T12:00:00Z') } });
  const repo = new EstudoRepoFake();
  return {
    analises,
    repo,
    criar: new CriarEstudoUseCase(repo, analises as unknown as IBiiAnaliseRepository),
    listar: new ListEstudosUseCase(repo),
    abrir: new GetEstudoUseCase(repo),
    atualizar: new AtualizarEstudoUseCase(repo),
    excluir: new ExcluirEstudoUseCase(repo),
  };
}

describe('CriarEstudoUseCase', () => {
  it('cria o snapshot: copia da analise + viabilidade + resumo, textos limpos', async () => {
    const { criar, repo } = montar();
    const r = (await criar.execute(ENTRADA)) as Record<string, any>;
    expect(r.nome).toBe('Terreno Vila Ema');
    expect(r.conclusao).toBe('Vale lançar\n\ncom 2 dorm.');
    expect(r.versao).toBe(1);
    expect(r.analise).toMatchObject({ id: ANALISE_ID, endereco: SNAPSHOT.endereco, criadoEm: '2026-10-01T12:00:00.000Z' });
    expect(r.viabilidade.resultados[0]).toMatchObject({ descricao: '2 dorm.', situacao: 'ok' });
    expect(r.posicionamento[0].concorrentes).toEqual({ classe: 'abaixo', diferencaPercentual: -11.5 });
    expect(r.resumoExecutivo.viabilidade).toMatchObject({ tipologias: 1, ok: 1 });
    expect(repo.itens[0]).toMatchObject({ enderecoFormatado: SNAPSHOT.endereco.formatado, raioMetros: 1000, meses: 12, situacaoResumo: { ok: 1, atencao: 0, fora: 0 } });
  });

  it('analise de OUTRO tenant -> 404 igual a inexistente', async () => {
    const { criar } = montar();
    await expect(criar.execute({ ...ENTRADA, tenantId: 'tenant-b' })).rejects.toThrow(NotFoundException);
    await expect(criar.execute({ ...ENTRADA, analiseId: 'a0000000-0000-4000-8000-000000000999' })).rejects.toThrow('Análise não encontrada.');
  });

  it('impersonacao do Super Usuario -> 403 BII_SOMENTE_LEITURA (antes de ler a analise)', async () => {
    const { criar, repo } = montar();
    const erro = await criar.execute({ ...ENTRADA, impersonadoPor: 'su-1' }).catch((e) => e);
    expect(erro).toBeInstanceOf(ForbiddenException);
    expect(erro.getResponse()).toMatchObject({ code: 'BII_SOMENTE_LEITURA', message: MENSAGEM_SOMENTE_LEITURA_ESTUDOS });
    expect(repo.itens).toHaveLength(0);
  });

  it('so Administrador', async () => {
    const { criar } = montar();
    await expect(criar.execute({ ...ENTRADA, requesterRole: 'Corretor' })).rejects.toThrow(ForbiddenException);
  });

  it('limite de estudos por tenant -> 409', async () => {
    const { criar, repo } = montar();
    repo.contarPorTenant = async () => LIMITE_ESTUDOS_POR_TENANT;
    await expect(criar.execute(ENTRADA)).rejects.toThrow(ConflictException);
  });

  it('nome so com invisiveis -> 400; snapshot em formato estranho -> 400', async () => {
    const { criar, analises } = montar();
    await expect(criar.execute({ ...ENTRADA, nome: '​​​​' })).rejects.toThrow(BadRequestException);
    analises.itens.set(ANALISE_ID, { tenantId: 'tenant-a', a: { id: ANALISE_ID, resultado: { foo: 1 }, createdAt: AGORA } });
    await expect(criar.execute(ENTRADA)).rejects.toThrow('formato');
  });
});

describe('listar / abrir / atualizar / excluir', () => {
  it('isolamento de tenant em todas as operacoes', async () => {
    const { criar, listar, abrir, atualizar, excluir } = montar();
    const e = (await criar.execute(ENTRADA)) as { id: string };
    const B = { ...REQ, tenantId: 'tenant-b' };
    expect(await listar.execute(B)).toEqual([]);
    await expect(abrir.execute({ ...B, id: e.id })).rejects.toThrow(NotFoundException);
    await expect(atualizar.execute({ ...B, id: e.id, nome: 'Outro nome' })).rejects.toThrow(NotFoundException);
    await expect(excluir.execute({ ...B, id: e.id })).rejects.toThrow(NotFoundException);
    expect(await listar.execute(REQ)).toHaveLength(1);
  });

  it('PATCH altera so nome/conclusao e NAO recalcula o snapshot', async () => {
    const { criar, atualizar, repo } = montar();
    const e = (await criar.execute(ENTRADA)) as { id: string };
    const antes = JSON.stringify(repo.itens[0].resultado);
    const r = (await atualizar.execute({ ...REQ, id: e.id, conclusao: null })) as Record<string, unknown>;
    expect(r.conclusao).toBeNull();
    expect(JSON.stringify(repo.itens[0].resultado)).toBe(antes);
    await expect(atualizar.execute({ ...REQ, id: e.id })).rejects.toThrow(BadRequestException);
  });

  it('escrita bloqueada na impersonacao; leitura liberada', async () => {
    const { criar, abrir, atualizar, excluir } = montar();
    const e = (await criar.execute(ENTRADA)) as { id: string };
    const SU = { ...REQ, impersonadoPor: 'su-1' };
    await expect(abrir.execute({ ...SU, id: e.id })).resolves.toMatchObject({ id: e.id });
    await expect(atualizar.execute({ ...SU, id: e.id, nome: 'Novo nome' })).rejects.toThrow(ForbiddenException);
    await expect(excluir.execute({ ...SU, id: e.id })).rejects.toThrow(ForbiddenException);
  });

  it('lista com situacao resumida', async () => {
    const { criar, listar } = montar();
    await criar.execute(ENTRADA);
    expect((await listar.execute(REQ))[0]).toMatchObject({ nome: 'Terreno Vila Ema', endereco: SNAPSHOT.endereco.formatado, situacao: { ok: 1, atencao: 0, fora: 0 } });
  });
});
