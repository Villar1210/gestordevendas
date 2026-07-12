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

interface GetAtendimentoDetailInput {
  tenantId: string;
  atendimentoId: string;
  requesterRole: string;
  requesterUserId: string;
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
  ) {}

  async execute(input: GetAtendimentoDetailInput): Promise<GetAtendimentoDetailResult> {
    const atendimento = await this.atendimentoRepository.findByIdAndTenant(
      input.atendimentoId,
      input.tenantId,
    );
    if (!atendimento) {
      throw new NotFoundException('Atendimento nao encontrado.');
    }

    if (input.requesterRole !== 'Administrador') {
      const isOwner = atendimento.ownerId === input.requesterUserId;
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
