// Lacuna de captura durante desconexao (ver CLAUDE.md "Bug confirmado...")
// - selectRecoverableHistoryMessages e a funcao pura de dominio que decide
// quais mensagens de um lote messaging-history.set viram "mensagem nova"
// para a pipeline (VIVI/Central de Atendimento). Testado isoladamente, sem
// Baileys/Prisma real - a integracao (BaileysWhatsAppProvider mapeando
// WAMessage[] para RecoverableHistoryCandidate[]) e so wiring, coberta pelo
// tsc --noEmit.
import {
  RECENT_HISTORY_SYNC_TYPE,
  RecoverableHistoryCandidate,
  selectRecoverableHistoryMessages,
} from './select-recoverable-history-messages';

const NOW_MS = new Date('2026-07-25T18:00:00.000Z').getTime();
const WINDOW_MS = 6 * 60 * 60 * 1000; // 6h, mesmo valor usado em producao

function buildCandidate(
  overrides: Partial<RecoverableHistoryCandidate> & { index: number },
): RecoverableHistoryCandidate {
  return {
    baileysMessageId: `msg-${overrides.index}`,
    remoteJid: '5511966111740@s.whatsapp.net',
    fromMe: false,
    contentType: 'conversation',
    timestampSeconds: NOW_MS / 1000,
    ...overrides,
  };
}

describe('selectRecoverableHistoryMessages', () => {
  it('syncType diferente de RECENT: nunca processa nada, mesmo com candidatos elegiveis em tudo o mais', () => {
    const candidates = [buildCandidate({ index: 0 })];

    const result = selectRecoverableHistoryMessages({
      syncType: 2, // FULL
      candidates,
      nowMs: NOW_MS,
      windowMs: WINDOW_MS,
      existingBaileysMessageIds: new Set(),
    });

    expect(result).toEqual([]);
  });

  it('mensagem DENTRO da janela de tempo (1h atras): mantida', () => {
    const oneHourAgoSeconds = (NOW_MS - 60 * 60 * 1000) / 1000;
    const candidates = [buildCandidate({ index: 0, timestampSeconds: oneHourAgoSeconds })];

    const result = selectRecoverableHistoryMessages({
      syncType: RECENT_HISTORY_SYNC_TYPE,
      candidates,
      nowMs: NOW_MS,
      windowMs: WINDOW_MS,
      existingBaileysMessageIds: new Set(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].index).toBe(0);
  });

  it('mensagem FORA da janela de tempo (10h atras, janela de 6h): descartada - nao e tratada como "nova"', () => {
    const tenHoursAgoSeconds = (NOW_MS - 10 * 60 * 60 * 1000) / 1000;
    const candidates = [buildCandidate({ index: 0, timestampSeconds: tenHoursAgoSeconds })];

    const result = selectRecoverableHistoryMessages({
      syncType: RECENT_HISTORY_SYNC_TYPE,
      candidates,
      nowMs: NOW_MS,
      windowMs: WINDOW_MS,
      existingBaileysMessageIds: new Set(),
    });

    expect(result).toEqual([]);
  });

  it('mensagem com baileysMessageId ja existente (capturada via messages.upsert normal): dedupe descarta', () => {
    const candidates = [
      buildCandidate({ index: 0, baileysMessageId: 'ja-existe' }),
      buildCandidate({ index: 1, baileysMessageId: 'nova' }),
    ];

    const result = selectRecoverableHistoryMessages({
      syncType: RECENT_HISTORY_SYNC_TYPE,
      candidates,
      nowMs: NOW_MS,
      windowMs: WINDOW_MS,
      existingBaileysMessageIds: new Set(['ja-existe']),
    });

    expect(result).toHaveLength(1);
    expect(result[0].baileysMessageId).toBe('nova');
  });

  it('preserva ordem CRONOLOGICA (mais antiga primeiro), independente da ordem de chegada no lote', () => {
    const candidates = [
      buildCandidate({ index: 0, timestampSeconds: NOW_MS / 1000 - 100 }), // mais recente
      buildCandidate({ index: 1, timestampSeconds: NOW_MS / 1000 - 300 }), // mais antiga
      buildCandidate({ index: 2, timestampSeconds: NOW_MS / 1000 - 200 }), // meio
    ];

    const result = selectRecoverableHistoryMessages({
      syncType: RECENT_HISTORY_SYNC_TYPE,
      candidates,
      nowMs: NOW_MS,
      windowMs: WINDOW_MS,
      existingBaileysMessageIds: new Set(),
    });

    expect(result.map((c) => c.index)).toEqual([1, 2, 0]);
  });

  it('reaproveita os mesmos filtros de messages.upsert: grupo (@g.us), broadcast e conteudo de protocolo sao descartados', () => {
    const candidates = [
      buildCandidate({ index: 0, remoteJid: '123456@g.us' }),
      buildCandidate({ index: 1, remoteJid: 'status@broadcast' }),
      buildCandidate({ index: 2, contentType: 'senderKeyDistributionMessage' }),
      buildCandidate({ index: 3, fromMe: true }),
      buildCandidate({ index: 4 }), // unica valida
    ];

    const result = selectRecoverableHistoryMessages({
      syncType: RECENT_HISTORY_SYNC_TYPE,
      candidates,
      nowMs: NOW_MS,
      windowMs: WINDOW_MS,
      existingBaileysMessageIds: new Set(),
    });

    expect(result).toHaveLength(1);
    expect(result[0].index).toBe(4);
  });
});
