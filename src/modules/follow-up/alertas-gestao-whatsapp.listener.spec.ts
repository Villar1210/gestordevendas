import { AlertasGestaoWhatsappListener } from './alertas-gestao-whatsapp.listener';

function montar(gestao: Array<{ name: string; whatsapp: string | null }>, admins: Array<{ name: string; whatsapp: string | null }>) {
  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValueOnce(gestao).mockResolvedValueOnce(admins),
      findFirst: jest.fn().mockResolvedValue({ name: 'Gerente', whatsapp: '(11) 99999-0000' }),
    },
    card: { findFirst: jest.fn().mockResolvedValue({ title: 'Maria', pipelineId: 'p-1' }) },
  };
  const chatwoot = { enviarMensagem: jest.fn() };
  return { listener: new AlertasGestaoWhatsappListener(prisma as never, chatwoot as never), chatwoot, prisma };
}

describe('Alertas de gestao no WhatsApp', () => {
  it('leads parados sem dono: UMA mensagem por empresa para coordenadores e gerentes (telefone normalizado)', async () => {
    const { listener, chatwoot } = montar([{ name: 'Coord', whatsapp: '11 98888-7777' }], []);
    await listener.leadsParadosSemDono({ tenantId: 't-1', cards: [{ cardId: 'c-1', title: 'Maria', minutosAguardando: 15 }, { cardId: 'c-2', title: 'Joao', minutosAguardando: 20 }] });
    expect(chatwoot.enviarMensagem).toHaveBeenCalledTimes(1);
    expect(chatwoot.enviarMensagem).toHaveBeenCalledWith(expect.objectContaining({ telefone: '5511988887777' }));
    expect(chatwoot.enviarMensagem.mock.calls[0][0].mensagem).toContain('2 lead(s) sem corretor');
  });

  it('sem coordenador/gerente com WhatsApp: avisa os Administradores', async () => {
    const { listener, chatwoot } = montar([], [{ name: 'Admin', whatsapp: '11977776666' }]);
    await listener.leadsParadosSemDono({ tenantId: 't-1', cards: [{ cardId: 'c-1', title: 'Maria', minutosAguardando: 15 }, { cardId: 'c-2', title: 'Joao', minutosAguardando: 20 }] });
    expect(chatwoot.enviarMensagem).toHaveBeenCalledWith(expect.objectContaining({ telefone: '5511977776666' }));
  });

  it('lead escalado: avisa o gestor que recebeu', async () => {
    const { listener, chatwoot } = montar([], []);
    await listener.leadEscaladoParaGestao({ tenantId: 't-1', cardId: 'c-1', corretorAnteriorId: 'x', gestorId: 'g-1' });
    expect(chatwoot.enviarMensagem).toHaveBeenCalledWith(expect.objectContaining({ telefone: '5511999990000' }));
  });
});
