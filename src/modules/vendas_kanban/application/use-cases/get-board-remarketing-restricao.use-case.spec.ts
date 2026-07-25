// Defesa em profundidade: mesmo acessando o pipelineId do funil de
// remarketing diretamente (sem passar pelo seletor, ja filtrado por
// ListPipelinesUseCase), GetBoardUseCase deve bloquear quem nao e
// Administrador/coordenador.
import { GetBoardUseCase } from './get-board.use-case';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { IActivityRepository } from '../../domain/repositories/activity-repository.interface';
import { GetSubordinadosRecursivosUseCase } from '../../../auth/application/use-cases/get-subordinados-recursivos.use-case';
import { GetCorretoresEscaladosHojeUseCase } from '../../../plantao/application/use-cases/get-corretores-escalados-hoje.use-case';

function setup() {
  const pipelineRepository = { findByIdAndTenant: jest.fn() };
  const stageRepository = { findAllByPipeline: jest.fn() };
  const cardRepository = { findAllByStage: jest.fn() };
  const activityRepository = { findProximasByCardIds: jest.fn() };
  const getSubordinadosRecursivosUseCase = { execute: jest.fn() };
  const getCorretoresEscaladosHojeUseCase = { execute: jest.fn() };

  const useCase = new GetBoardUseCase(
    pipelineRepository as unknown as IPipelineRepository,
    stageRepository as unknown as IStageRepository,
    cardRepository as unknown as ICardRepository,
    activityRepository as unknown as IActivityRepository,
    getSubordinadosRecursivosUseCase as unknown as GetSubordinadosRecursivosUseCase,
    getCorretoresEscaladosHojeUseCase as unknown as GetCorretoresEscaladosHojeUseCase,
  );

  pipelineRepository.findByIdAndTenant.mockResolvedValue({
    id: 'pipeline-remarketing',
    tenantId: 'tenant-1',
    name: 'Leads Nao Qualificados',
    createdAt: new Date(),
  });
  stageRepository.findAllByPipeline.mockResolvedValue([]);
  activityRepository.findProximasByCardIds.mockResolvedValue([]);

  return { useCase };
}

describe('GetBoardUseCase - restricao do funil de remarketing', () => {
  it('Corretor comum tentando abrir o board do funil de remarketing diretamente: bloqueado (Forbidden)', async () => {
    const { useCase } = setup();

    await expect(
      useCase.execute({
        pipelineId: 'pipeline-remarketing',
        tenantId: 'tenant-1',
        requesterRole: 'Corretor',
        requesterUserId: 'user-1',
        requesterCargo: 'corretor',
        requesterStandId: null,
      }),
    ).rejects.toThrow('Voce nao tem acesso a este funil.');
  });

  it('Administrador: acessa normalmente', async () => {
    const { useCase } = setup();

    const board = await useCase.execute({
      pipelineId: 'pipeline-remarketing',
      tenantId: 'tenant-1',
      requesterRole: 'Administrador',
      requesterUserId: 'user-1',
      requesterCargo: null,
      requesterStandId: null,
    });

    expect(board.name).toBe('Leads Nao Qualificados');
  });

  it('cargo coordenador: acessa normalmente', async () => {
    const { useCase } = setup();

    const board = await useCase.execute({
      pipelineId: 'pipeline-remarketing',
      tenantId: 'tenant-1',
      requesterRole: 'Corretor',
      requesterUserId: 'user-1',
      requesterCargo: 'coordenador',
      requesterStandId: null,
    });

    expect(board.name).toBe('Leads Nao Qualificados');
  });
});
