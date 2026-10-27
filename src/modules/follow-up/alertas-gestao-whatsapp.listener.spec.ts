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
  it('lead parado sem dono: avisa coordenadores e gerentes (telefone normalizado)', async () => {
    const { listener, chatwoot } = montar([{ name: 'Coord', whatsapp: '11 98888-7777' }], []);
    await listener.leadParadoSemDono({ tenantId: 't-1', cardId: 'c-1', title: 'Maria', phone: null, minutosAguardando: 15 });
    expect(chatwoot.enviarMensagem).toHaveBeenCalledWith(expect.objectContaining({ telefone: '5511988887777' }));
  });

  it('sem coordenador/gerente com WhatsApp: avisa os Administradores', async () => {
    const { listener, chatwoot } = montar([], [{ name: 'Admin', whatsapp: '11977776666' }]);
    await listener.leadParadoSemDono({ tenantId: 't-1', cardId: 'c-1', title: 'Maria', phone: null, minutosAguardando: 15 });
    expect(chatwoot.enviarMensagem).toHaveBeenCalledWith(expect.objectContaining({ telefone: '5511977776666' }));
  });

  it('lead escalado: avisa o gestor que recebeu', async () => {
    const { listener, chatwoot } = montar([], []);
    await listener.leadEscaladoParaGestao({ tenantId: 't-1', cardId: 'c-1', corretorAnteriorId: 'x', gestorId: 'g-1' });
    expect(chatwoot.enviarMensagem).toHaveBeenCalledWith(expect.objectContaining({ telefone: '5511999990000' }));
  });
});
