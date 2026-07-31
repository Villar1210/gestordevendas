// Achado adjacente ao I3 (integridade de dado, nao RBAC): MoveCardUseCase
// nunca atualiza Card.pipelineId (so stageId/position), entao mover um card
// para uma stage que pertence a um pipeline DIFERENTE do pipeline do proprio
// card deixaria pipelineId e a stage referenciada divergentes - quebra o
// board (GetBoardUseCase.findAllByStage filtra so por stageId, sem checar
// pipelineId) e, no caso especifico do funil de remarketing, contornaria a
// propria restricao de acesso do I3 (que e calculada a partir de
// card.pipelineId). BadRequestException, nao ForbiddenException - e um erro
// de consistencia, nao de permissao, entao bloqueia mesmo para
// Administrador.
import { MoveCardUseCase } from './move-card.use-case';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';

function setup(options: { cardPipelineId: string; targetStagePipelineId: string; targetStageName?: string }) {
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
    pipelineId: options.cardPipelineId,
  });
  pipelineRepository.findByIdAndTenant.mockResolvedValue({
    id: options.cardPipelineId,
    tenantId: 'tenant-1',
    name: 'Vendas',
    createdAt: new Date(),
  });
  stageRepository.findByIdAndTenant.mockResolvedValue({
    id: 'stage-alvo',
    tenantId: 'tenant-1',
    pipelineId: options.targetStagePipelineId,
    name: options.targetStageName ?? 'Em Atendimento',
  });
  cardRepository.findAllByStage.mockResolvedValue([]);
  cardRepository.updateStageAndPosition.mockResolvedValue(undefined);

  return { useCase, cardRepository };
}

describe('MoveCardUseCase - consistencia pipelineId/stage de destino', () => {
  it('bloqueia (BadRequestException) mover para uma stage de OUTRO pipeline, mesmo para Administrador', async () => {
    const { useCase, cardRepository } = setup({
      cardPipelineId: 'pipeline-vendas',
      targetStagePipelineId: 'pipeline-outro',
    });

    await expect(
      useCase.execute({
        cardId: 'card-1',
        tenantId: 'tenant-1',
        targetStageId: 'stage-alvo',
        targetIndex: 0,
        requesterRole: 'Administrador',
        requesterCargo: null,
      }),
    ).rejects.toThrow('Stage de destino nao pertence ao pipeline do card.');

    expect(cardRepository.updateStageAndPosition).not.toHaveBeenCalled();
  });

  it('permite mover dentro do MESMO pipeline normalmente', async () => {
    const { useCase, cardRepository } = setup({
      cardPipelineId: 'pipeline-vendas',
      targetStagePipelineId: 'pipeline-vendas',
    });

    await useCase.execute({
      cardId: 'card-1',
      tenantId: 'tenant-1',
      targetStageId: 'stage-alvo',
      targetIndex: 0,
      requesterRole: 'Corretor',
      requesterCargo: 'corretor',
    });

    expect(cardRepository.updateStageAndPosition).toHaveBeenCalledTimes(1);
  });

  it('permite mover dentro do MESMO pipeline para a stage "Repique" com motivo valido', async () => {
    const { useCase, cardRepository } = setup({
      cardPipelineId: 'pipeline-vendas',
      targetStagePipelineId: 'pipeline-vendas',
      targetStageName: 'Repique',
    });

    await useCase.execute({
      cardId: 'card-1',
      tenantId: 'tenant-1',
      targetStageId: 'stage-alvo',
      targetIndex: 0,
      requesterRole: 'Corretor',
      requesterCargo: 'corretor',
      motivoRepique: 'SEM_PERFIL',
    });

    expect(cardRepository.updateStageAndPosition).toHaveBeenCalledWith(
      'card-1',
      'stage-alvo',
      expect.any(Number),
      expect.objectContaining({ motivoRepique: 'SEM_PERFIL' }),
    );
  });
});
