import { converterMensagens, mesmoTelefone } from './historico-chatwoot';

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
