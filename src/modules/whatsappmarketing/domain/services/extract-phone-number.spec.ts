// Bug do @lid (ver CLAUDE.md) - regressao: numero exibido/gravado errado
// quando o remetente usa um JID @lid em vez de @s.whatsapp.net. Unitario:
// extractPhoneNumber e uma funcao pura de dominio, sem Baileys/Prisma real
// envolvido - a integracao real (msg.key.senderPn no messages.upsert do
// BaileysWhatsAppProvider) e so 1 linha de wiring, ja coberta pelo
// tsc --noEmit; o que precisa de protecao contra regressao e a LOGICA de
// qual fonte preferir, testada aqui.
import { extractPhoneNumber } from './extract-phone-number';

describe('extractPhoneNumber', () => {
  it('mensagem NORMAL (@s.whatsapp.net), sem senderPn: extrai os digitos do proprio JID (comportamento inalterado)', () => {
    const remoteJid = '5511966111740@s.whatsapp.net';
    expect(extractPhoneNumber(remoteJid)).toBe('5511966111740');
    expect(extractPhoneNumber(remoteJid, null)).toBe('5511966111740');
    expect(extractPhoneNumber(remoteJid, undefined)).toBe('5511966111740');
  });

  it('mensagem via @lid COM senderPn disponivel: prefere o numero real, ignora os digitos do lid', () => {
    const remoteJidLid = '99961119199259@lid';
    const senderPn = '5511966111740@s.whatsapp.net';
    expect(extractPhoneNumber(remoteJidLid, senderPn)).toBe('5511966111740');
  });

  it('mensagem via @lid SEM senderPn disponivel: cai no fallback historico (digitos do proprio lid) - limitacao conhecida, nao uma regressao', () => {
    const remoteJidLid = '99961119199259@lid';
    expect(extractPhoneNumber(remoteJidLid, null)).toBe('99961119199259');
    expect(extractPhoneNumber(remoteJidLid)).toBe('99961119199259');
  });

  it('senderPn vazio (string vazia) e tratado como ausente - cai no fallback do JID principal', () => {
    const remoteJid = '5511966111740@s.whatsapp.net';
    expect(extractPhoneNumber(remoteJid, '')).toBe('5511966111740');
  });

  it('participantPn como segundo argumento (mesmo parametro, uso em grupo) tambem e preferido ao JID principal', () => {
    const remoteJidLid = '99961119199259@lid';
    const participantPn = '5511988887777@s.whatsapp.net';
    expect(extractPhoneNumber(remoteJidLid, participantPn)).toBe('5511988887777');
  });
});
