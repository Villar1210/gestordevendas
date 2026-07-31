// src/modules/atendimento/application/use-cases/close-atendimento.use-case.ts
import { Injectable, Inject, Logger, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  IAtendimentoRepository,
  AtendimentoRecord,
} from '../../domain/repositories/atendimento-repository.interface';
import { IAtendimentoEventoRepository } from '../../domain/repositories/atendimento-evento-repository.interface';

interface CloseAtendimentoInput {
  tenantId: string;
  atendimentoId: string;
  requesterId: string;
  requesterRole: string;
  motivo?: string | null;
}

@Injectable()
export class CloseAtendimentoUseCase {
  private readonly logger = new Logger(CloseAtendimentoUseCase.name);

  constructor(
    @Inject('IAtendimentoRepository')
    private readonly atendimentoRepository: IAtendimentoRepository,
    @Inject('IAtendimentoEventoRepository')
    private readonly eventoRepository: IAtendimentoEventoRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: CloseAtendimentoInput): Promise<AtendimentoRecord> {
    const atendimento = await this.atendimentoRepository.findByIdAndTenant(
      input.atendimentoId,
      input.tenantId,
    );
    if (!atendimento) {
      throw new NotFoundException('Atendimento nao encontrado.');
    }
    if (atendimento.status === 'fechado') {
      throw new ConflictException('Este atendimento ja foi fechado.');
    }
    if (input.requesterRole !== 'Administrador' && atendimento.ownerId !== input.requesterId) {
      throw new ForbiddenException('Apenas o Administrador ou o dono do atendimento pode fecha-lo.');
    }

    const motivo = input.motivo?.trim() || null;
    const updated = await this.atendimentoRepository.update(atendimento.id, {
      status: 'fechado',
      motivoFechamento: motivo,
      closedAt: new Date(),
    });

    await this.eventoRepository.create({
      atendimentoId: atendimento.id,
      tipo: 'fechado',
      userId: input.requesterId,
      detalhe: motivo,
    });

    // Evento generico, sem conhecer quem escuta - o modulo vivi_sdr usa
    // isso para reabrir a conversa da VIVI quando ela tinha sido
    // encaminhada para fila por uma falha tecnica (nao uma decisao de
    // negocio), ver ReabrirViviAposFechamentoUseCase. atendimento NAO
    // importa vivi_sdr de volta (mesmo padrao ja usado por
    // 'atendimento.classificado', ver CLAUDE.md sobre organizacao por
    // modulo).
    this.eventEmitter.emit('atendimento.fechado', {
      tenantId: input.tenantId,
      atendimentoId: atendimento.id,
      whatsappSessionId: atendimento.whatsappSessionId,
      remoteJid: atendimento.remoteJid,
      phoneNumber: atendimento.phoneNumber,
      motivoFechamento: motivo,
    });

    this.logger.log(
      `[Atendimento] Atendimento ${atendimento.id} fechado por ${input.requesterId}${motivo ? ` (motivo: ${motivo})` : ''}.`,
    );
    return updated;
  }
}
