// Etapa 1, parte 2 (19/11/2026): assinatura e leitura do webhook do Chatwoot.
import { createHmac } from 'crypto';
import { assinaturaChatwootValida, interpretarMensagemChatwoot, TOLERANCIA_ASSINATURA_SEG } from './evento-chatwoot';

const SEGREDO = 'segredo-de-teste';
const AGORA = 1_794_700_000;

function assinar(corpo: string, ts: number, segredo = SEGREDO) {
  return 'sha256=' + createHmac('sha256', segredo).update(`${ts}.${corpo}`).digest('hex');
}

describe('assinaturaChatwootValida', () => {
  const corpo = '{"event":"message_created","id":1}';
  const base = { corpo: Buffer.from(corpo), timestamp: String(AGORA), segredo: SEGREDO, agoraSeg: AGORA };

  it('aceita a assinatura no formato do Chatwoot', () => {
    expect(assinaturaChatwootValida({ ...base, assinatura: assinar(corpo, AGORA) })).toBe(true);
  });

  it('recusa segredo errado, corpo alterado ou assinatura ausente', () => {
    expect(assinaturaChatwootValida({ ...base, assinatura: assinar(corpo, AGORA, 'outro') })).toBe(false);
    expect(assinaturaChatwootValida({ ...base, corpo: Buffer.from(corpo + ' '), assinatura: assinar(corpo, AGORA) })).toBe(false);
    expect(assinaturaChatwootValida({ ...base, assinatura: undefined })).toBe(false);
    expect(assinaturaChatwootValida({ ...base, assinatura: 'sha256=abc' })).toBe(false);
  });

  it('recusa aviso antigo ou do futuro alem da tolerancia', () => {
    const velho = AGORA - TOLERANCIA_ASSINATURA_SEG - 1;
    expect(assinaturaChatwootValida({ ...base, timestamp: String(velho), assinatura: assinar(corpo, velho) })).toBe(false);
    const futuro = AGORA + TOLERANCIA_ASSINATURA_SEG + 1;
    expect(assinaturaChatwootValida({ ...base, timestamp: String(futuro), assinatura: assinar(corpo, futuro) })).toBe(false);
    const limite = AGORA - TOLERANCIA_ASSINATURA_SEG;
    expect(assinaturaChatwootValida({ ...base, timestamp: String(limite), assinatura: assinar(corpo, limite) })).toBe(true);
  });

  it('sem segredo configurado recusa tudo (nunca aceita sem conferir)', () => {
    expect(assinaturaChatwootValida({ ...base, segredo: undefined, assinatura: assinar(corpo, AGORA) })).toBe(false);
    expect(assinaturaChatwootValida({ ...base, segredo: '', assinatura: assinar(corpo, AGORA, '') })).toBe(false);
  });

  it('timestamp que nao e numero e recusado', () => {
    expect(assinaturaChatwootValida({ ...base, timestamp: 'abc', assinatura: assinar(corpo, AGORA) })).toBe(false);
  });
});

describe('interpretarMensagemChatwoot', () => {
  // Formato de Message#webhook_data (Chatwoot v4.18)
  const evento = (extra: Record<string, unknown> = {}) => ({
    event: 'message_created',
    id: 1301,
    content: 'Oi, quero conhecer o Novolar Freguesia',
    created_at: '2026-11-14T22:05:14.000Z',
    message_type: 'incoming',
    private: false,
    inbox: { id: 2, name: 'Vivi Assistente WhatsApp' },
    conversation: { id: 65, inbox_id: 2, meta: { sender: { id: 9, name: 'VILLAR', phone_number: '+5511973879858', type: 'contact' } } },
    sender: { id: 9, name: 'VILLAR', phone_number: '+5511973879858' },
    ...extra,
  });

  it('mensagem do cliente', () => {
    expect(interpretarMensagemChatwoot(evento(), 2)).toEqual({
      chatwootMessageId: 1301,
      chatwootConversationId: 65,
      chatwootInboxId: 2,
      telefone: '+5511973879858',
      direcao: 'entrada',
      autorTipo: 'cliente',
      autorNome: 'VILLAR',
      conteudo: 'Oi, quero conhecer o Novolar Freguesia',
      anexos: [],
      enviadaEm: new Date('2026-11-14T22:05:14.000Z'),
    });
  });

  it('resposta da VIVI (agent_bot) e de atendente (user)', () => {
    const vivi = interpretarMensagemChatwoot(evento({ message_type: 'outgoing', sender: { id: 2, name: 'Vivi', type: 'agent_bot' } }), 2);
    expect(vivi).toMatchObject({ direcao: 'saida', autorTipo: 'vivi', autorNome: 'Vivi' });
    const humano = interpretarMensagemChatwoot(evento({ message_type: 'outgoing', sender: { id: 8, name: 'Gestor de Vendas', type: 'user' } }), 2);
    expect(humano).toMatchObject({ direcao: 'saida', autorTipo: 'atendente', autorNome: 'Gestor de Vendas' });
    const modelo = interpretarMensagemChatwoot(evento({ message_type: 'template', sender: null }), 2);
    expect(modelo).toMatchObject({ direcao: 'saida', autorTipo: 'vivi' });
  });

  it('ignora nota interna, aviso de sistema, outra caixa, outro evento e caixa nao configurada', () => {
    expect(interpretarMensagemChatwoot(evento({ private: true, message_type: 'outgoing' }), 2)).toBeNull();
    expect(interpretarMensagemChatwoot(evento({ message_type: 'activity', content: 'Conversa foi reaberta' }), 2)).toBeNull();
    expect(interpretarMensagemChatwoot(evento({ inbox: { id: 1 } }), 2)).toBeNull();
    expect(interpretarMensagemChatwoot(evento({ event: 'message_updated' }), 2)).toBeNull();
    expect(interpretarMensagemChatwoot(evento(), null)).toBeNull();
  });

  it('ignora sem telefone, sem id, sem data ou sem texto e sem anexo', () => {
    expect(interpretarMensagemChatwoot(evento({ conversation: { id: 65, meta: { sender: {} } } }), 2)).toBeNull();
    expect(interpretarMensagemChatwoot(evento({ id: 'x' }), 2)).toBeNull();
    expect(interpretarMensagemChatwoot(evento({ created_at: 'ontem' }), 2)).toBeNull();
    expect(interpretarMensagemChatwoot(evento({ content: '   ' }), 2)).toBeNull();
    expect(interpretarMensagemChatwoot(null, 2)).toBeNull();
  });

  it('so anexo (foto sem legenda): grava os links validos', () => {
    const r = interpretarMensagemChatwoot(
      evento({
        content: null,
        attachments: [
          { file_type: 'image', data_url: 'https://chatwoot.ivillar.com.br/rails/active_storage/x.jpg' },
          { file_type: 'file', data_url: 'javascript:alert(1)' },
        ],
      }),
      2,
    );
    expect(r).toMatchObject({ conteudo: null, anexos: [{ tipo: 'image', url: 'https://chatwoot.ivillar.com.br/rails/active_storage/x.jpg' }] });
  });

  it('data em segundos tambem e aceita', () => {
    expect(interpretarMensagemChatwoot(evento({ created_at: 1_794_697_514 }), 2)?.enviadaEm).toEqual(new Date(1_794_697_514_000));
  });
});
