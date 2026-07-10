// src/modules/portal_cliente/application/use-cases/get-meu-atendimento.use-case.ts
// Vinculo por E-MAIL (nao por FK formal) - ver CLAUDE.md, secao Portal do
// Cliente, sobre a limitacao dessa correspondencia.
import { Injectable, Inject } from '@nestjs/common';
import { ICardRepository } from '../../../vendas_kanban/domain/repositories/card-repository.interface';

interface GetMeuAtendimentoInput {
  tenantId: string;
  email: string;
}

export interface MeuAtendimentoResult {
  cardId: string;
  title: string;
  stageName: string | null;
  ownerName: string | null;
}

@Injectable()
export class GetMeuAtendimentoUseCase {
  constructor(@Inject('ICardRepository') private readonly cardRepository: ICardRepository) {}

  async execute(input: GetMeuAtendimentoInput): Promise<MeuAtendimentoResult[]> {
    const cards = await this.cardRepository.findAllByTenantAndEmail(input.tenantId, input.email);

    // So os campos que fazem sentido para o cliente ver - nunca customFields
    // nem notas internas do corretor (ver CLAUDE.md/escopo desta fatia).
    return cards.map((card) => ({
      cardId: card.id,
      title: card.title,
      stageName: card.stageName,
      ownerName: card.ownerName,
    }));
  }
}
