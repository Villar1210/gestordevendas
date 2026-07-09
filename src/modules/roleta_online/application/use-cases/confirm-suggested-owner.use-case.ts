// src/modules/roleta_online/application/use-cases/confirm-suggested-owner.use-case.ts
// Confirma a sugestao da Roleta Online (modo semi_automatico): mesma logica
// de "assumir o lead" do ClaimCardUseCase, so que o novo dono e o
// suggestedOwnerId gravado no card, nao necessariamente quem esta logado.
import { Injectable, Inject, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { ICardRepository, CardRecord } from '../../../vendas_kanban/domain/repositories/card-repository.interface';
import { ClaimCardUseCase } from '../../../vendas_kanban/application/use-cases/claim-card.use-case';

interface ConfirmSuggestedOwnerInput {
  cardId: string;
  tenantId: string;
  requesterUserId: string;
  requesterRole: string;
}

@Injectable()
export class ConfirmSuggestedOwnerUseCase {
  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    private readonly claimCardUseCase: ClaimCardUseCase,
  ) {}

  async execute(input: ConfirmSuggestedOwnerInput): Promise<CardRecord> {
    const card = await this.cardRepository.findByIdAndTenant(input.cardId, input.tenantId);
    if (!card) {
      throw new NotFoundException('Card nao encontrado.');
    }

    if (!card.suggestedOwnerId) {
      throw new ConflictException('Este card nao tem nenhuma sugestao da Roleta Online pendente.');
    }

    // So o proprio corretor sugerido ou um Administrador podem confirmar.
    if (input.requesterRole !== 'Administrador' && input.requesterUserId !== card.suggestedOwnerId) {
      throw new ForbiddenException(
        'Somente o corretor sugerido ou um Administrador pode confirmar esta atribuicao.',
      );
    }

    await this.claimCardUseCase.execute({
      cardId: input.cardId,
      tenantId: input.tenantId,
      userId: card.suggestedOwnerId,
    });

    // Limpa a sugestao agora que virou dono de verdade.
    return this.cardRepository.updateSuggestedOwner(input.cardId, null);
  }
}
