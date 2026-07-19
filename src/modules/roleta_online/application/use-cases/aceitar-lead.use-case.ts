// src/modules/roleta_online/application/use-cases/aceitar-lead.use-case.ts
// Corretor clica em "Aceitar Lead" apos uma atribuicao automatica da
// Roleta Online (modo automatico) - confirma que vai atender antes do
// timeout (ver ProcessRoletaTimeoutsUseCase) reatribuir para o proximo da
// fila. Mesmo padrao de permissao do ConfirmSuggestedOwnerUseCase (proprio
// dono ou Administrador).
import { Injectable, Inject, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ICardRepository, CardRecord } from '../../../vendas_kanban/domain/repositories/card-repository.interface';

interface AceitarLeadInput {
  cardId: string;
  tenantId: string;
  requesterUserId: string;
  requesterRole: string;
}

@Injectable()
export class AceitarLeadUseCase {
  constructor(@Inject('ICardRepository') private readonly cardRepository: ICardRepository) {}

  async execute(input: AceitarLeadInput): Promise<CardRecord> {
    const card = await this.cardRepository.findByIdAndTenant(input.cardId, input.tenantId);
    if (!card) {
      throw new NotFoundException('Card nao encontrado.');
    }

    if (!card.atribuidoAutomaticamenteEm) {
      throw new BadRequestException('Este card nao esta aguardando aceite da Roleta Online.');
    }

    // Ja aceito (ex: clique duplo) - idempotente, so devolve o card como esta.
    if (card.aceitoEm) {
      return card;
    }

    if (input.requesterRole !== 'Administrador' && input.requesterUserId !== card.ownerId) {
      throw new ForbiddenException('Somente o corretor atribuido ou um Administrador pode aceitar este lead.');
    }

    return this.cardRepository.aceitarLead(input.cardId, new Date());
  }
}
