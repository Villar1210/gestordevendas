// src/modules/campanhas_sms/infra/http/zenvia-evento.ts
// Traduz o corpo do webhook da Zenvia (v2) para o nosso EventoSms.
// MESSAGE_STATUS: { type, messageId, messageStatus: { code, description } }
// MESSAGE (resposta): { type, message: { direction: 'IN', from, contents: [{ type: 'text', text }] } }
// Qualquer outra coisa (ou formato inesperado) -> null (ignorado).
import type { EventoSms } from '../../application/use-cases/publicos.use-cases';

const STATUS: Record<string, 'entregue' | 'falhou' | 'enviado'> = {
  DELIVERED: 'entregue',
  READ: 'entregue',
  NOT_DELIVERED: 'falhou',
  REJECTED: 'falhou',
  SENT: 'enviado',
};

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function traduzirEventoZenvia(corpo: unknown): EventoSms | null {
  const c = obj(corpo);
  if (!c) return null;
  if (c.type === 'MESSAGE_STATUS') {
    const st = obj(c.messageStatus);
    const codigo = typeof st?.code === 'string' ? st.code.toUpperCase() : '';
    const status = STATUS[codigo];
    const id = typeof c.messageId === 'string' ? c.messageId : '';
    if (!status || !id) return null;
    const descricao = typeof st?.description === 'string' ? st.description.replace(/\d{8,}/g, '***').slice(0, 200) : undefined;
    return { tipo: 'status', provedorMensagemId: id, status, descricao };
  }
  if (c.type === 'MESSAGE') {
    const m = obj(c.message);
    if (!m || (m.direction !== undefined && m.direction !== 'IN')) return null;
    const de = typeof m.from === 'string' ? m.from : '';
    const conteudos = Array.isArray(m.contents) ? m.contents : [];
    const texto = conteudos
      .map((x) => obj(x))
      .filter((x): x is Record<string, unknown> => !!x && x.type === 'text' && typeof x.text === 'string')
      .map((x) => String(x.text))
      .join(' ');
    if (!de) return null;
    return { tipo: 'resposta', de, texto };
  }
  return null;
}
