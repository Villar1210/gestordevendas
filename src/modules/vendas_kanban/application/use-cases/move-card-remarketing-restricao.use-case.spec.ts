// Defesa em profundidade: um Corretor comum nao pode mover um card que
// pertence ao pipeline de remarketing ("Leads Nao Qualificados"), mesmo
// sabendo o cardId diretamente. Mesma checagem, mesma funcao de dominio
// (podeAcessarPipelineRemarketing) - ver
// claim-card-remarketing-restricao.use-case.spec.ts e demais specs irmas de
// restricao do funil de remarketing. So o pipeline do card de ORIGEM
// importa aqui: updateStageAndPosition nunca altera pipelineId (ver
// investigacao registrada no historico da tarefa), entao nao ha "lado de
// destino" a checar para fins de RBAC.
import { MoveCardUseCase } from './move-card.use-case';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';

function setup(pipelineName: string) {
  const stageRepository = { findByIdAndTenant: jest.fn() };
  const cardRepository = {
    findByIdAndTenant: jest.fn(),
    findAllByStage: jest.fn(),
    updateStageAndPosition: jest.fn(),
  };
  const pipelineRepository = { findByIdAndTenant: jest.fn() };

  const useCase = new MoveCardUseCase(
    stageRepository as unknown as IStageRepository,
    cardRepository as unknown as ICardRepository,
    pipelineRepository as unknown as IPipelineRepository,
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
  stageRepository.findByIdAndTenant.mockResolvedValue({
    id: 'stage-1',
    tenantId: 'tenant-1',
    pipelineId: 'pipeline-1',
    name: 'Em Atendimento',
  });
  cardRepository.findAllByStage.mockResolvedValue([]);
  cardRepository.updateStageAndPosition.mockResolvedValue(undefined);

  return { useCase, cardRepository };
}

describe('MoveCardUseCase - restricao do funil de remarketing', () => {
  it('Corretor comum tentando mover um card do funil de remarketing: bloqueado (Forbidden)', async () => {
    const { useCase, cardRepository } = setup('Leads Nao Qualificados');

    await expect(
      useCase.execute({
        cardId: 'card-1',
        tenantId: 'tenant-1',
        targetStageId: 'stage-1',
        targetIndex: 0,
        requesterRole: 'Corretor',
        requesterCargo: 'corretor',
      }),
    ).rejects.toThrow('Voce nao tem acesso a este funil.');

    expect(cardRepository.updateStageAndPosition).not.toHaveBeenCalled();
  });

  it('Administrador: consegue mover card do funil de remarketing', async () => {
    const { useCase, cardRepository } = setup('Leads Nao Qualificados');

    await useCase.execute({
      cardId: 'card-1',
      tenantId: 'tenant-1',
      targetStageId: 'stage-1',
      targetIndex: 0,
      requesterRole: 'Administrador',
      requesterCargo: null,
    });

    expect(cardRepository.updateStageAndPosition).toHaveBeenCalledTimes(1);
  });

  it('cargo coordenador: consegue mover card do funil de remarketing', async () => {
    const { useCase, cardRepository } = setup('Leads Nao Qualificados');

    await useCase.execute({
      cardId: 'card-1',
      tenantId: 'tenant-1',
      targetStageId: 'stage-1',
      targetIndex: 0,
      requesterRole: 'Corretor',
      requesterCargo: 'coordenador',
    });

    expect(cardRepository.updateStageAndPosition).toHaveBeenCalledTimes(1);
  });

  it('Corretor comum: mover card de pipeline normal continua funcionando sem alteracao', async () => {
    const { useCase, cardRepository } = setup('Vendas');

    await useCase.execute({
      cardId: 'card-1',
      tenantId: 'tenant-1',
      targetStageId: 'stage-1',
      targetIndex: 0,
      requesterRole: 'Corretor',
      requesterCargo: 'corretor',
    });

    expect(cardRepository.updateStageAndPosition).toHaveBeenCalledTimes(1);
  });
});
