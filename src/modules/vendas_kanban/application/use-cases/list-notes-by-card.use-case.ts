// src/modules/vendas_kanban/application/use-cases/list-notes-by-card.use-case.ts
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { INoteRepository, NoteRecord } from '../../domain/repositories/note-repository.interface';
import {
  REMARKETING_PIPELINE_NOME,
  podeAcessarPipelineRemarketing,
} from '../../domain/services/remarketing-pipeline';

interface ListNotesByCardInput {
  tenantId: string;
  cardId: string;
  requesterRole: string;
  requesterCargo: string | null;
}

@Injectable()
export class ListNotesByCardUseCase {
  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
    @Inject('INoteRepository') private readonly noteRepository: INoteRepository,
  ) {}

  async execute(input: ListNotesByCardInput): Promise<NoteRecord[]> {
    const card = await this.cardRepository.findByIdAndTenant(input.cardId, input.tenantId);
    if (!card) {
      throw new NotFoundException('Card nao encontrado.');
    }

    const pipeline = await this.pipelineRepository.findByIdAndTenant(card.pipelineId, input.tenantId);
    if (
      pipeline?.name === REMARKETING_PIPELINE_NOME &&
      !podeAcessarPipelineRemarketing(input.requesterRole, input.requesterCargo)
    ) {
      throw new ForbiddenException('Voce nao tem acesso a este funil.');
    }

    return this.noteRepository.findAllByCard(input.cardId);
  }
}
