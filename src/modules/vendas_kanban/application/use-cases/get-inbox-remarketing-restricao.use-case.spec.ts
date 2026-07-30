// Defesa em profundidade: um Corretor comum nao pode ver a Caixa de
// Entrada do pipeline de remarketing ("Leads Nao Qualificados"), mesmo
// acessando o pipelineId diretamente (sem passar pelo seletor, ja
// filtrado por ListPipelinesUseCase). Mesma checagem, mesma funcao de
// dominio (podeAcessarPipelineRemarketing) - ver
// get-board-remarketing-restricao.use-case.spec.ts e
// claim-card-remarketing-restricao.use-case.spec.ts.
import { GetInboxUseCase } from './get-inbox.use-case';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { IActivityRepository } from '../../domain/repositories/activity-repository.interface';

function setup(pipelineName: string) {
  const pipelineRepository = { findByIdAndTenant: jest.fn() };
  const cardRepository = { findAllByPipelineInbox: jest.fn() };
  const activityRepository = {
    findProximasByCardIds: jest.fn(),
    findUltimasByCardIds: jest.fn(),
  };

  const useCase = new GetInboxUseCase(
    pipelineRepository as unknown as IPipelineRepository,
    cardRepository as unknown as ICardRepository,
    activityRepository as unknown as IActivityRepository,
  );

  pipelineRepository.findByIdAndTenant.mockResolvedValue({
    id: 'pipeline-1',
    tenantId: 'tenant-1',
    name: pipelineName,
    createdAt: new Date(),
  });
  cardRepository.findAllByPipelineInbox.mockResolvedValue([
    { id: 'card-1', pipelineId: 'pipeline-1', stageId: null, ownerId: null },
  ]);
  activityRepository.findProximasByCardIds.mockResolvedValue([]);
  activityRepository.findUltimasByCardIds.mockResolvedValue([]);

  return { useCase, cardRepository };
}

describe('GetInboxUseCase - restricao do funil de remarketing', () => {
  it('Corretor comum tentando ver a inbox do funil de remarketing diretamente: bloqueado (Forbidden)', async () => {
    const { useCase, cardRepository } = setup('Leads Nao Qualificados');

    await expect(
      useCase.execute({
        pipelineId: 'pipeline-1',
        tenantId: 'tenant-1',
        requesterRole: 'Corretor',
        requesterUserId: 'user-1',
        requesterCargo: 'corretor',
      }),
    ).rejects.toThrow('Voce nao tem acesso a este funil.');

    expect(cardRepository.findAllByPipelineInbox).not.toHaveBeenCalled();
  });

  it('Administrador: ve a inbox do funil de remarketing normalmente', async () => {
    const { useCase } = setup('Leads Nao Qualificados');

    const cards = await useCase.execute({
      pipelineId: 'pipeline-1',
      tenantId: 'tenant-1',
      requesterRole: 'Administrador',
      requesterUserId: 'user-1',
      requesterCargo: null,
    });

    expect(cards).toHaveLength(1);
  });

  it('cargo coordenador: ve a inbox do funil de remarketing normalmente', async () => {
    const { useCase } = setup('Leads Nao Qualificados');

    const cards = await useCase.execute({
      pipelineId: 'pipeline-1',
      tenantId: 'tenant-1',
      requesterRole: 'Corretor',
      requesterUserId: 'user-1',
      requesterCargo: 'coordenador',
    });

    expect(cards).toHaveLength(1);
  });

  it('Corretor comum: inbox de pipeline normal continua funcionando sem alteracao', async () => {
    const { useCase } = setup('Vendas');

    const cards = await useCase.execute({
      pipelineId: 'pipeline-1',
      tenantId: 'tenant-1',
      requesterRole: 'Corretor',
      requesterUserId: 'user-1',
      requesterCargo: 'corretor',
    });

    expect(cards).toHaveLength(1);
  });
});
