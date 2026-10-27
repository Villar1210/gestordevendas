// src/modules/vivi_sdr/infra/listeners/social-message-received.listener.ts
// Escuta o evento agnostico 'mensagem.recebida' (ver
// shared/domain/events/mensagem-recebida.event.ts) e repassa para a VIVI
// SOMENTE quando o canal for INSTAGRAM ou FACEBOOK - WhatsApp continua no
// caminho proprio, direto (WhatsAppMessageReceivedListener escuta
// 'whatsapp.message.received', NAO este evento), sem nenhuma alteracao.
// Isso evita processar a mesma mensagem do WhatsApp duas vezes, ja que
// WhatsAppToCanalAdapter tambem emite 'mensagem.recebida' (canal=WHATSAPP)
// para uso futuro de outros consumidores agnosticos de canal.
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  MensagemRecebidaEvent,
  MENSAGEM_RECEBIDA_EVENT,
} from '../../../../shared/domain/events/mensagem-recebida.event';
import { Canal } from '../../../../shared/domain/enums/canal.enum';
import { ProcessIncomingSocialMessageUseCase } from '../../application/use-cases/process-incoming-social-message.use-case';
import { VIVI_INTERNA_ATIVA } from '../../constants/vivi-interna';
import { EncaminharDmSemViviUseCase } from '../../application/use-cases/encaminhar-dm-sem-vivi.use-case';

@Injectable()
export class SocialMessageReceivedListener {
  private readonly logger = new Logger(SocialMessageReceivedListener.name);

  constructor(
    private readonly processIncomingSocialMessageUseCase: ProcessIncomingSocialMessageUseCase,
    private readonly encaminharDmSemViviUseCase: EncaminharDmSemViviUseCase,
  ) {}

  @OnEvent(MENSAGEM_RECEBIDA_EVENT)
  async handle(event: MensagemRecebidaEvent): Promise<void> {
    if (event.canal !== Canal.INSTAGRAM && event.canal !== Canal.FACEBOOK) {
      return;
    }

    if (!event.contaId) {
      this.logger.warn(
        `[VIVI-SOCIAL] Evento 'mensagem.recebida' (canal=${event.canal}) sem contaId - nao e possivel saber por qual SocialAccount responder, ignorado.`,
      );
      return;
    }

    try {
      // VIVI interna desligada (27/10/2026, ver constants/vivi-interna.ts):
      // a IA nao responde; a primeira DM do contato vira card na Caixa de
      // Entrada para um corretor atender (EncaminharDmSemViviUseCase).
      if (!VIVI_INTERNA_ATIVA) {
        await this.encaminharDmSemViviUseCase.execute({
          tenantId: event.tenantId,
          canal: event.canal,
          socialAccountId: event.contaId,
          identificadorExterno: event.identificadorExterno,
          mensagem: event.conteudo,
        });
        return;
      }

      await this.processIncomingSocialMessageUseCase.execute({
        tenantId: event.tenantId,
        canal: event.canal,
        socialAccountId: event.contaId,
        identificadorExterno: event.identificadorExterno,
        mensagem: event.conteudo,
      });
    } catch (error) {
      this.logger.error(
        `Falha ao processar DM social (canal ${event.canal}, conta ${event.contaId}): ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
