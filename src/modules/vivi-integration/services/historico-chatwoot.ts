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

// Telefone do card ("5511999998888") -> mesmo numero com +, como o Chatwoot grava.
export function mesmoTelefone(a: string | null | undefined, b: string | null | undefined): boolean {
  const da = String(a ?? '').replace(/\D/g, '');
  const db = String(b ?? '').replace(/\D/g, '');
  return da.length >= 10 && da === db;
}
