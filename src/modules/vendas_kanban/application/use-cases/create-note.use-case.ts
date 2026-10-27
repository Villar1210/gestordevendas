// src/modules/vendas_kanban/application/use-cases/create-note.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { AcessoCardService, RequisitanteCard } from '../services/acesso-card.service';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { INoteRepository, NoteRecord } from '../../domain/repositories/note-repository.interface';

interface CreateNoteInput {
  tenantId: string;
  cardId: string;
  body: string;
  // Quem pediu (rota HTTP). Ausente = chamada interna do sistema (VIVI,
  // jobs), sem checagem de dono - ver application/services/acesso-card.service.ts.
  requisitante?: RequisitanteCard;
}

@Injectable()
export class CreateNoteUseCase {
  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('INoteRepository') private readonly noteRepository: INoteRepository,
    private readonly acessoCardService: AcessoCardService,
  ) {}

  async execute(input: CreateNoteInput): Promise<NoteRecord> {
    const card = await this.cardRepository.findByIdAndTenant(input.cardId, input.tenantId);
    if (!card) {
      throw new NotFoundException('Card nao encontrado.');
    }

    await this.acessoCardService.garantir(input.tenantId, card.ownerId, input.requisitante, 'alterar');

    return this.noteRepository.create({
      tenantId: input.tenantId,
      cardId: input.cardId,
      body: input.body,
    });
  }
}
