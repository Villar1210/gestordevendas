// Fase B (Q4, 27/10/2026): WhatsApp com a VIVI desligada tambem entra no
// Kanban - uma vez por conversa (quando o atendimento e aberto).
import { WhatsAppMessageReceivedListener } from './whatsapp-message-received.listener';

function montar(criadoAgora: boolean) {
  const atendimento = { execute: jest.fn().mockResolvedValue({ id: 'a-1', criadoAgora }) };
  const criarCard = { execute: jest.fn().mockResolvedValue({ id: 'card-1' }) };
  const pipelines = {
    findAllByTenant: jest.fn().mockResolvedValue([
      { id: 'p-rmk', name: 'Leads Nao Qualificados' },
      { id: 'p-vendas', name: 'Vendas' },
    ]),
  };
  const listener = new WhatsAppMessageReceivedListener(
    { findById: jest.fn().mockResolvedValue({ id: 's-1', isAiEnabled: false }) } as never,
    { execute: jest.fn() } as never,
    atendimento as never,
    criarCard as never,
    pipelines as never,
  );
  return { listener, criarCard };
}

const evento = { tenantId: 't-1', sessionId: 's-1', phoneNumber: '5511973879858', remoteJid: 'x@s.whatsapp.net', messageBody: 'Oi', pushName: 'Maria' };

describe('WhatsApp sem VIVI vira card', () => {
  it('1a mensagem da conversa cria card na Caixa de Entrada do funil de vendas', async () => {
    const { listener, criarCard } = montar(true);
    await listener.handle(evento);
    expect(criarCard.execute).toHaveBeenCalledWith(
      expect.objectContaining({ pipelineId: 'p-vendas', phone: '5511973879858', origem: 'whatsapp', title: 'Maria' }),
    );
    expect(criarCard.execute.mock.calls[0][0].stageId).toBeUndefined();
  });

  it('mensagens seguintes da mesma conversa nao mexem no Kanban', async () => {
    const { listener, criarCard } = montar(false);
    await listener.handle(evento);
    expect(criarCard.execute).not.toHaveBeenCalled();
  });
});
