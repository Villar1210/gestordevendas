import { conversaAtiva, converterMensagens, mesmoTelefone, selecionarConversas } from './historico-chatwoot';

describe('historico-chatwoot', () => {
  it('identifica cliente, VIVI e atendente humano e ignora notas privadas/eventos', () => {
    const r = converterMensagens([
      { id: 3, content: 'Posso ajudar?', message_type: 1, created_at: 1000, sender_type: 'User' },
      { id: 1, content: 'Oi, quero ver o Terrasse', message_type: 0, created_at: 900 },
      { id: 2, content: 'Claro! Qual sua renda?', message_type: 1, created_at: 950, sender_type: 'AgentBot' },
      { id: 4, content: 'nota interna', message_type: 1, private: true, created_at: 1100 },
      { id: 5, content: 'Conversa atribuida', message_type: 2, created_at: 1200 },
      { id: 6, content: '', message_type: 0, created_at: 1300, attachments: [{}] },
      { id: 7, content: '   ', message_type: 0, created_at: 1400 },
    ]);
    expect(r.map((m) => [m.autor, m.texto])).toEqual([
      ['cliente', 'Oi, quero ver o Terrasse'],
      ['vivi', 'Claro! Qual sua renda?'],
      ['atendente', 'Posso ajudar?'],
      ['cliente', '[anexo]'],
    ]);
    expect(r[0].quando).toBe(new Date(900_000).toISOString());
  });

  it('compara telefones so pelos digitos', () => {
    expect(mesmoTelefone('+55 11 99999-8888', '5511999998888')).toBe(true);
    expect(mesmoTelefone('5511999998888', '5511999998887')).toBe(false);
    expect(mesmoTelefone('', '')).toBe(false);
  });
});

describe('selecionarConversas / conversaAtiva (Etapa 1)', () => {
  const c = (id: number, inbox_id: number, created_at: number, status = 'resolved') => ({ id, inbox_id, created_at, status });

  it('so a caixa oficial, sem repetir, da mais antiga para a mais recente', () => {
    const r = selecionarConversas([c(3, 2, 300), c(1, 2, 100), c(9, 1, 50), c(3, 2, 300), c(2, 2, 200)], 2);
    expect(r.map((x) => x.id)).toEqual([1, 2, 3]);
  });

  it('sem caixa configurada le todas; limita as mais recentes', () => {
    const r = selecionarConversas([c(1, 1, 100), c(2, 2, 200), c(3, 2, 300)], null, 2);
    expect(r.map((x) => x.id)).toEqual([2, 3]);
  });

  it('conversa ativa = aberta ou com o bot, a mais recente; encerradas nao contam', () => {
    expect(conversaAtiva([c(1, 2, 100, 'open'), c(2, 2, 200, 'pending'), c(3, 2, 300, 'resolved')], 2)?.id).toBe(2);
    expect(conversaAtiva([c(1, 2, 100, 'resolved'), c(5, 1, 400, 'open')], 2)).toBeNull();
  });
});
