// src/modules/whatsappmarketing/domain/services/extract-phone-number.ts
// Camada de DOMINIO: funcao pura, sem Prisma/Baileys/infra.
//
// Extrai o numero de telefone (so digitos) de um JID do WhatsApp. Corrige o
// bug do @lid (ver CLAUDE.md): remoteJid.split('@')[0] direto, sem checar o
// sufixo, pegava o identificador interno do @lid (nao um MSISDN valido)
// quando o WhatsApp decide nao revelar o numero real do contato por
// privacidade - o numero exibido/gravado ficava visivelmente errado (ex:
// "99961119199259" em vez de "11966111740", confirmado em producao).
//
// `preferredPnJid` e o JID "real" (formato de numero de telefone,
// @s.whatsapp.net), quando o Baileys o disponibiliza separadamente do JID
// principal - ver msg.key.senderPn/participantPn (WAMessageKey,
// node_modules/baileys/lib/Types/Message.d.ts), populados a partir dos
// atributos sender_pn/participant_pn que o proprio servidor do WhatsApp as
// vezes inclui no stanza junto com o @lid. Quando disponivel, e SEMPRE
// preferido ao JID principal. Sem ele (Baileys nao forneceu o numero real
// desta vez), cai no comportamento historico - extrai os digitos do proprio
// JID recebido, mesmo que seja um LID - unica opcao quando nao ha numero
// real conhecido.
//
// NOTA PARA O FUTURO (fora do escopo desta correcao): o Baileys emite um
// evento proprio `chats.phoneNumberShare` (ver
// node_modules/baileys/lib/Socket/messages-recv.js) quando o WhatsApp
// revela o numero real de um contato @lid no MEIO de uma conversa ja em
// andamento - hoje este provider nao escuta esse evento. Efeito colateral
// conhecido: se isso acontecer, Atendimento/ViviConversation (localizados
// por phoneNumber) tratariam o mesmo contato como dois diferentes (um pelo
// LID antigo, outro pelo numero real novo), fragmentando o historico.
// Escutar esse evento e "religar" os registros existentes exigiria mudanca
// de schema/use cases - avaliar numa fatia dedicada se isso incomodar na
// pratica.
export function extractPhoneNumber(jid: string, preferredPnJid?: string | null): string {
  const source = preferredPnJid || jid;
  return source.split('@')[0];
}
