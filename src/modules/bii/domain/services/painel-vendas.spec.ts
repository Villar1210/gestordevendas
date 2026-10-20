import {
  calcularMotivosPerda,
  calcularPorOrigem,
  calcularRanking,
  calcularResumo,
  calcularVgvPorMes,
  EventoBase,
  LeadBase,
} from './painel-vendas';

const dt = (m: number, dia: number) => new Date(2026, m - 1, dia, 12);

function ev(
  cardId: string,
  toStageNome: string,
  ocorridoEm: Date,
  card: Partial<EventoBase['card']> = {},
  motivoRepique: string | null = null,
): EventoBase {
  return {
    cardId,
    toStageNome,
    motivoRepique,
    ocorridoEm,
    card: { ownerId: 'u1', origem: 'manual', value: 0, createdAt: dt(1, 1), ...card },
  };
}

describe('painel-vendas - calcularResumo', () => {
  it('tudo vazio -> zeros e nulls', () => {
    expect(calcularResumo([], [])).toEqual({
      leadsNovos: 0,
      ganhos: 0,
      perdidos: 0,
      conversaoPct: null,
      vgvGanho: 0,
      ticketMedio: null,
      cicloMedioDias: null,
      cicloMedianoDias: null,
    });
  });

  it('ganho por card distinto (reentrada nao duplica VGV), perda, ticket so com valor, ciclo', () => {
    const leads: LeadBase[] = [
      { cardId: 'a', ownerId: 'u1', origem: 'manual' },
      { cardId: 'b', ownerId: 'u1', origem: 'manual' },
      { cardId: 'c', ownerId: 'u2', origem: 'site' },
      { cardId: 'd', ownerId: null, origem: 'site' },
    ];
    const eventos = [
      ev('a', 'Em Atendimento', dt(2, 1), { value: 300000, createdAt: dt(1, 1) }),
      ev('a', 'Fechamento', dt(1, 11), { value: 300000, createdAt: dt(1, 1) }),
      ev('a', 'FECHAMENTO', dt(2, 20), { value: 300000, createdAt: dt(1, 1) }), // reentrada
      ev('b', 'fechaménto', dt(1, 21), { value: 0, createdAt: dt(1, 1) }), // sem valor
      ev('c', 'Repique', dt(1, 5), {}, 'PRECO'),
      ev('c', 'Repique', dt(1, 6), {}, 'OUTRO'), // mesma perda
    ];
    expect(calcularResumo(leads, eventos)).toEqual({
      leadsNovos: 4,
      ganhos: 2,
      perdidos: 1,
      conversaoPct: 50,
      vgvGanho: 300000,
      ticketMedio: 300000,
      cicloMedioDias: 15,
      cicloMedianoDias: 15,
    });
  });

  it('ciclo negativo (ganho antes da criacao) nao entra', () => {
    const r = calcularResumo([], [ev('a', 'Fechamento', dt(1, 1), { createdAt: dt(3, 1) })]);
    expect(r.ganhos).toBe(1);
    expect(r.cicloMedioDias).toBeNull();
    expect(r.conversaoPct).toBeNull(); // 0 leads -> divisao por zero
  });

  it('Decimal com centavos somado sem erro de ponto flutuante visivel', () => {
    const r = calcularResumo([], [
      ev('a', 'Fechamento', dt(1, 2), { value: 0.1 }),
      ev('b', 'Fechamento', dt(1, 2), { value: 0.2 }),
    ]);
    expect(r.vgvGanho).toBe(0.3);
    expect(r.ticketMedio).toBe(0.15);
  });
});

describe('painel-vendas - vgvPorMes', () => {
  it('todos os meses, inclusive zerados; ganho no mes da primeira entrada', () => {
    const r = calcularVgvPorMes(
      [
        ev('a', 'Fechamento', dt(1, 10), { value: 100 }),
        ev('a', 'Fechamento', dt(3, 10), { value: 100 }),
        ev('b', 'Fechamento', dt(3, 1), { value: 50.5 }),
        ev('c', 'Visita', dt(2, 1), { value: 999 }),
      ],
      ['2026-01', '2026-02', '2026-03'],
    );
    expect(r).toEqual([
      { mes: '2026-01', vgv: 100, ganhos: 1 },
      { mes: '2026-02', vgv: 0, ganhos: 0 },
      { mes: '2026-03', vgv: 50.5, ganhos: 1 },
    ]);
  });
});

describe('painel-vendas - ranking', () => {
  it('ordenado por VGV e depois ganhos; sem dono fica de fora; conversao null sem leads', () => {
    const leads: LeadBase[] = [
      { cardId: 'a', ownerId: 'u1', origem: 'm' },
      { cardId: 'b', ownerId: 'u2', origem: 'm' },
      { cardId: 'c', ownerId: 'u2', origem: 'm' },
      { cardId: 'd', ownerId: null, origem: 'm' },
    ];
    const eventos = [
      ev('a', 'Fechamento', dt(1, 2), { ownerId: 'u1', value: 100 }),
      ev('b', 'Fechamento', dt(1, 2), { ownerId: 'u2', value: 100 }),
      ev('c', 'Fechamento', dt(1, 2), { ownerId: 'u2', value: 0 }),
      ev('x', 'Fechamento', dt(1, 2), { ownerId: 'u3', value: 500 }),
      ev('d', 'Fechamento', dt(1, 2), { ownerId: null, value: 9999 }),
    ];
    const nomes = new Map([
      ['u1', 'Ana'],
      ['u2', 'Bruno'],
    ]);
    expect(calcularRanking(leads, eventos, nomes)).toEqual([
      { corretorId: 'u3', nome: 'Usuário removido', leads: 0, ganhos: 1, conversaoPct: null, vgv: 500 },
      { corretorId: 'u2', nome: 'Bruno', leads: 2, ganhos: 2, conversaoPct: 100, vgv: 100 },
      { corretorId: 'u1', nome: 'Ana', leads: 1, ganhos: 1, conversaoPct: 100, vgv: 100 },
    ]);
  });
});

describe('painel-vendas - porOrigem e motivos', () => {
  it('porOrigem', () => {
    const r = calcularPorOrigem(
      [
        { cardId: 'a', ownerId: null, origem: 'site' },
        { cardId: 'b', ownerId: null, origem: 'site' },
        { cardId: 'c', ownerId: null, origem: 'manual' },
      ],
      [ev('a', 'Fechamento', dt(1, 1), { origem: 'site' })],
    );
    expect(r).toEqual([
      { origem: 'site', leads: 2, ganhos: 1, conversaoPct: 50 },
      { origem: 'manual', leads: 1, ganhos: 0, conversaoPct: 0 },
    ]);
  });

  it('motivosPerda com rotulo, nulo = Nao informado, pct sobre perdas distintas', () => {
    const r = calcularMotivosPerda([
      ev('a', 'Repique', dt(1, 1), {}, 'PRECO'),
      ev('b', 'Repique', dt(1, 1), {}, 'PRECO'),
      ev('c', 'Repique', dt(1, 1), {}, null),
      ev('c', 'Repique', dt(1, 2), {}, 'OUTRO'), // mesmo card: vale a 1a entrada
    ]);
    expect(r).toEqual([
      { motivo: 'PRECO', rotulo: 'Preço (fora do orçamento do lead)', quantidade: 2, pct: 66.7 },
      { motivo: 'NAO_INFORMADO', rotulo: 'Não informado', quantidade: 1, pct: 33.3 },
    ]);
    expect(calcularMotivosPerda([])).toEqual([]);
  });
});
