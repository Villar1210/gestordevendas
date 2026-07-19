// src/shared/infra/listeners/whatsapp-to-canal.adapter.ts
// So TRADUZ o evento 'whatsapp.message.received' (ja existente, emitido por
// BaileysWhatsAppProvider - ver whatsappmarketing) para o formato agnostico
// de canal 'mensagem.recebida' (ver mensagem-recebida.event.ts). NAO altera
// nem substitui o evento original - WhatsAppMessageReceivedListener
// (modulo vivi_sdr) continua escutando 'whatsapp.message.received'
// normalmente, sem nenhuma mudanca. Nenhum listener consome
// 'mensagem.recebida' ainda - infraestrutura pronta para uso futuro.
import { Injectable } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { Canal } from '../../domain/enums/canal.enum';
import { MensagemRecebidaEvent, MENSAGEM_RECEBIDA_EVENT } from '../../domain/events/mensagem-recebida.event';

// Mesmo formato (nao importado, ver convencao ja documentada em
// WhatsAppMessageReceivedListener) do payload emitido por
// BaileysWhatsAppProvider.
interface WhatsAppMessageReceivedEvent {
  tenantId: string;
  sessionId: string;
  phoneNumber: string;
  remoteJid: string;
  messageBody: string;
}

@Injectable()
export class WhatsAppToCanalAdapter {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  @OnEvent('whatsapp.message.received')
  handle(event: WhatsAppMessageReceivedEvent): void {
    const mensagemRecebida: MensagemRecebidaEvent = {
      canal: Canal.WHATSAPP,
      tenantId: event.tenantId,
      identificadorExterno: event.remoteJid,
      conteudo: event.messageBody,
      timestamp: new Date(),
    };

    this.eventEmitter.emit(MENSAGEM_RECEBIDA_EVENT, mensagemRecebida);
  }
}
