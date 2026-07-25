// src/modules/whatsappmarketing/domain/services/select-recoverable-history-messages.ts
// Camada de DOMINIO: funcao pura, sem Prisma/Baileys/infra.
//
// Decide quais mensagens de um lote 'messaging-history.set' (Baileys) devem
// ser tratadas como "recem-perdidas por desconexao" e reprocessadas pela
// pipeline normal (VIVI/Central de Atendimento) - ver CLAUDE.md "Bug
// confirmado: lacuna de captura de mensagem durante desconexao".
//
// RECENT_HISTORY_SYNC_TYPE = 3 e o valor numerico de
// proto.HistorySync.HistorySyncType.RECENT (node_modules/baileys/WAProto) -
// copiado aqui como constante, em vez de importar o enum do pacote
// "baileys", para o dominio nao depender de uma biblioteca externa (ver
// CLAUDE.md "Mantenha a separacao de camadas"). So esse syncType e aceito:
// INITIAL_BOOTSTRAP/FULL (pareamento novo, historico completo antigo) e
// ON_DEMAND (scroll manual do usuario) NUNCA devem cair aqui - processa-los
// como "mensagem nova" inundaria a VIVI/Atendimento com conversas antigas.
export const RECENT_HISTORY_SYNC_TYPE = 3;

// Janela de recuperacao: 6 horas. Cobre desconexoes curtas/restarts do
// backend (o cenario real que motivou esta correcao) sem arriscar
// reprocessar um gap de desconexao muito mais longo como se fosse mensagem
// nova - decisao confirmada com o usuario, nao inferida do codigo.
export const HISTORY_RECOVERY_WINDOW_MS = 6 * 60 * 60 * 1000;

export interface RecoverableHistoryCandidate {
  // Posicao da mensagem no array original recebido do Baileys - usada pelo
  // chamador (infra) para localizar de volta o WAMessage completo (corpo,
  // pushName, etc.) sem essa funcao de dominio precisar conhecer o tipo
  // WAMessage inteiro.
  index: number;
  // msg.key.id - pode ser nulo/ausente em mensagens raras; sem ele, dedupe
  // por ID nao e possivel para essa mensagem especifica (ainda assim ela e
  // considerada elegivel, so nao pode ser comparada contra
  // existingBaileysMessageIds).
  baileysMessageId: string | null;
  remoteJid: string;
  fromMe: boolean;
  // Resultado de getContentType(msg.message) - so 'conversation'/
  // 'extendedTextMessage' sao texto real (mesmo filtro ja usado em
  // messages.upsert, ver BaileysWhatsAppProvider).
  contentType: string | undefined;
  timestampSeconds: number;
}

export interface SelectRecoverableHistoryMessagesInput {
  syncType: number | undefined;
  candidates: RecoverableHistoryCandidate[];
  nowMs: number;
  windowMs: number;
  // IDs (msg.key.id) de mensagens ja gravadas nesta sessao - evita
  // reprocessar algo que ja chegou normalmente via messages.upsert.
  existingBaileysMessageIds: ReadonlySet<string>;
}

// Retorna as mensagens elegiveis, em ordem CRONOLOGICA (mais antiga
// primeiro) - a pipeline (VIVI/Atendimento) precisa processar nessa ordem
// para o historico de conversa fazer sentido.
export function selectRecoverableHistoryMessages(
  input: SelectRecoverableHistoryMessagesInput,
): RecoverableHistoryCandidate[] {
  if (input.syncType !== RECENT_HISTORY_SYNC_TYPE) {
    return [];
  }

  const cutoffSeconds = (input.nowMs - input.windowMs) / 1000;

  return input.candidates
    .filter((candidate) => !candidate.fromMe)
    .filter(
      (candidate) =>
        !candidate.remoteJid.endsWith('@g.us') && !candidate.remoteJid.endsWith('@broadcast'),
    )
    .filter(
      (candidate) =>
        candidate.contentType === 'conversation' || candidate.contentType === 'extendedTextMessage',
    )
    .filter((candidate) => candidate.timestampSeconds >= cutoffSeconds)
    .filter(
      (candidate) =>
        !candidate.baileysMessageId ||
        !input.existingBaileysMessageIds.has(candidate.baileysMessageId),
    )
    .sort((a, b) => a.timestampSeconds - b.timestampSeconds);
}
