// Etapa 1 (WhatsApp integrado, 14/11/2026): historico juntando as conversas
// da caixa oficial e passagem da conversa para atendimento humano.
import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { ChatwootWhatsappService } from './chatwoot-whatsapp.service';

jest.mock('axios');
const mocked = axios as jest.Mocked<typeof axios>;

const BASE = 'https://cw.test/api/v1/accounts/3';

function servico(env: Record<string, string> = {}) {
  const valores: Record<string, string> = {
    CHATWOOT_URL: 'https://cw.test',
    CHATWOOT_API_TOKEN: 'tok',
    CHATWOOT_ACCOUNT_ID: '3',
    CHATWOOT_INBOX_ID: '1',
    CHATWOOT_INBOX_OFICIAL_ID: '2',
    ...env,
  };
  const config = { get: (k: string, padrao?: string) => (k in valores ? valores[k] : padrao) } as unknown as ConfigService;
  return new ChatwootWhatsappService(config);
}

// Respostas de GET por URL.
function getPorUrl(rotas: Record<string, unknown>) {
  mocked.get.mockImplementation(async (url: string) => {
    if (!(url in rotas)) throw new Error(`GET inesperado: ${url}`);
    const r = rotas[url];
    if (r instanceof Error) throw r;
    return { data: r };
  });
}

const contato = { payload: [{ id: 7, phone_number: '+5511999998888' }, { id: 8, phone_number: '+5511000000000' }] };

beforeEach(() => {
  jest.resetAllMocks();
});

describe('ChatwootWhatsappService.historicoPorTelefone', () => {
  it('junta as conversas da caixa oficial em ordem de tempo e ignora outras caixas', async () => {
    getPorUrl({
      [`${BASE}/contacts/search`]: contato,
      [`${BASE}/contacts/7/conversations`]: {
        payload: [
          { id: 20, inbox_id: 2, created_at: 200, status: 'open' },
          { id: 10, inbox_id: 2, created_at: 100, status: 'resolved' },
          { id: 99, inbox_id: 1, created_at: 300, status: 'open' },
        ],
      },
      [`${BASE}/conversations/10/messages`]: { payload: [{ id: 1, content: 'oi', message_type: 0, created_at: 100 }] },
      [`${BASE}/conversations/20/messages`]: {
        payload: [{ id: 5, content: 'voltei', message_type: 0, created_at: 200 }, { id: 6, content: 'que bom', message_type: 1, created_at: 201, sender_type: 'AgentBot' }],
      },
    });

    const r = await servico().historicoPorTelefone('5511999998888');

    expect(r.encontrado).toBe(true);
    expect(r.mensagens.map((m) => m.texto)).toEqual(['oi', 'voltei', 'que bom']);
    expect(r.status).toBe('open');
    expect(r.conversaUrl).toBe('https://cw.test/app/accounts/3/conversations/20');
    // contato 8 tem outro telefone: nem consultado; caixa 1 (avisos) nunca lida
    expect(mocked.get).not.toHaveBeenCalledWith(`${BASE}/contacts/8/conversations`, expect.anything());
    expect(mocked.get).not.toHaveBeenCalledWith(`${BASE}/conversations/99/messages`, expect.anything());
    // pede todas as mensagens de cada conversa numa chamada so
    expect(mocked.get).toHaveBeenCalledWith(
      `${BASE}/conversations/10/messages`,
      expect.objectContaining({ params: { after: 0, before: 2_147_483_647 } }),
    );
  });

  it('sem token: nao chama o Chatwoot', async () => {
    const r = await servico({ CHATWOOT_API_TOKEN: '' }).historicoPorTelefone('5511999998888');
    expect(r.encontrado).toBe(false);
    expect(mocked.get).not.toHaveBeenCalled();
  });

  it('sem conversa na caixa oficial: nao encontrado', async () => {
    getPorUrl({
      [`${BASE}/contacts/search`]: contato,
      [`${BASE}/contacts/7/conversations`]: { payload: [{ id: 99, inbox_id: 1, created_at: 300, status: 'open' }] },
    });
    expect((await servico().historicoPorTelefone('5511999998888')).encontrado).toBe(false);
  });
});

describe('ChatwootWhatsappService.passarParaHumano', () => {
  it('atribui a conversa ativa a conta de servico e marca como aberta', async () => {
    getPorUrl({
      [`${BASE}/contacts/search`]: contato,
      [`${BASE}/contacts/7/conversations`]: {
        payload: [
          { id: 10, inbox_id: 2, created_at: 100, status: 'resolved' },
          { id: 20, inbox_id: 2, created_at: 200, status: 'pending' },
        ],
      },
      'https://cw.test/api/v1/profile': { id: 8, name: 'Gestor de Vendas' },
    });
    mocked.post.mockResolvedValue({ data: {} });

    const r = await servico().passarParaHumano('5511999998888');

    expect(r).toEqual({ ok: true, conversaId: 20 });
    expect(mocked.post).toHaveBeenNthCalledWith(1, `${BASE}/conversations/20/assignments`, { assignee_id: 8 }, expect.anything());
    expect(mocked.post).toHaveBeenNthCalledWith(2, `${BASE}/conversations/20/toggle_status`, { status: 'open' }, expect.anything());
  });

  it('sem caixa oficial configurada: nao faz nada', async () => {
    const r = await servico({ CHATWOOT_INBOX_OFICIAL_ID: '' }).passarParaHumano('5511999998888');
    expect(r).toEqual({ ok: false, motivo: 'nao_configurado' });
    expect(mocked.get).not.toHaveBeenCalled();
    expect(mocked.post).not.toHaveBeenCalled();
  });

  it('cliente sem conversa em andamento: nao atribui nada', async () => {
    getPorUrl({
      [`${BASE}/contacts/search`]: contato,
      [`${BASE}/contacts/7/conversations`]: { payload: [{ id: 10, inbox_id: 2, created_at: 100, status: 'resolved' }] },
    });
    expect(await servico().passarParaHumano('5511999998888')).toEqual({ ok: false, motivo: 'sem_conversa_ativa' });
    expect(mocked.post).not.toHaveBeenCalled();
  });

  it('falha no Chatwoot vira motivo "erro" (nao lanca) e o perfil e consultado de novo depois', async () => {
    const rotas: Record<string, unknown> = {
      [`${BASE}/contacts/search`]: contato,
      [`${BASE}/contacts/7/conversations`]: { payload: [{ id: 20, inbox_id: 2, created_at: 200, status: 'open' }] },
      'https://cw.test/api/v1/profile': new Error('timeout'),
    };
    getPorUrl(rotas);
    const s = servico();
    expect(await s.passarParaHumano('5511999998888')).toMatchObject({ ok: false, motivo: 'erro' });
    expect(mocked.post).not.toHaveBeenCalled();

    rotas['https://cw.test/api/v1/profile'] = { id: 8 };
    mocked.post.mockResolvedValue({ data: {} });
    expect(await s.passarParaHumano('5511999998888')).toEqual({ ok: true, conversaId: 20 });
  });
});

describe('ChatwootWhatsappService.enviarParaCliente (parte 3)', () => {
  const conversas = {
    payload: [
      { id: 10, inbox_id: 2, created_at: 100, status: 'resolved' },
      { id: 20, inbox_id: 2, created_at: 200, status: 'open' },
      { id: 99, inbox_id: 1, created_at: 300, status: 'open' },
    ],
  };

  it('na janela e ja com o Gestor: so envia na conversa mais recente da caixa oficial', async () => {
    getPorUrl({
      [`${BASE}/contacts/search`]: contato,
      [`${BASE}/contacts/7/conversations`]: conversas,
      [`${BASE}/conversations/20`]: { can_reply: true, status: 'open', meta: { assignee_type: 'User', assignee: { id: 8 } } },
      'https://cw.test/api/v1/profile': { id: 8 },
    });
    mocked.post.mockResolvedValue({ data: { id: 1400, created_at: 1_795_100_000 } });

    const r = await servico().enviarParaCliente('5511999998888', '*Ana*\nOi');

    expect(r).toEqual({ ok: true, conversaId: 20, inboxId: 2, chatwootMessageId: 1400, enviadaEm: new Date(1_795_100_000_000) });
    expect(mocked.post).toHaveBeenCalledTimes(1);
    expect(mocked.post).toHaveBeenCalledWith(
      `${BASE}/conversations/20/messages`,
      { content: '*Ana*\nOi', message_type: 'outgoing', private: false },
      expect.anything(),
    );
  });

  it('conversa com a VIVI (bot): passa para o Gestor antes de enviar', async () => {
    getPorUrl({
      [`${BASE}/contacts/search`]: contato,
      [`${BASE}/contacts/7/conversations`]: conversas,
      [`${BASE}/conversations/20`]: { can_reply: true, status: 'pending', meta: { assignee_type: 'AgentBot', assignee: { id: 8 } } },
      'https://cw.test/api/v1/profile': { id: 8 },
    });
    mocked.post.mockResolvedValue({ data: { id: 1401 } });

    const r = await servico().enviarParaCliente('5511999998888', 'Oi');

    expect(r).toMatchObject({ ok: true, chatwootMessageId: 1401 });
    expect(mocked.post.mock.calls.map((c) => c[0])).toEqual([
      `${BASE}/conversations/20/assignments`,
      `${BASE}/conversations/20/toggle_status`,
      `${BASE}/conversations/20/messages`,
    ]);
  });

  it('fora da janela de 24 h: nao envia nem mexe na conversa', async () => {
    getPorUrl({
      [`${BASE}/contacts/search`]: contato,
      [`${BASE}/contacts/7/conversations`]: conversas,
      [`${BASE}/conversations/20`]: { can_reply: false, status: 'resolved' },
    });
    expect(await servico().enviarParaCliente('5511999998888', 'Oi')).toEqual({ ok: false, motivo: 'fora_da_janela' });
    expect(mocked.post).not.toHaveBeenCalled();
  });

  it('cliente sem conversa na caixa oficial', async () => {
    getPorUrl({
      [`${BASE}/contacts/search`]: contato,
      [`${BASE}/contacts/7/conversations`]: { payload: [{ id: 99, inbox_id: 1, created_at: 300, status: 'open' }] },
    });
    expect(await servico().enviarParaCliente('5511999998888', 'Oi')).toEqual({ ok: false, motivo: 'sem_conversa' });
  });

  it('sem caixa oficial configurada ou falha do Chatwoot: nao lanca erro', async () => {
    expect(await servico({ CHATWOOT_INBOX_OFICIAL_ID: '' }).enviarParaCliente('5511999998888', 'Oi')).toEqual({
      ok: false,
      motivo: 'nao_configurado',
    });
    getPorUrl({ [`${BASE}/contacts/search`]: new Error('timeout') });
    expect(await servico().enviarParaCliente('5511999998888', 'Oi')).toMatchObject({ ok: false, motivo: 'erro' });
  });
});

describe('ChatwootWhatsappService.historicoParaGravar (Etapa 3)', () => {
  it('converte as mensagens da caixa oficial no formato do webhook, sem notas nem avisos', async () => {
    getPorUrl({
      [`${BASE}/contacts/search`]: contato,
      [`${BASE}/contacts/7/conversations`]: {
        payload: [
          { id: 65, inbox_id: 2, created_at: 100 },
          { id: 99, inbox_id: 1, created_at: 200 },
        ],
      },
      [`${BASE}/conversations/65/messages`]: {
        payload: [
          { id: 1, content: 'Oi', message_type: 0, private: false, created_at: 1795097694, sender: { type: 'contact', name: 'VILLAR' } },
          { id: 2, content: 'Ola!', message_type: 1, private: false, created_at: 1795097719, sender: { type: 'agent_bot', name: 'Vivi' } },
          { id: 3, content: 'nota', message_type: 1, private: true, created_at: 1795097720, sender: { type: 'agent_bot' } },
          { id: 4, content: 'Conversa reaberta', message_type: 2, private: false, created_at: 1795097721 },
          { id: 5, content: '*Ana*\nOi', message_type: 1, private: false, created_at: 1795097800, sender: { type: 'user', name: 'Gestor de Vendas' } },
          { id: 6, content: null, message_type: 0, private: false, created_at: 1795097900, sender: { type: 'contact' }, attachments: [{ file_type: 'image', data_url: 'https://cw.test/f.jpg' }] },
        ],
      },
    });

    const r = await servico().historicoParaGravar('5511999998888');

    expect(r.map((m) => [m.chatwootMessageId, m.direcao, m.autorTipo])).toEqual([
      [1, 'entrada', 'cliente'],
      [2, 'saida', 'vivi'],
      [5, 'saida', 'atendente'],
      [6, 'entrada', 'cliente'],
    ]);
    expect(r[0]).toMatchObject({ chatwootConversationId: 65, chatwootInboxId: 2, telefone: '5511999998888', enviadaEm: new Date(1795097694000) });
    expect(r[3].anexos).toEqual([{ tipo: 'image', url: 'https://cw.test/f.jpg' }]);
  });

  it('sem caixa oficial configurada: nada', async () => {
    expect(await servico({ CHATWOOT_INBOX_OFICIAL_ID: '' }).historicoParaGravar('5511999998888')).toEqual([]);
  });
});
