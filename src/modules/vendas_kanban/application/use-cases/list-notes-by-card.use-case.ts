// src/modules/vendas_kanban/application/use-cases/list-notes-by-card.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { INoteRepository, NoteRecord } from '../../domain/repositories/note-repository.interface';

interface ListNotesByCardInput {
  tenantId: string;
  cardId: string;
}

@Injectable()
export class ListNotesByCardUseCase {
  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('INoteRepository') private readonly noteRepository: INoteRepository,
  ) {}

  async execute(input: ListNotesByCardInput): Promise<NoteRecord[]> {
    const card = await this.cardRepository.findByIdAndTenant(input.cardId, input.tenantId);
    if (!card) {
      throw new NotFoundException('Card nao encontrado.');
    }

    return this.noteRepository.findAllByCard(input.cardId);
  }
}
