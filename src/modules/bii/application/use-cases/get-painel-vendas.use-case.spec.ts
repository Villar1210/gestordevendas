// GetPainelVendasUseCase com repositorio FAKE (em memoria): permissao,
// validacao de periodo, escolha do pipeline padrao, periodo anterior e
// montagem da resposta do contrato.
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GetPainelVendasUseCase } from './get-painel-vendas.use-case';
import {
  CardCriadoRow,
  EventoEntradaRow,
  FiltroPainel,
  IdNome,
  IPainelVendasRepository,
} from '../../domain/repositories/painel-vendas-repository.interface';

class FakeRepo implements IPainelVendasRepository {
  pipelines: IdNome[] = [
    { id: 'p-antigo', nome: 'Vendas' },
    { id: 'p-novo', nome: 'Locacao' },
  ];
  etapas: Record<string, IdNome[]> = {
    'p-antigo': [
      { id: 's1', nome: 'Em Atendimento' },
      { id: 'sr', nome: 'Repique' },
      { id: 's2', nome: 'Fechamento' },
    ],
  };
  cards: (CardCriadoRow & { pipelineId: string; value: number })[] = [];
  eventos: (EventoEntradaRow & { pipelineId: string })[] = [];
  inicio: Date | null = null;
  chamadasCriados: FiltroPainel[] = [];

  async listarPipelines() {
    return this.pipelines;
  }
  async listarEtapas(_t: string, pipelineId: string) {
    return this.etapas[pipelineId] ?? [];
  }
  async listarCorretores() {
    return [{ id: 'u1', nome: 'Ana' }];
  }
  async listarOrigens() {
    return ['manual'];
  }
  async buscarInicioHistorico() {
    return this.inicio;
  }
  private casa(f: FiltroPainel, c: { ownerId: string | null; origem: string }) {
    return (!f.corretorId || c.ownerId === f.corretorId) && (!f.origem || c.origem === f.origem);
  }
  async listarCardsCriados(f: FiltroPainel) {
    this.chamadasCriados.push(f);
    return this.cards.filter(
      (c) => c.pipelineId === f.pipelineId && c.createdAt >= f.inicio && c.createdAt < f.fimExclusivo && this.casa(f, c),
    );
  }
  async listarEventosEntrada(f: FiltroPainel) {
    return this.eventos.filter(
      (e) => e.pipelineId === f.pipelineId && e.ocorridoEm >= f.inicio && e.ocorridoEm < f.fimExclusivo && this.casa(f, e.card),
    );
  }
}

const d = (m: number, dia: number, h = 12) => new Date(2026, m - 1, dia, h);

function semear(repo: FakeRepo) {
  const card = (id: string, createdAt: Date, ownerId: string | null, value = 0, origem = 'manual') => {
    repo.cards.push({ cardId: id, ownerId, origem, createdAt, pipelineId: 'p-antigo', value });
    return { ownerId, origem, value, createdAt };
  };
  const a = card('a', d(7, 1), 'u1', 250000);
  const b = card('b', d(7, 2), 'u1');
  card('c', d(6, 15), null); // periodo anterior
  repo.eventos.push(
    { cardId: 'a', toStageId: 's1', toStageNome: 'Em Atendimento', motivoRepique: null, ocorridoEm: d(7, 1), card: a, pipelineId: 'p-antigo' },
    { cardId: 'a', toStageId: 's2', toStageNome: 'Fechamento', motivoRepique: null, ocorridoEm: d(7, 31, 23), card: a, pipelineId: 'p-antigo' },
    { cardId: 'b', toStageId: 'sr', toStageNome: 'Repique', motivoRepique: 'PRECO', ocorridoEm: d(7, 10), card: b, pipelineId: 'p-antigo' },
    // fora do periodo (1o de agosto) - "ate" inclusivo so ate 31/07 23:59:59.999
    { cardId: 'b', toStageId: 's2', toStageNome: 'Fechamento', motivoRepique: null, ocorridoEm: new Date(2026, 7, 1, 0, 0, 0, 0), card: b, pipelineId: 'p-antigo' },
    // outro pipeline
    { cardId: 'z', toStageId: 'sx', toStageNome: 'Fechamento', motivoRepique: null, ocorridoEm: d(7, 5), card: a, pipelineId: 'p-novo' },
  );
}

describe('GetPainelVendasUseCase', () => {
  const base = { tenantId: 't-1', requesterRole: 'Administrador', de: d(7, 1, 0), ate: d(7, 31, 0) };

  it('nao-Administrador -> 403 (checagem no proprio use case)', async () => {
    const uc = new GetPainelVendasUseCase(new FakeRepo());
    for (const role of ['Corretor', 'Corretor Parceiro', 'Cliente', '']) {
      await expect(uc.execute({ ...base, requesterRole: role })).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('de > ate -> 400; mais de 24 meses -> 400', async () => {
    const uc = new GetPainelVendasUseCase(new FakeRepo());
    await expect(uc.execute({ ...base, de: d(8, 1), ate: d(7, 1) })).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      uc.execute({ ...base, de: new Date(2024, 0, 1), ate: new Date(2026, 0, 1) }),
    ).rejects.toThrow('no máximo 24 meses');
    await expect(uc.execute({ ...base, de: new Date(2024, 0, 1), ate: new Date(2025, 11, 31) })).resolves.toBeDefined();
  });

  it('pipelineId de outro tenant/inexistente -> 404', async () => {
    const uc = new GetPainelVendasUseCase(new FakeRepo());
    await expect(uc.execute({ ...base, pipelineId: 'p-de-outro-tenant' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('monta a resposta do contrato no pipeline padrao (mais antigo)', async () => {
    const repo = new FakeRepo();
    repo.inicio = new Date('2026-06-01T10:00:00.000Z');
    semear(repo);
    const r = await new GetPainelVendasUseCase(repo).execute(base);

    expect(r.periodo).toEqual({ de: '2026-07-01', ate: '2026-07-31' });
    expect(r.historicoDesde).toBe('2026-06-01T10:00:00.000Z');
    expect(r.pipelineId).toBe('p-antigo');
    expect(r.pipelines).toEqual(repo.pipelines);
    expect(r.filtros).toEqual({ corretores: [{ id: 'u1', nome: 'Ana' }], origens: ['manual'] });
    expect(r.resumo).toEqual({
      leadsNovos: 2,
      ganhos: 1,
      perdidos: 1,
      conversaoPct: 50,
      vgvGanho: 250000,
      ticketMedio: 250000,
      cicloMedioDias: 30.5,
      cicloMedianoDias: 30.5,
    });
    expect(r.comparativo).toMatchObject({ leadsNovos: 1, ganhos: 0, perdidos: 0, conversaoPct: 0, vgvGanho: 0 });
    expect(r.funil).toEqual([
      { stageId: 's1', nome: 'Em Atendimento', entradas: 1, conversaoProximaPct: 100 },
      { stageId: 's2', nome: 'Fechamento', entradas: 1, conversaoProximaPct: null },
    ]);
    expect(r.vgvPorMes).toEqual([{ mes: '2026-07', vgv: 250000, ganhos: 1 }]);
    expect(r.ranking).toEqual([{ corretorId: 'u1', nome: 'Ana', leads: 2, ganhos: 1, conversaoPct: 50, vgv: 250000 }]);
    expect(r.porOrigem).toEqual([{ origem: 'manual', leads: 2, ganhos: 1, conversaoPct: 50 }]);
    expect(r.motivosPerda).toEqual([{ motivo: 'PRECO', rotulo: 'Preço (fora do orçamento do lead)', quantidade: 1, pct: 100 }]);
  });

  it('periodo anterior: mesma duracao, terminando na vespera; filtros repassados', async () => {
    const repo = new FakeRepo();
    await new GetPainelVendasUseCase(repo).execute({ ...base, corretorId: 'u1', origem: 'site' });
    const [atual, anterior] = repo.chamadasCriados;
    expect(atual).toMatchObject({ tenantId: 't-1', pipelineId: 'p-antigo', corretorId: 'u1', origem: 'site' });
    expect(atual.inicio).toEqual(new Date(2026, 6, 1));
    expect(atual.fimExclusivo).toEqual(new Date(2026, 7, 1));
    expect(anterior.inicio).toEqual(new Date(2026, 4, 31));
    expect(anterior.fimExclusivo).toEqual(new Date(2026, 6, 1));
    expect(anterior).toMatchObject({ tenantId: 't-1', corretorId: 'u1', origem: 'site' });
  });

  it('filtro de corretor aplicado', async () => {
    const repo = new FakeRepo();
    semear(repo);
    const r = await new GetPainelVendasUseCase(repo).execute({ ...base, corretorId: 'outro' });
    expect(r.resumo.leadsNovos).toBe(0);
    expect(r.resumo.ganhos).toBe(0);
  });

  it('padrao sem datas: ultimos 6 meses de calendario ate hoje', async () => {
    const r = await new GetPainelVendasUseCase(new FakeRepo()).execute({
      tenantId: 't-1',
      requesterRole: 'Administrador',
      agora: new Date(2026, 9, 19, 15),
    });
    expect(r.periodo).toEqual({ de: '2026-05-01', ate: '2026-10-19' });
    expect(r.vgvPorMes.map((m) => m.mes)).toEqual(['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
    expect(r.vgvPorMes.every((m) => m.vgv === 0 && m.ganhos === 0)).toBe(true);
  });

  it('tenant sem nenhum pipeline: resposta vazia, sem erro', async () => {
    const repo = new FakeRepo();
    repo.pipelines = [];
    const r = await new GetPainelVendasUseCase(repo).execute(base);
    expect(r.pipelineId).toBeNull();
    expect(r.historicoDesde).toBeNull();
    expect(r.funil).toEqual([]);
    expect(r.resumo.conversaoPct).toBeNull();
    expect(r.vgvPorMes).toEqual([{ mes: '2026-07', vgv: 0, ganhos: 0 }]);
  });
});
