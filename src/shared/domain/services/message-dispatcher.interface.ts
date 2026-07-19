// src/shared/domain/services/message-dispatcher.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Baileys, Resend,
// Twilio, etc. Abstracao ADITIVA (ver CLAUDE.md) - nao substitui
// SendWhatsAppMessageUseCase nem IEmailSender, so os reaproveita por baixo
// (ver MessageDispatcherService). Pensada para features novas (a comecar
// pelo job de Repique) que precisam mandar mensagem sem se acoplar
// diretamente a um canal especifico.
import { Canal } from '../enums/canal.enum';

export interface EnviarMensagemInput {
  canal: Canal;
  tenantId: string;
  // Numero/JID (WHATSAPP), endereco de e-mail (EMAIL), etc. - formato
  // nativo do canal, nao normalizado.
  destinatario: string;
  conteudo: string;
  // Especifico do canal WHATSAPP - qual sessao usar para enviar
  // (obrigatorio quando canal === Canal.WHATSAPP; SendWhatsAppMessageUseCase
  // exige isso hoje - ver MessageDispatcherService).
  whatsappSessionId?: string;
  // Especifico do canal EMAIL - assunto (obrigatorio quando canal === Canal.EMAIL).
  assunto?: string;
}

export interface IMessageDispatcher {
  enviar(input: EnviarMensagemInput): Promise<void>;
}
