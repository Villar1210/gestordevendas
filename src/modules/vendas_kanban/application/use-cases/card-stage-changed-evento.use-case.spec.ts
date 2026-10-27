// Evento 'card.stage.changed' (contrato com o modulo BII - ver
// domain/events/card-stage-changed.event.ts e docs/bii/fatia1/CONTRATO_PAINEL.md).
// Um caso por use case que muda Card.stageId: o evento sai com o payload
// certo DEPOIS da escrita, via emit (nao emitAsync), e NAO sai quando a stage
// nao muda de verdade.
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MoveCardUseCase } from './move-card.use-case';
import { ClaimCardUseCase } from './claim-card.use-case';
import { CreateCardUseCase } from './create-card.use-case';
import { CreateQuickCardUseCase } from './create-quick-card.use-case';
import { MoverLeadsInativosParaRepiqueUseCase } from './mover-leads-inativos-para-repique.use-case';
import { PromoverLeadMinimoUseCase } from './promover-lead-minimo.use-case';
import { buildCardRecord } from '../../../../../test/factories/card-record.factory';
import { CARD_STAGE_CHANGED_EVENT } from '../../domain/events/card-stage-changed.event';
import { acessoCardSemChecagem } from '../../../../../test/vendas_kanban/acesso-card.helper';

function novoEmitter() {
  return { emit: jest.fn(), emitAsync: jest.fn().mockResolvedValue([]) };
}
const comoEmitter = (e: ReturnType<typeof novoEmitter>) => e as unknown as EventEmitter2;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const qualquer = (x: unknown) => x as any;

function eventosStage(e: ReturnType<typeof novoEmitter>) {
  return e.emit.mock.calls.filter((c) => c[0] === CARD_STAGE_CHANGED_EVENT).map((c) => c[1]);
}

describe('card.stage.changed - MoveCardUseCase', () => {
  function setup(stageAtual: string | null, alvo: { id: string; name: string }) {
    const ordem: string[] = [];
    const emitter = novoEmitter();
    emitter.emit.mockImplementation(() => ordem.push('emit'));
    const cardRepository = {
      findByIdAndTenant: jest.fn().mockResolvedValue(
        buildCardRecord({ id: 'card-1', tenantId: 't-1', pipelineId: 'p-1', stageId: stageAtual }),
      ),
      findAllByStage: jest.fn().mockResolvedValue([]),
      updateStageAndPosition: jest.fn().mockImplementation(async () => ordem.push('update')),
    };
    const useCase = new MoveCardUseCase(
      qualquer({ findByIdAndTenant: jest.fn().mockResolvedValue({ ...alvo, tenantId: 't-1', pipelineId: 'p-1' }) }),
      qualquer(cardRepository),
      qualquer({ findByIdAndTenant: jest.fn().mockResolvedValue({ id: 'p-1', name: 'Vendas' }) }),
      comoEmitter(emitter),
      acessoCardSemChecagem(),
    );
    return { useCase, emitter, ordem };
  }

  it('emite com o payload do contrato quando a stage muda (depois do update)', async () => {
    const { useCase, emitter, ordem } = setup('s-a', { id: 's-repique', name: 'Repique' });
    await useCase.execute({
      cardId: 'card-1',
      tenantId: 't-1',
      targetStageId: 's-repique',
      targetIndex: 0,
      requesterRole: 'Corretor',
      requesterCargo: null,
      motivoRepique: 'PRECO',
      requesterUserId: 'u-1',
    });
    expect(eventosStage(emitter)).toEqual([
      {
        tenantId: 't-1',
        cardId: 'card-1',
        pipelineId: 'p-1',
        fromStageId: 's-a',
        toStageId: 's-repique',
        userId: 'u-1',
        origem: 'move',
        ocorridoEm: expect.any(Date),
        motivoRepique: 'PRECO',
      },
    ]);
    expect(ordem).toEqual(['update', 'emit']);
    expect(emitter.emitAsync).not.toHaveBeenCalled();
  });

  it('sem requesterUserId (chamador de sistema) -> userId null; motivo null fora do Repique', async () => {
    const { useCase, emitter } = setup('s-a', { id: 's-b', name: 'Visita' });
    await useCase.execute({
      cardId: 'card-1',
      tenantId: 't-1',
      targetStageId: 's-b',
      targetIndex: 0,
      requesterRole: 'Administrador',
      requesterCargo: null,
    });
    expect(eventosStage(emitter)[0]).toMatchObject({ userId: null, motivoRepique: null, fromStageId: 's-a' });
  });

  it('NAO emite ao reordenar dentro da mesma coluna', async () => {
    const { useCase, emitter } = setup('s-a', { id: 's-a', name: 'Visita' });
    await useCase.execute({
      cardId: 'card-1',
      tenantId: 't-1',
      targetStageId: 's-a',
      targetIndex: 3,
      requesterRole: 'Administrador',
      requesterCargo: null,
      requesterUserId: 'u-1',
    });
    expect(eventosStage(emitter)).toEqual([]);
  });

  it('NAO emite se a validacao falhar (Repique sem motivo)', async () => {
    const { useCase, emitter } = setup('s-a', { id: 's-repique', name: 'Repique' });
    await expect(
      useCase.execute({
        cardId: 'card-1',
        tenantId: 't-1',
        targetStageId: 's-repique',
        targetIndex: 0,
        requesterRole: 'Administrador',
        requesterCargo: null,
      }),
    ).rejects.toThrow();
    expect(eventosStage(emitter)).toEqual([]);
  });
});

describe('card.stage.changed - ClaimCardUseCase', () => {
  function setup(stageAtual: string | null) {
    const emitter = novoEmitter();
    const useCase = new ClaimCardUseCase(
      qualquer({ findByIdAndTenant: jest.fn().mockResolvedValue({ id: 'p-1', name: 'Vendas' }) }),
      qualquer({ findAllByPipeline: jest.fn().mockResolvedValue([{ id: 's-1', name: 'Em Atendimento' }]) }),
      qualquer({
        findByIdAndTenant: jest.fn().mockResolvedValue(
          buildCardRecord({ id: 'card-1', tenantId: 't-1', pipelineId: 'p-1', stageId: stageAtual, ownerId: null }),
        ),
        findAllByStage: jest.fn().mockResolvedValue([]),
        assignOwnerAndStage: jest.fn().mockImplementation(async (id: string, d: object) => ({ id, ...d })),
      }),
      comoEmitter(emitter),
    );
    return { useCase, emitter };
  }

  it('Caixa de Entrada -> primeira stage: emite origem claim com userId', async () => {
    const { useCase, emitter } = setup(null);
    await useCase.execute({ cardId: 'card-1', tenantId: 't-1', userId: 'u-1', requesterRole: 'Corretor', requesterCargo: null });
    expect(eventosStage(emitter)).toEqual([
      {
        tenantId: 't-1',
        cardId: 'card-1',
        pipelineId: 'p-1',
        fromStageId: null,
        toStageId: 's-1',
        userId: 'u-1',
        origem: 'claim',
        ocorridoEm: expect.any(Date),
      },
    ]);
  });

  it('card sem dono ja na primeira stage: NAO emite', async () => {
    const { useCase, emitter } = setup('s-1');
    await useCase.execute({ cardId: 'card-1', tenantId: 't-1', userId: 'u-1', requesterRole: 'Corretor', requesterCargo: null });
    expect(eventosStage(emitter)).toEqual([]);
  });
});

describe('card.stage.changed - CreateCardUseCase', () => {
  it('card criado ja numa stage: emite entrada (fromStageId null, origem criacao)', async () => {
    const emitter = novoEmitter();
    const useCase = new CreateCardUseCase(
      qualquer({ findByIdAndTenant: jest.fn().mockResolvedValue({ id: 's-1', pipelineId: 'p-1', tenantId: 't-1' }) }),
      qualquer({
        findAllByStage: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async (d: object) => ({ id: 'card-novo', ...d })),
      }),
      comoEmitter(emitter),
    );
    await useCase.execute({ tenantId: 't-1', ownerId: 'u-1', stageId: 's-1', title: 'Novo' });
    expect(eventosStage(emitter)).toEqual([
      {
        tenantId: 't-1',
        cardId: 'card-novo',
        pipelineId: 'p-1',
        fromStageId: null,
        toStageId: 's-1',
        userId: 'u-1',
        origem: 'criacao',
        ocorridoEm: expect.any(Date),
      },
    ]);
  });
});

describe('card.stage.changed - CreateQuickCardUseCase', () => {
  function setup() {
    const emitter = novoEmitter();
    const useCase = new CreateQuickCardUseCase(
      qualquer({ findByIdAndTenant: jest.fn().mockResolvedValue({ id: 'p-1', name: 'Vendas' }) }),
      qualquer({ create: jest.fn().mockImplementation(async (d: object) => ({ id: 'card-q', ...d })) }),
      comoEmitter(emitter),
    );
    return { useCase, emitter };
  }

  it('criado com stage (ex: Repique pela VIVI): emite entrada com motivo, userId null', async () => {
    const { useCase, emitter } = setup();
    await useCase.execute({
      tenantId: 't-1',
      pipelineId: 'p-1',
      isSystemCall: true,
      title: 'Lead',
      stageId: 's-repique',
      motivoRepique: 'SEM_PERFIL',
    });
    expect(eventosStage(emitter)).toEqual([
      {
        tenantId: 't-1',
        cardId: 'card-q',
        pipelineId: 'p-1',
        fromStageId: null,
        toStageId: 's-repique',
        userId: null,
        origem: 'criacao',
        ocorridoEm: expect.any(Date),
        motivoRepique: 'SEM_PERFIL',
      },
    ]);
  });

  it('Caixa de Entrada (sem stage): NAO emite card.stage.changed', async () => {
    const { useCase, emitter } = setup();
    await useCase.execute({ tenantId: 't-1', pipelineId: 'p-1', isSystemCall: true, title: 'Lead' });
    expect(eventosStage(emitter)).toEqual([]);
    expect(emitter.emitAsync).toHaveBeenCalledWith('card.sem_dono.criado', expect.anything());
  });
});

describe('card.stage.changed - MoverLeadsInativosParaRepiqueUseCase', () => {
  function setup(stageAtual: string | null) {
    const emitter = novoEmitter();
    const useCase = new MoverLeadsInativosParaRepiqueUseCase(
      qualquer({
        findElegiveisParaRepiqueJob: jest.fn().mockResolvedValue([
          buildCardRecord({ id: 'card-1', tenantId: 't-1', pipelineId: 'p-1', stageId: stageAtual, phone: null }),
        ]),
        findAllByStage: jest.fn().mockResolvedValue([]),
        updateStageAndPosition: jest.fn().mockResolvedValue(undefined),
      }),
      qualquer({
        findAllByPipeline: jest.fn().mockResolvedValue([
          { id: 's-a', name: 'Em Atendimento' },
          { id: 's-repique', name: 'Repique' },
        ]),
      }),
      qualquer({ findMostRecentByTenantAndPhone: jest.fn() }),
      comoEmitter(emitter),
    );
    return { useCase, emitter };
  }

  it('move para Repique: emite origem job_repique, userId null, motivo SEM_RESPOSTA_90_DIAS', async () => {
    const { useCase, emitter } = setup('s-a');
    await useCase.execute();
    expect(eventosStage(emitter)).toEqual([
      {
        tenantId: 't-1',
        cardId: 'card-1',
        pipelineId: 'p-1',
        fromStageId: 's-a',
        toStageId: 's-repique',
        userId: null,
        origem: 'job_repique',
        ocorridoEm: expect.any(Date),
        motivoRepique: 'SEM_RESPOSTA_90_DIAS',
      },
    ]);
  });

  it('card ja em Repique: NAO emite', async () => {
    const { useCase, emitter } = setup('s-repique');
    await useCase.execute();
    expect(eventosStage(emitter)).toEqual([]);
  });
});

describe('card.stage.changed - PromoverLeadMinimoUseCase', () => {
  function setup() {
    const emitter = novoEmitter();
    const cardRepository = {
      findByTenantPhoneAndPipeline: jest.fn().mockResolvedValue(
        buildCardRecord({ id: 'card-1', pipelineId: 'p-remarketing', stageId: 's-aguardando' }),
      ),
      moveToPipelineAndStage: jest.fn().mockImplementation(async (id: string, d: { pipelineId: string; stageId: string | null }) =>
        buildCardRecord({ id, pipelineId: d.pipelineId, stageId: d.stageId }),
      ),
    };
    const useCase = new PromoverLeadMinimoUseCase(
      qualquer({
        findAllByTenant: jest.fn().mockResolvedValue([{ id: 'p-remarketing', name: 'Leads Nao Qualificados' }]),
      }),
      qualquer(cardRepository),
      comoEmitter(emitter),
    );
    return { useCase, emitter };
  }

  it('promovido direto para uma stage: emite origem promocao com from = stage do remarketing', async () => {
    const { useCase, emitter } = setup();
    await useCase.execute({
      tenantId: 't-1',
      phoneNumber: '5511999990000',
      targetPipelineId: 'p-vendas',
      targetStageId: 's-repique',
      position: 0,
      motivoRepique: 'SEM_PERFIL',
    });
    expect(eventosStage(emitter)).toEqual([
      {
        tenantId: 't-1',
        cardId: 'card-1',
        pipelineId: 'p-vendas',
        fromStageId: 's-aguardando',
        toStageId: 's-repique',
        userId: null,
        origem: 'promocao',
        ocorridoEm: expect.any(Date),
        motivoRepique: 'SEM_PERFIL',
      },
    ]);
  });

  it('promovido para a Caixa de Entrada (sem stage): NAO emite card.stage.changed', async () => {
    const { useCase, emitter } = setup();
    await useCase.execute({
      tenantId: 't-1',
      phoneNumber: '5511999990000',
      targetPipelineId: 'p-vendas',
      targetStageId: null,
      position: 0,
    });
    expect(eventosStage(emitter)).toEqual([]);
  });
});
