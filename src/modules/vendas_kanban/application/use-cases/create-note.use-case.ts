// src/modules/vendas_kanban/application/use-cases/create-note.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { INoteRepository, NoteRecord } from '../../domain/repositories/note-repository.interface';

interface CreateNoteInput {
  tenantId: string;
  cardId: string;
  body: string;
}

@Injectable()
export class CreateNoteUseCase {
  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('INoteRepository') private readonly noteRepository: INoteRepository,
  ) {}

  async execute(input: CreateNoteInput): Promise<NoteRecord> {
    const card = await this.cardRepository.findByIdAndTenant(input.cardId, input.tenantId);
    if (!card) {
      throw new NotFoundException('Card nao encontrado.');
    }

    return this.noteRepository.create({
      tenantId: input.tenantId,
      cardId: input.cardId,
      body: input.body,
    });
  }
}
