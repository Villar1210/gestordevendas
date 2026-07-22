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
  // Id da conta/sessao do NOSSO lado que recebeu a mensagem (WhatsAppSession.id,
  // SocialAccount.id, etc.) - necessario para responder quando um tenant
  // pode ter mais de uma conta conectada no mesmo canal (ex: 2 Paginas do
  // Facebook), ja que so identificadorExterno (o remetente) nao basta para
  // saber por qual conta enviar a resposta. Opcional para nao quebrar
  // nenhum consumidor hipotetico que ja dependesse do formato anterior -
  // preencher sempre que o canal tiver mais de uma conta possivel.
  contaId?: string;
}
