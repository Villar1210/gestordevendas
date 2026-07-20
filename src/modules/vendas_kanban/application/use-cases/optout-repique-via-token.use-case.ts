// src/modules/vendas_kanban/application/use-cases/optout-repique-via-token.use-case.ts
// Consumido pelo endpoint publico (GET /public/repique/descadastro/:token,
// sem autenticacao - o token e a propria fronteira de seguranca, mesmo
// padrao ja usado pelo modulo E-doc para o link de assinatura). Idempotente
// (marcar opt-out de novo nao e erro) e nunca revela se um token especifico
// existiu ou nao - so "encontrado"/"nao encontrado", sem detalhe do lead.
import { Injectable, Inject } from '@nestjs/common';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';

interface OptOutRepiqueViaTokenInput {
  token: string;
}

interface OptOutRepiqueViaTokenOutput {
  encontrado: boolean;
}

@Injectable()
export class OptOutRepiqueViaTokenUseCase {
  constructor(@Inject('ICardRepository') private readonly cardRepository: ICardRepository) {}

  async execute(input: OptOutRepiqueViaTokenInput): Promise<OptOutRepiqueViaTokenOutput> {
    const card = await this.cardRepository.findByRepiqueOptOutToken(input.token);
    if (!card) {
      return { encontrado: false };
    }

    if (!card.repiqueOptOut) {
      await this.cardRepository.markRepiqueOptOut(card.id);
    }

    return { encontrado: true };
  }
}
