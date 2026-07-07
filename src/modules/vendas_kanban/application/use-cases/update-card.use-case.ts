// src/modules/vendas_kanban/application/use-cases/update-card.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { ICardRepository, CardRecord } from '../../domain/repositories/card-repository.interface';

interface UpdateCardInput {
  cardId: string;
  tenantId: string;
  title?: string;
  value?: number;
  phone?: string | null;
  temperatura?: string | null;
  email?: string | null;
  endereco?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cep?: string | null;
  imovelId?: string | null;
  customFields?: Record<string, unknown>;
}

@Injectable()
export class UpdateCardUseCase {
  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
  ) {}

  async execute(input: UpdateCardInput): Promise<CardRecord> {
    const card = await this.cardRepository.findByIdAndTenant(input.cardId, input.tenantId);
    if (!card) {
      throw new NotFoundException('Card nao encontrado.');
    }

    return this.cardRepository.update(card.id, {
      title: input.title,
      value: input.value,
      phone: input.phone,
      temperatura: input.temperatura,
      email: input.email,
      endereco: input.endereco,
      numero: input.numero,
      complemento: input.complemento,
      bairro: input.bairro,
      cep: input.cep,
      imovelId: input.imovelId,
      customFields: input.customFields,
    });
  }
}
