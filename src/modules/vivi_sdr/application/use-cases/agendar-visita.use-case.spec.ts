// Idempotencia (upsert) de agendar_visita - confirmado em producao
// (card "Visita agendada via VIVI", 14/07/2026): a VIVI pode chamar a tool
// mais de uma vez na mesma conversa (o modelo nem sempre segue a instrucao
// do system prompt que ja proibia isso), e antes disso cada chamada criava
// uma Activity "visita" identica. Unitario: mocka IPipelineRepository/
// IActivityRepository/CreateQuickCardUseCase/CreateActivityUseCase - o que
// importa aqui e a DECISAO (atualizar vs criar), nao o banco em si.
import { AgendarVisitaUseCase } from './agendar-visita.use-case';
import { IPipelineRepository } from '../../../vendas_kanban/domain/repositories/pipeline-repository.interface';
import { IActivityRepository, ActivityRecord } from '../../../vendas_kanban/domain/repositories/activity-repository.interface';
import { ICardRepository } from '../../../vendas_kanban/domain/repositories/card-repository.interface';
import { IUserRepository } from '../../../auth/domain/repositories/user-repository.interface';
import { IEmpreendimentoRepository } from '../../../gestao_imobiliaria/domain/repositories/empreendimento-repository.interface';
import { CreateQuickCardUseCase } from '../../../vendas_kanban/application/use-cases/create-quick-card.use-case';
import { CreateActivityUseCase } from '../../../vendas_kanban/application/use-cases/create-activity.use-case';

function buildActivityRecord(overrides: Partial<ActivityRecord> = {}): ActivityRecord {
  return {
    id: 'activity-1',
    tenantId: 'tenant-1',
    cardId: 'card-1',
    type: 'visita',
    subject: 'Visita agendada via VIVI - horario informado pelo lead: "10:00"',
    scheduledAt: new Date('2026-07-18T10:00:00.000Z'),
    done: false,
    createdAt: new Date(),
    ...overrides,
  };
}

function setup() {
  const pipelineRepository = { findAllByTenant: jest.fn() };
  const activityRepository = {
    findPendingByCardAndType: jest.fn(),
    update: jest.fn(),
  };
  // Integracao VIVI (2026) - resolveResponsavelNome/resolveLocal. Defaults
  // resolvem para o fallback generico ("nossa equipe", ver
  // AgendarVisitaUseCase) sem quebrar nenhum teste existente, que nao
  // testava esse aspecto - ver specs dedicados na Integracao VIVI para os
  // casos de corretor/administrador/local especificos.
  const cardRepository = { findByIdAndTenant: jest.fn().mockResolvedValue(null) };
  const userRepository = {
    findById: jest.fn().mockResolvedValue(null),
    findAllByTenantAndRole: jest.fn().mockResolvedValue([]),
  };
  const empreendimentoRepository = { findByIdAndTenant: jest.fn().mockResolvedValue(null) };
  const createQuickCardUseCase = { execute: jest.fn() };
  // Chamado ANTES do fallback createQuickCardUseCase quando nao ha
  // existingCardId (ver AgendarVisitaUseCase) - retorna null por padrao
  // (nenhum card de remarketing a promover), mantendo o comportamento
  // destes testes identico ao de antes desta fatia.
  const promoverLeadMinimoUseCase = { execute: jest.fn().mockResolvedValue(null) };
  const createActivityUseCase = { execute: jest.fn() };

  const useCase = new AgendarVisitaUseCase(
    pipelineRepository as unknown as IPipelineRepository,
    activityRepository as unknown as IActivityRepository,
    cardRepository as unknown as ICardRepository,
    userRepository as unknown as IUserRepository,
    empreendimentoRepository as unknown as IEmpreendimentoRepository,
    createQuickCardUseCase as unknown as CreateQuickCardUseCase,
    promoverLeadMinimoUseCase as any,
    createActivityUseCase as unknown as CreateActivityUseCase,
  );

  pipelineRepository.findAllByTenant.mockResolvedValue([{ id: 'pipeline-1', tenantId: 'tenant-1', name: 'Padrao', createdAt: new Date() }]);

  return {
    useCase,
    pipelineRepository,
    activityRepository,
    cardRepository,
    userRepository,
    empreendimentoRepository,
    createQuickCardUseCase,
    promoverLeadMinimoUseCase,
    createActivityUseCase,
  };
}

describe('AgendarVisitaUseCase - idempotencia (upsert) da Activity de visita', () => {
  it('1a chamada (sem Activity pendente ainda): CRIA a Activity normalmente', async () => {
    const { useCase, activityRepository, createQuickCardUseCase, createActivityUseCase } = setup();
    createQuickCardUseCase.execute.mockResolvedValue({ id: 'card-1' });
    activityRepository.findPendingByCardAndType.mockResolvedValue(null);
    createActivityUseCase.execute.mockResolvedValue(buildActivityRecord());

    await useCase.execute({
      tenantId: 'tenant-1',
      phoneNumber: '5511999990000',
      dataVisita: '2026-07-18',
      horario: '10:00',
    });

    expect(activityRepository.findPendingByCardAndType).toHaveBeenCalledWith('tenant-1', 'card-1', 'visita');
    expect(createActivityUseCase.execute).toHaveBeenCalledTimes(1);
    expect(activityRepository.update).not.toHaveBeenCalled();
  });

  it('2a chamada com o MESMO horario (reconfirmacao): ATUALIZA a Activity existente, nao cria outra', async () => {
    const { useCase, activityRepository, createActivityUseCase } = setup();
    const existente = buildActivityRecord({
      id: 'activity-existente',
      subject: 'Visita agendada via VIVI - horario informado pelo lead: "10:00"',
      scheduledAt: new Date('2026-07-18T10:00:00.000Z'),
    });
    activityRepository.findPendingByCardAndType.mockResolvedValue(existente);
    activityRepository.update.mockResolvedValue(existente);

    await useCase.execute({
      tenantId: 'tenant-1',
      phoneNumber: '5511999990000',
      dataVisita: '2026-07-18',
      horario: '10:00',
      existingCardId: 'card-1',
    });

    expect(createActivityUseCase.execute).not.toHaveBeenCalled();
    expect(activityRepository.update).toHaveBeenCalledTimes(1);
    expect(activityRepository.update).toHaveBeenCalledWith(
      'activity-existente',
      expect.objectContaining({
        subject: expect.stringContaining('"10:00"'),
        // Fuso LOCAL do processo (mesma convencao de parseDateOnly, ver
        // date-only.util.ts/CLAUDE.md) - nunca hardcodar um ISO com "Z" aqui,
        // isso assumiria UTC e quebraria em qualquer fuso diferente de UTC+0.
        scheduledAt: new Date(2026, 6, 18, 10, 0, 0, 0),
      }),
    );
  });

  it('2a chamada com horario DIFERENTE (mudanca real): ATUALIZA a Activity existente com o novo horario', async () => {
    const { useCase, activityRepository, createActivityUseCase } = setup();
    const existente = buildActivityRecord({
      id: 'activity-existente',
      subject: 'Visita agendada via VIVI - horario informado pelo lead: "10:00"',
      scheduledAt: new Date('2026-07-18T10:00:00.000Z'),
    });
    activityRepository.findPendingByCardAndType.mockResolvedValue(existente);
    activityRepository.update.mockResolvedValue(existente);

    await useCase.execute({
      tenantId: 'tenant-1',
      phoneNumber: '5511999990000',
      dataVisita: '2026-07-19',
      horario: '15:30',
      existingCardId: 'card-1',
    });

    expect(createActivityUseCase.execute).not.toHaveBeenCalled();
    expect(activityRepository.update).toHaveBeenCalledTimes(1);
    expect(activityRepository.update).toHaveBeenCalledWith(
      'activity-existente',
      expect.objectContaining({
        subject: expect.stringContaining('"15:30"'),
        scheduledAt: new Date(2026, 6, 19, 15, 30, 0, 0),
      }),
    );
  });

  it('3a chamada (Activity ja concluida/done=true): NAO encontra pendente, cria uma nova (visita seguinte)', async () => {
    // findPendingByCardAndType so busca done=false (ver repositorio) - se a
    // visita anterior ja foi marcada concluida, uma nova chamada de
    // agendar_visita deve criar uma Activity nova (proxima visita), nao
    // reabrir/atualizar a antiga.
    const { useCase, activityRepository, createQuickCardUseCase, createActivityUseCase } = setup();
    activityRepository.findPendingByCardAndType.mockResolvedValue(null);
    createActivityUseCase.execute.mockResolvedValue(buildActivityRecord({ id: 'activity-nova' }));

    await useCase.execute({
      tenantId: 'tenant-1',
      phoneNumber: '5511999990000',
      dataVisita: '2026-08-01',
      horario: '09:00',
      existingCardId: 'card-1',
    });

    expect(activityRepository.update).not.toHaveBeenCalled();
    expect(createActivityUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it('sem existingCardId, mas existe Card de captura automatica (funil de remarketing) para o telefone: PROMOVE (nao cria um Card novo)', async () => {
    const { useCase, activityRepository, createQuickCardUseCase, promoverLeadMinimoUseCase, createActivityUseCase } = setup();
    promoverLeadMinimoUseCase.execute.mockResolvedValue({ id: 'card-promovido' });
    activityRepository.findPendingByCardAndType.mockResolvedValue(null);
    createActivityUseCase.execute.mockResolvedValue(buildActivityRecord({ id: 'activity-1', cardId: 'card-promovido' }));

    const resultado = await useCase.execute({
      tenantId: 'tenant-1',
      phoneNumber: '5511999990000',
      dataVisita: '2026-07-18',
      horario: '10:00',
    });

    expect(resultado?.cardId).toBe('card-promovido');
    expect(promoverLeadMinimoUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', phoneNumber: '5511999990000' }),
    );
    expect(createQuickCardUseCase.execute).not.toHaveBeenCalled();
  });

  it('sem existingCardId e SEM Card de remarketing para o telefone: cai no caminho antigo (cria um Card novo)', async () => {
    const { useCase, createQuickCardUseCase, promoverLeadMinimoUseCase, activityRepository, createActivityUseCase } = setup();
    promoverLeadMinimoUseCase.execute.mockResolvedValue(null);
    createQuickCardUseCase.execute.mockResolvedValue({ id: 'card-novo' });
    activityRepository.findPendingByCardAndType.mockResolvedValue(null);
    createActivityUseCase.execute.mockResolvedValue(buildActivityRecord({ id: 'activity-1', cardId: 'card-novo' }));

    const resultado = await useCase.execute({
      tenantId: 'tenant-1',
      phoneNumber: '5511999990000',
      dataVisita: '2026-07-18',
      horario: '10:00',
    });

    expect(resultado?.cardId).toBe('card-novo');
    expect(createQuickCardUseCase.execute).toHaveBeenCalledTimes(1);
  });
});

// Integracao VIVI (2026) - mensagem de confirmacao estruturada (dia/horario/
// local/responsavel), enviada como segunda mensagem depois da confirmacao
// cordial gerada pela IA (ver ProcessIncomingMessageUseCase).
describe('AgendarVisitaUseCase - mensagem de confirmacao estruturada', () => {
  it('Card com ownerId (corretor atribuido pela Roleta): mensagem cita o nome do corretor', async () => {
    const { useCase, cardRepository, userRepository, createQuickCardUseCase, activityRepository, createActivityUseCase } =
      setup();
    createQuickCardUseCase.execute.mockResolvedValue({ id: 'card-1' });
    activityRepository.findPendingByCardAndType.mockResolvedValue(null);
    createActivityUseCase.execute.mockResolvedValue(buildActivityRecord());
    cardRepository.findByIdAndTenant.mockResolvedValue({ id: 'card-1', ownerId: 'user-corretor' });
    userRepository.findById.mockResolvedValue({ id: 'user-corretor', name: 'Joao Corretor' });

    const resultado = await useCase.execute({
      tenantId: 'tenant-1',
      phoneNumber: '5511999990000',
      dataVisita: '2026-07-18',
      horario: '10:00',
    });

    expect(resultado?.mensagemConfirmacaoEstruturada).toContain('Responsável: Joao Corretor');
    expect(userRepository.findAllByTenantAndRole).not.toHaveBeenCalled();
  });

  it('Card SEM ownerId (Roleta inativa/ninguem online, ou so suggestedOwnerId): cai no fallback Administrador', async () => {
    const { useCase, cardRepository, userRepository, createQuickCardUseCase, activityRepository, createActivityUseCase } =
      setup();
    createQuickCardUseCase.execute.mockResolvedValue({ id: 'card-1' });
    activityRepository.findPendingByCardAndType.mockResolvedValue(null);
    createActivityUseCase.execute.mockResolvedValue(buildActivityRecord());
    cardRepository.findByIdAndTenant.mockResolvedValue({ id: 'card-1', ownerId: null, suggestedOwnerId: 'user-sugerido' });
    userRepository.findAllByTenantAndRole.mockResolvedValue([{ id: 'user-admin' }]);
    userRepository.findById.mockResolvedValue({ id: 'user-admin', name: 'Daniel Villar' });

    const resultado = await useCase.execute({
      tenantId: 'tenant-1',
      phoneNumber: '5511999990000',
      dataVisita: '2026-07-18',
      horario: '10:00',
    });

    expect(resultado?.mensagemConfirmacaoEstruturada).toContain('Responsável: Daniel Villar');
    expect(userRepository.findAllByTenantAndRole).toHaveBeenCalledWith('tenant-1', 'Administrador');
  });

  it('nenhum Administrador encontrado (caso extremo): usa o fallback generico "nossa equipe"', async () => {
    const { useCase, cardRepository, createQuickCardUseCase, activityRepository, createActivityUseCase } = setup();
    createQuickCardUseCase.execute.mockResolvedValue({ id: 'card-1' });
    activityRepository.findPendingByCardAndType.mockResolvedValue(null);
    createActivityUseCase.execute.mockResolvedValue(buildActivityRecord());
    cardRepository.findByIdAndTenant.mockResolvedValue({ id: 'card-1', ownerId: null });

    const resultado = await useCase.execute({
      tenantId: 'tenant-1',
      phoneNumber: '5511999990000',
      dataVisita: '2026-07-18',
      horario: '10:00',
    });

    expect(resultado?.mensagemConfirmacaoEstruturada).toContain('Responsável: nossa equipe');
  });

  it('empreendimentoId presente com plantao cadastrado: mensagem inclui a linha "Local"', async () => {
    const { useCase, empreendimentoRepository, createQuickCardUseCase, activityRepository, createActivityUseCase } = setup();
    createQuickCardUseCase.execute.mockResolvedValue({ id: 'card-1' });
    activityRepository.findPendingByCardAndType.mockResolvedValue(null);
    createActivityUseCase.execute.mockResolvedValue(buildActivityRecord());
    empreendimentoRepository.findByIdAndTenant.mockResolvedValue({
      id: 'emp-1',
      plantaoEndereco: 'Av. Principal, 100',
      plantaoHorarioFuncionamento: 'Seg a Sab, 9h-18h',
    });

    const resultado = await useCase.execute({
      tenantId: 'tenant-1',
      phoneNumber: '5511999990000',
      dataVisita: '2026-07-18',
      horario: '10:00',
      empreendimentoId: 'emp-1',
    });

    expect(resultado?.mensagemConfirmacaoEstruturada).toContain('Local: Av. Principal, 100 - Seg a Sab, 9h-18h');
  });

  it('empreendimentoId ausente (conversa nunca encontrou empreendimento no catalogo): mensagem OMITE a linha "Local"', async () => {
    const { useCase, createQuickCardUseCase, activityRepository, createActivityUseCase } = setup();
    createQuickCardUseCase.execute.mockResolvedValue({ id: 'card-1' });
    activityRepository.findPendingByCardAndType.mockResolvedValue(null);
    createActivityUseCase.execute.mockResolvedValue(buildActivityRecord());

    const resultado = await useCase.execute({
      tenantId: 'tenant-1',
      phoneNumber: '5511999990000',
      dataVisita: '2026-07-18',
      horario: '10:00',
    });

    expect(resultado?.mensagemConfirmacaoEstruturada).not.toContain('Local:');
  });

  it('horario generico (ex: "a tarde", o gatilho do bug relatado pelo usuario): aparece literal, sem inventar hora especifica', async () => {
    const { useCase, createQuickCardUseCase, activityRepository, createActivityUseCase } = setup();
    createQuickCardUseCase.execute.mockResolvedValue({ id: 'card-1' });
    activityRepository.findPendingByCardAndType.mockResolvedValue(null);
    createActivityUseCase.execute.mockResolvedValue(buildActivityRecord());

    const resultado = await useCase.execute({
      tenantId: 'tenant-1',
      phoneNumber: '5511999990000',
      dataVisita: '2026-07-18',
      horario: 'a tarde',
    });

    expect(resultado?.mensagemConfirmacaoEstruturada).toContain('Horário: a tarde');
    expect(resultado?.mensagemConfirmacaoEstruturada).toContain('Dia: 18/07/2026');
  });
});
