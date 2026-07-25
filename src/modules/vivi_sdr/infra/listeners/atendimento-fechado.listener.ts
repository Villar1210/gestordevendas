// src/modules/vivi_sdr/infra/listeners/atendimento-fechado.listener.ts
// Escuta o evento generico emitido por CloseAtendimentoUseCase (modulo
// atendimento) - sem import direto entre os dois modulos alem do contrato
// de nome do evento/formato do payload, por convencao (mesmo padrao de
// WhatsAppMessageReceivedListener). Ver ReabrirViviAposFechamentoUseCase
// para a logica real.
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ReabrirViviAposFechamentoUseCase } from '../../application/use-cases/reabrir-vivi-apos-fechamento.use-case';

interface AtendimentoFechadoEvent {
  tenantId: string;
  atendimentoId: string;
  whatsappSessionId: string;
  remoteJid: string;
  phoneNumber: string;
}

@Injectable()
export class AtendimentoFechadoListener {
  private readonly logger = new Logger(AtendimentoFechadoListener.name);

  constructor(private readonly reabrirViviAposFechamentoUseCase: ReabrirViviAposFechamentoUseCase) {}

  @OnEvent('atendimento.fechado')
  async handle(event: AtendimentoFechadoEvent): Promise<void> {
    try {
      await this.reabrirViviAposFechamentoUseCase.execute({
        tenantId: event.tenantId,
        whatsappSessionId: event.whatsappSessionId,
        remoteJid: event.remoteJid,
        phoneNumber: event.phoneNumber,
      });
    } catch (error) {
      // Nunca deixa uma falha aqui derrubar o fechamento do atendimento -
      // so registra o erro (mesmo padrao ja usado nos demais listeners).
      this.logger.error(
        `Falha ao tentar liberar a conversa da VIVI apos fechamento do atendimento ${event.atendimentoId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
