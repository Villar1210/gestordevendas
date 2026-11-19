// WhatsApp integrado - Etapa 2 (19/11/2026).
import { LeadAssumidoViviListener } from './lead-assumido-vivi.listener';

const evento = { tenantId: 't-1', cardId: 'c-1', ownerId: 'u-ana', via: 'aceite' as const };

function montar(card: Record<string, unknown> | null = { id: 'c-1', phone: '5511973879858', ownerId: 'u-ana', origem: 'vivi' }) {
  const chatwoot = { passarParaHumano: jest.fn().mockResolvedValue({ ok: true, conversaId: 66 }) };
  const leads = {
    findCard: jest.fn().mockResolvedValue(card),
    nomeUsuario: jest.fn().mockResolvedValue('Ana Corretora'),
    registrarAvisoConversaVivi: jest.fn().mockResolvedValue(undefined),
  };
  const mensagens = { ligarSemCardAoCard: jest.fn().mockResolvedValue(2) };
  const listener = new LeadAssumidoViviListener(chatwoot as never, leads as never, mensagens as never);
  const esperas: number[] = [];
  listener.esperar = async (ms: number) => {
    esperas.push(ms);
  };
  return { listener, chatwoot, leads, mensagens, esperas };
}

describe('LeadAssumidoViviListener', () => {
  it('passa a conversa da VIVI, liga mensagens sem card e registra no historico', async () => {
    const { listener, chatwoot, leads, mensagens } = montar();
    expect(await listener.aoAssumirLead(evento)).toBe('passada');
    expect(mensagens.ligarSemCardAoCard).toHaveBeenCalledWith('t-1', '1173879858', 'c-1');
    expect(chatwoot.passarParaHumano).toHaveBeenCalledWith('5511973879858');
    expect(leads.registrarAvisoConversaVivi).toHaveBeenCalledWith('t-1', 'c-1', 'Conversa do WhatsApp oficial passada da VIVI para Ana Corretora', false);
  });

  it('falha passageira do Chatwoot: tenta de novo (30 s, 2 min) e consegue', async () => {
    const { listener, chatwoot, esperas } = montar();
    chatwoot.passarParaHumano
      .mockResolvedValueOnce({ ok: false, motivo: 'erro', detalhe: 'HTTP 502' })
      .mockResolvedValueOnce({ ok: false, motivo: 'erro', detalhe: 'timeout' });
    expect(await listener.aoAssumirLead(evento)).toBe('passada');
    expect(chatwoot.passarParaHumano).toHaveBeenCalledTimes(3);
    expect(esperas).toEqual([30_000, 120_000]);
  });

  it('3 falhas: para de tentar e deixa tarefa em aberto no card', async () => {
    const { listener, chatwoot, leads } = montar();
    chatwoot.passarParaHumano.mockResolvedValue({ ok: false, motivo: 'erro', detalhe: 'HTTP 500' });
    expect(await listener.aoAssumirLead(evento)).toBe('falhou');
    expect(chatwoot.passarParaHumano).toHaveBeenCalledTimes(3);
    expect(leads.registrarAvisoConversaVivi).toHaveBeenCalledWith('t-1', 'c-1', expect.stringContaining('Envie uma mensagem pelo Gestor'), true);
  });

  it('cliente sem conversa aberta com a VIVI ou Chatwoot sem configuracao: nada a fazer, sem nova tentativa', async () => {
    const a = montar();
    a.chatwoot.passarParaHumano.mockResolvedValue({ ok: false, motivo: 'sem_conversa_ativa' });
    expect(await a.listener.aoAssumirLead(evento)).toBe('sem_conversa');
    const b = montar();
    b.chatwoot.passarParaHumano.mockResolvedValue({ ok: false, motivo: 'nao_configurado' });
    expect(await b.listener.aoAssumirLead(evento)).toBe('nao_configurado');
    expect(a.chatwoot.passarParaHumano).toHaveBeenCalledTimes(1);
    expect(a.leads.registrarAvisoConversaVivi).not.toHaveBeenCalled();
    expect(b.leads.registrarAvisoConversaVivi).not.toHaveBeenCalled();
  });

  it('card sem telefone ou inexistente: nao chama o Chatwoot', async () => {
    const a = montar({ id: 'c-1', phone: null, ownerId: 'u-ana', origem: 'manual' });
    expect(await a.listener.aoAssumirLead(evento)).toBe('sem_telefone');
    const b = montar(null);
    expect(await b.listener.aoAssumirLead(evento)).toBe('sem_telefone');
    expect(a.chatwoot.passarParaHumano).not.toHaveBeenCalled();
  });

  it('erro inesperado (ex.: banco) nao derruba o processo', async () => {
    const { listener, leads } = montar();
    leads.findCard.mockRejectedValue(new Error('db down'));
    expect(await listener.aoAssumirLead(evento)).toBe('falhou');
  });
});
