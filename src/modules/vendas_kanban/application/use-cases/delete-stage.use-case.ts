// src/modules/vendas_kanban/application/use-cases/delete-stage.use-case.ts
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { isProtectedStageName } from '../../domain/services/protected-stages';

interface DeleteStageInput {
  stageId: string;
  tenantId: string;
}

@Injectable()
export class DeleteStageUseCase {
  constructor(
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
  ) {}

  async execute(input: DeleteStageInput): Promise<void> {
    const stage = await this.stageRepository.findByIdAndTenant(input.stageId, input.tenantId);
    if (!stage) {
      throw new NotFoundException('Stage nao encontrada.');
    }

    if (isProtectedStageName(stage.name)) {
      throw new BadRequestException(
        `A coluna "${stage.name}" nao pode ser excluida - ela e usada por outras funcionalidades do sistema (Roleta Online ou VIVI).`,
      );
    }

    const cardsInStage = await this.cardRepository.findAllByStage(stage.id);
    if (cardsInStage.length > 0) {
      throw new BadRequestException(
        `A coluna "${stage.name}" tem ${cardsInStage.length} card(s) - mova-os para outra coluna antes de excluir.`,
      );
    }

    await this.stageRepository.delete(stage.id);
  }
}
