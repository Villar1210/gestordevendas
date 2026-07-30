// Defesa em profundidade: um Corretor comum nao pode "assumir" (claim) um
// card que pertence ao pipeline de remarketing ("Leads Nao Qualificados"),
// mesmo sabendo o cardId diretamente (sem passar pelo board, ja bloqueado
// em GetBoardUseCase). Mesma checagem, mesma funcao de dominio
// (podeAcessarPipelineRemarketing) - ver get-board-remarketing-restricao.use-case.spec.ts.
import { ClaimCardUseCase } from './claim-card.use-case';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';

function setup(pipelineName: string) {
  const pipelineRepository = { findByIdAndTenant: jest.fn() };
  const stageRepository = { findAllByPipeline: jest.fn() };
  const cardRepository = {
    findByIdAndTenant: jest.fn(),
    findAllByStage: jest.fn(),
    assignOwnerAndStage: jest.fn(),
  };

  const useCase = new ClaimCardUseCase(
    pipelineRepository as unknown as IPipelineRepository,
    stageRepository as unknown as IStageRepository,
    cardRepository as unknown as ICardRepository,
  );

  cardRepository.findByIdAndTenant.mockResolvedValue({
    id: 'card-1',
    tenantId: 'tenant-1',
    pipelineId: 'pipeline-1',
    ownerId: null,
  });
  pipelineRepository.findByIdAndTenant.mockResolvedValue({
    id: 'pipeline-1',
    tenantId: 'tenant-1',
    name: pipelineName,
    createdAt: new Date(),
  });
  stageRepository.findAllByPipeline.mockResolvedValue([{ id: 'stage-1', name: 'Em Atendimento' }]);
  cardRepository.findAllByStage.mockResolvedValue([]);
  cardRepository.assignOwnerAndStage.mockImplementation(async (cardId, data) => ({
    id: cardId,
    ...data,
  }));

  return { useCase, cardRepository };
}

describe('ClaimCardUseCase - restricao do funil de remarketing', () => {
  it('Corretor comum tentando assumir um card do funil de remarketing: bloqueado (Forbidden)', async () => {
    const { useCase, cardRepository } = setup('Leads Nao Qualificados');

    await expect(
      useCase.execute({
        cardId: 'card-1',
        tenantId: 'tenant-1',
        userId: 'user-1',
        requesterRole: 'Corretor',
        requesterCargo: 'corretor',
      }),
    ).rejects.toThrow('Voce nao tem acesso a este funil.');

    expect(cardRepository.assignOwnerAndStage).not.toHaveBeenCalled();
  });

  it('Administrador: consegue assumir card do funil de remarketing', async () => {
    const { useCase } = setup('Leads Nao Qualificados');

    const card = await useCase.execute({
      cardId: 'card-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      requesterRole: 'Administrador',
      requesterCargo: null,
    });

    expect(card.ownerId).toBe('user-1');
  });

  it('cargo coordenador: consegue assumir card do funil de remarketing', async () => {
    const { useCase } = setup('Leads Nao Qualificados');

    const card = await useCase.execute({
      cardId: 'card-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      requesterRole: 'Corretor',
      requesterCargo: 'coordenador',
    });

    expect(card.ownerId).toBe('user-1');
  });

  it('Corretor comum: claim em card de pipeline normal continua funcionando sem alteracao', async () => {
    const { useCase } = setup('Vendas');

    const card = await useCase.execute({
      cardId: 'card-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      requesterRole: 'Corretor',
      requesterCargo: 'corretor',
    });

    expect(card.ownerId).toBe('user-1');
    expect(card.stageId).toBe('stage-1');
  });
});
