// Defesa em profundidade: um Corretor comum nao pode listar as atividades de
// um card que pertence ao pipeline de remarketing ("Leads Nao Qualificados"),
// mesmo sabendo o cardId diretamente. Mesma checagem, mesma funcao de
// dominio (podeAcessarPipelineRemarketing) - ver
// claim-card-remarketing-restricao.use-case.spec.ts,
// get-board-remarketing-restricao.use-case.spec.ts,
// get-inbox-remarketing-restricao.use-case.spec.ts e
// create-quick-card-remarketing-restricao.use-case.spec.ts.
import { ListActivitiesByCardUseCase } from './list-activities-by-card.use-case';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { IActivityRepository } from '../../domain/repositories/activity-repository.interface';

function setup(pipelineName: string) {
  const cardRepository = { findByIdAndTenant: jest.fn() };
  const pipelineRepository = { findByIdAndTenant: jest.fn() };
  const activityRepository = { findAllByCard: jest.fn() };

  const useCase = new ListActivitiesByCardUseCase(
    cardRepository as unknown as ICardRepository,
    pipelineRepository as unknown as IPipelineRepository,
    activityRepository as unknown as IActivityRepository,
  );

  cardRepository.findByIdAndTenant.mockResolvedValue({
    id: 'card-1',
    tenantId: 'tenant-1',
    pipelineId: 'pipeline-1',
  });
  pipelineRepository.findByIdAndTenant.mockResolvedValue({
    id: 'pipeline-1',
    tenantId: 'tenant-1',
    name: pipelineName,
    createdAt: new Date(),
  });
  activityRepository.findAllByCard.mockResolvedValue([{ id: 'activity-1' }]);

  return { useCase, activityRepository };
}

describe('ListActivitiesByCardUseCase - restricao do funil de remarketing', () => {
  it('Corretor comum tentando listar atividades de um card do funil de remarketing: bloqueado (Forbidden)', async () => {
    const { useCase, activityRepository } = setup('Leads Nao Qualificados');

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        cardId: 'card-1',
        requesterRole: 'Corretor',
        requesterCargo: 'corretor',
      }),
    ).rejects.toThrow('Voce nao tem acesso a este funil.');

    expect(activityRepository.findAllByCard).not.toHaveBeenCalled();
  });

  it('Administrador: consegue listar atividades de um card do funil de remarketing', async () => {
    const { useCase } = setup('Leads Nao Qualificados');

    const activities = await useCase.execute({
      tenantId: 'tenant-1',
      cardId: 'card-1',
      requesterRole: 'Administrador',
      requesterCargo: null,
    });

    expect(activities).toHaveLength(1);
  });

  it('cargo coordenador: consegue listar atividades de um card do funil de remarketing', async () => {
    const { useCase } = setup('Leads Nao Qualificados');

    const activities = await useCase.execute({
      tenantId: 'tenant-1',
      cardId: 'card-1',
      requesterRole: 'Corretor',
      requesterCargo: 'coordenador',
    });

    expect(activities).toHaveLength(1);
  });

  it('Corretor comum: listagem em card de pipeline normal continua funcionando sem alteracao', async () => {
    const { useCase } = setup('Vendas');

    const activities = await useCase.execute({
      tenantId: 'tenant-1',
      cardId: 'card-1',
      requesterRole: 'Corretor',
      requesterCargo: 'corretor',
    });

    expect(activities).toHaveLength(1);
  });
});
