// Promocao (mutacao) do Card de captura automatica para o funil de vendas -
// unitario: mocka IPipelineRepository/ICardRepository/EventEmitter2,
// verifica a DECISAO (promover vs deixar o chamador criar um Card novo) e o
// disparo condicional da Roleta Online.
import { PromoverLeadMinimoUseCase } from './promover-lead-minimo.use-case';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { buildCardRecord } from '../../../../../test/factories/card-record.factory';

function setup() {
  const pipelineRepository = { findAllByTenant: jest.fn() };
  const cardRepository = {
    findByTenantPhoneAndPipeline: jest.fn(),
    moveToPipelineAndStage: jest.fn(),
  };
  const eventEmitter = { emit: jest.fn(), emitAsync: jest.fn().mockResolvedValue([]) };

  const useCase = new PromoverLeadMinimoUseCase(
    pipelineRepository as unknown as IPipelineRepository,
    cardRepository as unknown as ICardRepository,
    eventEmitter as any,
  );

  return { useCase, pipelineRepository, cardRepository, eventEmitter };
}

describe('PromoverLeadMinimoUseCase', () => {
  it('existe Card de captura automatica para o telefone: MOVE o mesmo Card (nao cria um novo) para o pipeline/stage alvo', async () => {
    const { useCase, pipelineRepository, cardRepository, eventEmitter } = setup();
    pipelineRepository.findAllByTenant.mockResolvedValue([
      { id: 'pipeline-remarketing', tenantId: 'tenant-1', name: 'Leads Nao Qualificados', createdAt: new Date() },
    ]);
    const cardRemarketing = buildCardRecord({ id: 'card-1', pipelineId: 'pipeline-remarketing', stageId: 'stage-aguardando' });
    cardRepository.findByTenantPhoneAndPipeline.mockResolvedValue(cardRemarketing);
    const cardMovido = buildCardRecord({ id: 'card-1', pipelineId: 'pipeline-vendas', stageId: null });
    cardRepository.moveToPipelineAndStage.mockResolvedValue(cardMovido);

    const resultado = await useCase.execute({
      tenantId: 'tenant-1',
      phoneNumber: '5511999990000',
      targetPipelineId: 'pipeline-vendas',
      targetStageId: null,
      position: 0,
      title: 'Daniel Villar',
      description: 'resumo do atendimento',
      origem: 'roleta_online',
    });

    expect(resultado?.id).toBe('card-1');
    expect(cardRepository.moveToPipelineAndStage).toHaveBeenCalledWith(
      'card-1',
      expect.objectContaining({
        pipelineId: 'pipeline-vendas',
        stageId: null,
        title: 'Daniel Villar',
        description: 'resumo do atendimento',
        origem: 'roleta_online',
      }),
    );
    // Caiu na Caixa de Entrada (stageId null) -> dispara a Roleta Online,
    // mesma condicao ja usada por CreateQuickCardUseCase.
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      'card.sem_dono.criado',
      expect.objectContaining({ tenantId: 'tenant-1', cardId: 'card-1', pipelineId: 'pipeline-vendas' }),
    );
  });

  it('promovido direto para uma stage (ex: Repique, motivo sem_perfil): NAO dispara a Roleta Online', async () => {
    const { useCase, pipelineRepository, cardRepository, eventEmitter } = setup();
    pipelineRepository.findAllByTenant.mockResolvedValue([
      { id: 'pipeline-remarketing', tenantId: 'tenant-1', name: 'Leads Nao Qualificados', createdAt: new Date() },
    ]);
    cardRepository.findByTenantPhoneAndPipeline.mockResolvedValue(buildCardRecord({ id: 'card-1' }));
    cardRepository.moveToPipelineAndStage.mockResolvedValue(
      buildCardRecord({ id: 'card-1', stageId: 'stage-repique' }),
    );

    await useCase.execute({
      tenantId: 'tenant-1',
      phoneNumber: '5511999990000',
      targetPipelineId: 'pipeline-vendas',
      targetStageId: 'stage-repique',
      position: 0,
      motivoRepique: 'SEM_PERFIL',
    });

    expect(eventEmitter.emitAsync).not.toHaveBeenCalled();
  });

  it('pipeline de remarketing nunca existiu para o tenant: retorna null sem consultar Card nenhum', async () => {
    const { useCase, pipelineRepository, cardRepository } = setup();
    pipelineRepository.findAllByTenant.mockResolvedValue([
      { id: 'pipeline-vendas', tenantId: 'tenant-1', name: 'Vendas Imoveis', createdAt: new Date() },
    ]);

    const resultado = await useCase.execute({
      tenantId: 'tenant-1',
      phoneNumber: '5511999990000',
      targetPipelineId: 'pipeline-vendas',
      targetStageId: null,
      position: 0,
    });

    expect(resultado).toBeNull();
    expect(cardRepository.findByTenantPhoneAndPipeline).not.toHaveBeenCalled();
  });

  it('pipeline de remarketing existe, mas SEM Card para este telefone: retorna null (chamador cria um Card novo)', async () => {
    const { useCase, pipelineRepository, cardRepository } = setup();
    pipelineRepository.findAllByTenant.mockResolvedValue([
      { id: 'pipeline-remarketing', tenantId: 'tenant-1', name: 'Leads Nao Qualificados', createdAt: new Date() },
    ]);
    cardRepository.findByTenantPhoneAndPipeline.mockResolvedValue(null);

    const resultado = await useCase.execute({
      tenantId: 'tenant-1',
      phoneNumber: '5511999990000',
      targetPipelineId: 'pipeline-vendas',
      targetStageId: null,
      position: 0,
    });

    expect(resultado).toBeNull();
    expect(cardRepository.moveToPipelineAndStage).not.toHaveBeenCalled();
  });
});
