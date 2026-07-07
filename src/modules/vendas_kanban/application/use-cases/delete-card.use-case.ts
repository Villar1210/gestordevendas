// src/modules/vendas_kanban/application/use-cases/delete-card.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';

interface DeleteCardInput {
  cardId: string;
  tenantId: string;
}

@Injectable()
export class DeleteCardUseCase {
  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
  ) {}

  async execute(input: DeleteCardInput): Promise<void> {
    const card = await this.cardRepository.findByIdAndTenant(input.cardId, input.tenantId);
    if (!card) {
      throw new NotFoundException('Card nao encontrado.');
    }

    await this.cardRepository.delete(card.id);
  }
}
