// WhatsApp integrado - Etapa 1, parte 2 (19/11/2026). Funcoes PURAS do
// webhook do Chatwoot (POST /chatwoot/eventos): conferir a assinatura e
// transformar o evento "message_created" na mensagem que o Gestor grava.
//
// Formato conferido no codigo-fonte do Chatwoot v4.18.0 (base do fork
// fazer.ai): lib/webhooks/trigger.rb (cabecalhos) e Message#webhook_data /
// Conversations::EventDataPresenter#webhook_data (corpo).
import { createHmac, timingSafeEqual } from 'crypto';

// Diferenca maxima aceita entre o relogio do Chatwoot e o do Gestor. Aviso
// mais antigo que isso e recusado (evita reenviar um aviso capturado).
export const TOLERANCIA_ASSINATURA_SEG = 300;

// Chatwoot: X-Chatwoot-Timestamp = segundos (unix) e
// X-Chatwoot-Signature = "sha256=" + HMAC_SHA256(segredo, "<timestamp>.<corpo>").
export function assinaturaChatwootValida(params: {
  corpo: Buffer | undefined;
  timestamp: string | undefined;
  assinatura: string | undefined;
  segredo: string | undefined;
  agoraSeg: number;
}): boolean {
  const { corpo, timestamp, assinatura, segredo, agoraSeg } = params;
  if (!segredo || !corpo || !timestamp || !assinatura) return false;
  if (!/^\d{1,12}$/.test(timestamp)) return false;
  if (Math.abs(agoraSeg - Number(timestamp)) > TOLERANCIA_ASSINATURA_SEG) return false;

  const esperada = Buffer.from(
    'sha256=' + createHmac('sha256', segredo).update(`${timestamp}.`).update(corpo).digest('hex'),
    'utf8',
  );
  const recebida = Buffer.from(assinatura, 'utf8');
  return esperada.length === recebida.length && timingSafeEqual(esperada, recebida);
}

export type DirecaoMensagem = 'entrada' | 'saida';
export type AutorMensagem = 'cliente' | 'vivi' | 'atendente';

export interface AnexoMensagem {
  tipo: string;
  url: string;
}

export interface MensagemChatwoot {
  chatwootMessageId: number;
  chatwootConversationId: number;
  chatwootInboxId: number;
  telefone: string;
  direcao: DirecaoMensagem;
  autorTipo: AutorMensagem;
  autorNome: string | null;
  conteudo: string | null;
  anexos: AnexoMensagem[];
  enviadaEm: Date;
}

const MAX_CONTEUDO = 20_000;
const MAX_NOME = 150;

function inteiroPositivo(valor: unknown): number | null {
  const n = typeof valor === 'string' && /^\d+$/.test(valor) ? Number(valor) : valor;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
}

// created_at chega como texto ISO (Time do Rails) - aceita tambem segundos.
function dataDoEvento(valor: unknown): Date | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return new Date(valor * 1000);
  if (typeof valor === 'string' && valor) {
    const d = new Date(valor);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function texto(valor: unknown, max: number): string | null {
  if (typeof valor !== 'string') return null;
  const t = valor.trim();
  return t ? t.slice(0, max) : null;
}

// Devolve null para tudo o que NAO deve ser gravado: outro evento, outra
// caixa (ex.: a caixa de avisos internos), nota interna, aviso de sistema
// ("conversa reaberta"...), sem telefone, ou sem texto e sem anexo.
export function interpretarMensagemChatwoot(payload: unknown, inboxOficialId: number | null): MensagemChatwoot | null {
  if (inboxOficialId === null || !payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, any>;
  if (p.event !== 'message_created') return null;
  if (p.private === true) return null;

  const inboxId = inteiroPositivo(p.inbox?.id);
  if (inboxId !== inboxOficialId) return null;

  const tipo = p.message_type;
  let direcao: DirecaoMensagem;
  if (tipo === 'incoming' || tipo === 0) direcao = 'entrada';
  else if (tipo === 'outgoing' || tipo === 'template' || tipo === 1 || tipo === 3) direcao = 'saida';
  else return null; // activity (2) = aviso de sistema

  const id = inteiroPositivo(p.id);
  const conversaId = inteiroPositivo(p.conversation?.id);
  const telefone = texto(p.conversation?.meta?.sender?.phone_number, 30);
  const enviadaEm = dataDoEvento(p.created_at);
  if (!id || !conversaId || !telefone || !enviadaEm) return null;

  const anexos: AnexoMensagem[] = (Array.isArray(p.attachments) ? p.attachments : [])
    .filter((a: any) => typeof a?.data_url === 'string' && /^https?:\/\//.test(a.data_url))
    .map((a: any) => ({ tipo: typeof a.file_type === 'string' ? a.file_type : 'arquivo', url: a.data_url }));
  const conteudo = texto(p.content, MAX_CONTEUDO);
  if (!conteudo && anexos.length === 0) return null;

  const tipoRemetente = p.sender?.type;
  const autorTipo: AutorMensagem =
    direcao === 'entrada' ? 'cliente' : tipoRemetente === 'user' ? 'atendente' : 'vivi';

  return {
    chatwootMessageId: id,
    chatwootConversationId: conversaId,
    chatwootInboxId: inboxId,
    telefone,
    direcao,
    autorTipo,
    autorNome: texto(p.sender?.name, MAX_NOME),
    conteudo,
    anexos,
    enviadaEm,
  };
}
