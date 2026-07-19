// src/shared/domain/events/mensagem-recebida.event.ts
// Camada de DOMINIO: contrato de evento agnostico de canal para "mensagem
// recebida" - ver WhatsAppToCanalAdapter (traduz o evento
// 'whatsapp.message.received' ja existente para este formato). Nenhum
// listener consome 'mensagem.recebida' ainda nesta fatia - existe pronto
// para uso futuro (ex: um adapter equivalente para DMs do Instagram
// emitindo o mesmo evento).
import { Canal } from '../enums/canal.enum';

export const MENSAGEM_RECEBIDA_EVENT = 'mensagem.recebida';

export interface MensagemRecebidaEvent {
  canal: Canal;
  tenantId: string;
  // Identificador do remetente no formato NATIVO do canal (JID do
  // WhatsApp, endereco de e-mail, @usuario do Instagram, etc.) -
  // deliberadamente nao normalizado entre canais; cada consumidor futuro
  // decide como interpretar para o seu proprio canal.
  identificadorExterno: string;
  conteudo: string;
  timestamp: Date;
}
