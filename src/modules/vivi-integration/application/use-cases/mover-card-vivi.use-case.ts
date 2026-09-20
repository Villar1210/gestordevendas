import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import { MoveCardUseCase } from '../../../vendas_kanban/application/use-cases/move-card.use-case';
import { ICardRepository } from '../../../vendas_kanban/domain/repositories/card-repository.interface';

interface MoverCardViviInput {
  cardId: string;
  tenantId: string;
  stageName: string;
  motivoRepique?: string;
}

@Injectable()
export class MoverCardViviUseCase {
  constructor(
    private readonly prisma: PrismaService,
    private readonly moveCardUseCase: MoveCardUseCase,
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
  ) {}

  async execute(input: MoverCardViviInput) {
    const card = await this.cardRepository.findByIdAndTenant(input.cardId, input.tenantId);
    if (!card) {
      throw new NotFoundException(`Card \${input.cardId} nao encontrado.`);
    }

    const stages = await this.prisma.stage.findMany({
      where: { pipelineId: card.pipelineId, tenantId: input.tenantId },
      orderBy: { position: 'asc' },
    });

    const targetStage = stages.find(
      (s) => s.name.toLowerCase() === input.stageName.toLowerCase(),
    );
    if (!targetStage) {
      throw new BadRequestException(
        `Stage "\${input.stageName}" nao encontrada no pipeline do card.`,
      );
    }

    const cardsNaStage = await this.cardRepository.findAllByStage(targetStage.id);

    await this.moveCardUseCase.execute({
      cardId: input.cardId,
      tenantId: input.tenantId,
      targetStageId: targetStage.id,
      targetIndex: cardsNaStage.length,
      requesterRole: 'ADMINISTRADOR',
      requesterCargo: null,
      motivoRepique: input.motivoRepique,
    });

    return { cardId: input.cardId, stageId: targetStage.id, stageName: targetStage.name };
  }
}
