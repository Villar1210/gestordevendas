// src/modules/atendimento/application/use-cases/get-atendimento-detail.use-case.ts
import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import {
  IAtendimentoRepository,
  AtendimentoRecord,
} from '../../domain/repositories/atendimento-repository.interface';
import { IFilaRepository } from '../../domain/repositories/fila-repository.interface';
import {
  IAtendimentoEventoRepository,
  AtendimentoEventoRecord,
} from '../../domain/repositories/atendimento-evento-repository.interface';
import {
  IWhatsAppMessageRepository,
  WhatsAppMessageRecord,
} from '../../../whatsappmarketing/domain/repositories/whatsapp-message-repository.interface';
import { GetSubordinadosRecursivosUseCase } from '../../../auth/application/use-cases/get-subordinados-recursivos.use-case';
import { GetCorretoresEscaladosHojeUseCase } from '../../../plantao/application/use-cases/get-corretores-escalados-hoje.use-case';
import { resolveEscopo } from '../../../../shared/domain/services/cargo-escopo';

interface GetAtendimentoDetailInput {
  tenantId: string;
  atendimentoId: string;
  requesterRole: string;
  requesterUserId: string;
  requesterCargo: string | null;
  requesterStandId: string | null;
}

export interface GetAtendimentoDetailResult {
  atendimento: AtendimentoRecord;
  eventos: AtendimentoEventoRecord[];
  mensagens: WhatsAppMessageRecord[];
}

// Historico completo cabe folgado num limite alto - Atendimento nao e uma
// conversa longa e continua como a da VIVI (fecha e reabre por ciclo de
// atendimento), diferente do HISTORY_LIMIT=21 usado la.
const MESSAGE_HISTORY_LIMIT = 200;

@Injectable()
export class GetAtendimentoDetailUseCase {
  constructor(
    @Inject('IAtendimentoRepository')
    private readonly atendimentoRepository: IAtendimentoRepository,
    @Inject('IFilaRepository') private readonly filaRepository: IFilaRepository,
    @Inject('IAtendimentoEventoRepository')
    private readonly eventoRepository: IAtendimentoEventoRepository,
    @Inject('IWhatsAppMessageRepository')
    private readonly whatsAppMessageRepository: IWhatsAppMessageRepository,
    private readonly getSubordinadosRecursivosUseCase: GetSubordinadosRecursivosUseCase,
    private readonly getCorretoresEscaladosHojeUseCase: GetCorretoresEscaladosHojeUseCase,
  ) {}

  async execute(input: GetAtendimentoDetailInput): Promise<GetAtendimentoDetailResult> {
    const atendimento = await this.atendimentoRepository.findByIdAndTenant(
      input.atendimentoId,
      input.tenantId,
    );
    if (!atendimento) {
      throw new NotFoundException('Atendimento nao encontrado.');
    }

    // Escopo por cargo hierarquico (RBAC) SOMADO ao acesso por fila ja
    // existente (nao substitui) - mesma logica de ListAtendimentosUseCase.
    const escopo = resolveEscopo(input.requesterRole, input.requesterCargo);
    if (escopo !== 'todos') {
      let idsPermitidos = [input.requesterUserId];
      if (escopo === 'equipe') {
        const subordinados = await this.getSubordinadosRecursivosUseCase.execute({
          tenantId: input.tenantId,
          userId: input.requesterUserId,
        });
        idsPermitidos = [input.requesterUserId, ...subordinados];
      } else if (escopo === 'plantao') {
        idsPermitidos = await this.getCorretoresEscaladosHojeUseCase.execute({
          standId: input.requesterStandId,
        });
      }

      const isOwner = !!atendimento.ownerId && idsPermitidos.includes(atendimento.ownerId);
      const belongsToFila =
        !!atendimento.filaId &&
        (await this.filaRepository.isUsuarioInFila(atendimento.filaId, input.requesterUserId));
      if (!isOwner && !belongsToFila) {
        throw new ForbiddenException('Voce nao tem acesso a este atendimento.');
      }
    }

    const [eventos, mensagens] = await Promise.all([
      this.eventoRepository.findAllByAtendimento(atendimento.id),
      this.whatsAppMessageRepository.findRecentBySessionAndNumber(
        atendimento.whatsappSessionId,
        atendimento.phoneNumber,
        MESSAGE_HISTORY_LIMIT,
      ),
    ]);

    return { atendimento, eventos, mensagens };
  }
}
