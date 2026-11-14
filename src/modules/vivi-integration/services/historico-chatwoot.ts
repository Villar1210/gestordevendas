// src/modules/vivi-integration/services/historico-chatwoot.ts
// Fatia 3 (WhatsApp do corretor): conversao pura das mensagens do Chatwoot
// para o historico exibido ao corretor. Sem Nest/axios - testavel isolado.

export type AutorMensagem = 'cliente' | 'vivi' | 'atendente';

export interface MensagemHistorico {
  autor: AutorMensagem;
  texto: string;
  quando: string; // ISO
}

interface MensagemChatwoot {
  id?: number;
  content?: string | null;
  message_type?: number | string;
  private?: boolean;
  created_at?: number;
  sender_type?: string | null;
  sender?: { type?: string | null } | null;
  attachments?: unknown[];
}

// message_type do Chatwoot: 0 incoming (cliente), 1 outgoing (bot/agente),
// 2 activity (eventos do sistema), 3 template.
export function converterMensagens(lista: MensagemChatwoot[]): MensagemHistorico[] {
  return [...lista]
    .filter((m) => !m.private)
    .filter((m) => m.message_type !== 2 && m.message_type !== 'activity')
    .map((m) => {
      const entrada = m.message_type === 0 || m.message_type === 'incoming';
      const tipoRemetente = (m.sender_type ?? m.sender?.type ?? '').toLowerCase();
      const autor: AutorMensagem = entrada
        ? 'cliente'
        : tipoRemetente === 'user'
          ? 'atendente'
          : 'vivi'; // agent_bot / captain / sem remetente (API)
      const texto = (m.content ?? '').trim() || ((m.attachments?.length ?? 0) > 0 ? '[anexo]' : '');
      return { autor, texto, quando: new Date((m.created_at ?? 0) * 1000).toISOString(), id: m.id ?? 0 };
    })
    .filter((m) => m.texto)
    .sort((a, b) => a.quando.localeCompare(b.quando) || a.id - b.id)
    .map(({ autor, texto, quando }) => ({ autor, texto, quando }));
}

// Etapa 1 (WhatsApp integrado, 14/11/2026): a caixa oficial do Chatwoot
// cria uma conversa NOVA toda vez que o cliente volta depois de a anterior
// ser encerrada ("Criar novas conversas"). O historico do cliente fica
// espalhado em varias conversas - aqui se escolhe quais ler.
export interface ConversaChatwoot {
  id: number;
  inbox_id?: number;
  status?: string;
  created_at?: number;
  last_activity_at?: number;
  timestamp?: number;
}

export const MAX_CONVERSAS_HISTORICO = 10;

// So as conversas da caixa informada (quando houver), sem repetir, das mais
// antigas para as mais recentes, limitadas as `max` mais recentes.
export function selecionarConversas(
  conversas: ConversaChatwoot[],
  inboxId: number | null,
  max = MAX_CONVERSAS_HISTORICO,
): ConversaChatwoot[] {
  const vistas = new Set<number>();
  const quando = (c: ConversaChatwoot) => c.created_at ?? c.timestamp ?? c.last_activity_at ?? 0;
  return conversas
    .filter((c) => Number.isInteger(c?.id))
    .filter((c) => inboxId === null || c.inbox_id === inboxId)
    .filter((c) => (vistas.has(c.id) ? false : (vistas.add(c.id), true)))
    .sort((a, b) => quando(a) - quando(b) || a.id - b.id)
    .slice(-max);
}

// Conversa em andamento (aberta ou com o bot) mais recente da caixa.
export function conversaAtiva(conversas: ConversaChatwoot[], inboxId: number): ConversaChatwoot | null {
  const ativas = selecionarConversas(conversas, inboxId, Number.MAX_SAFE_INTEGER).filter(
    (c) => c.status === 'open' || c.status === 'pending',
  );
  return ativas.length ? ativas[ativas.length - 1] : null;
}

// Telefone do card ("5511999998888") -> mesmo numero com +, como o Chatwoot grava.
export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = String(a ?? '').replace(/\D/g, '');
  const db = String(b ?? '').replace(/\D/g, '');
  return da.length >= 10 && da === db;
}
