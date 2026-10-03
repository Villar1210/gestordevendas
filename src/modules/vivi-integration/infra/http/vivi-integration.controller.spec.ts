// Fatia 1 (Atendimento/Roleta): aviso de agendamento ao corretor. Antes o
// controller buscava o corretor na tabela errada ("atendimento") e o aviso
// nunca saia - estes testes travam o comportamento corrigido.
import { ViviIntegrationController } from './vivi-integration.controller';

function montar(owner: { name: string; whatsapp: string | null; telefone: string | null } | null) {
  const agendarVisitaUseCase = {
    execute: jest.fn().mockResolvedValue({
      cardId: 'card-1',
      visitaAgendadaEm: new Date('2026-10-03T13:00:00Z'),
      mensagemConfirmacaoEstruturada: 'ok',
    }),
  };
  const prisma = { card: { findFirst: jest.fn().mockResolvedValue(owner === undefined ? null : { owner }) } };
  const chatwoot = { enviarMensagem: jest.fn().mockResolvedValue(undefined) };
  const config = { get: jest.fn().mockReturnValue('tenant-1') };
  const controller = new ViviIntegrationController(
    agendarVisitaUseCase as any,
    prisma as any,
    chatwoot as any,
    config as any,
    {} as any, // FollowUpService (nao usado em agendarVisita)
    {} as any, // MoverCardViviUseCase
    {} as any, // SimularCreditoUseCase
  );
  return { controller, prisma, chatwoot };
}

const dto = {
  phoneNumber: '5511999998888',
  dataVisita: '2026-10-03',
  horario: '10:00',
  nomeCliente: 'Maria',
  resumo: 'Renda 6k',
};

describe('ViviIntegrationController.agendarVisita - aviso ao corretor', () => {
  it('busca o dono no CARD do tenant e avisa pelo WhatsApp do cadastro', async () => {
    const { controller, prisma, chatwoot } = montar({ name: 'Joao Corretor', whatsapp: '(11) 97387-9858', telefone: null });
    const resp = await controller.agendarVisita(dto as any);

    expect(prisma.card.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'card-1', tenantId: 'tenant-1' } }),
    );
    expect(chatwoot.enviarMensagem).toHaveBeenCalledTimes(1);
    const arg = chatwoot.enviarMensagem.mock.calls[0][0];
    expect(arg.telefone).toBe('5511973879858');
    expect(arg.etiquetas).toEqual(['aviso-corretor']);
    expect(arg.verificarEntrega).toBe(true);
    expect(arg.mensagem).toContain('sábado, 03/10 às 10:00');
    expect(resp.corretor).toEqual({ nome: 'Joao Corretor', telefone: '5511973879858' });
  });

  it('usa o telefone quando o corretor nao tem WhatsApp cadastrado', async () => {
    const { controller, chatwoot } = montar({ name: 'Ana', whatsapp: null, telefone: '11 3333-4444' });
    await controller.agendarVisita(dto as any);
    expect(chatwoot.enviarMensagem.mock.calls[0][0].telefone).toBe('551133334444');
  });

  it('nao envia quando o card ainda nao tem corretor (Roleta desligada/semi-automatica)', async () => {
    const { controller, chatwoot } = montar(null);
    const resp = await controller.agendarVisita(dto as any);
    expect(chatwoot.enviarMensagem).not.toHaveBeenCalled();
    expect(resp.corretor).toBeNull();
  });

  it('nao envia quando o corretor nao tem telefone valido', async () => {
    const { controller, chatwoot } = montar({ name: 'Sem Fone', whatsapp: null, telefone: null });
    const resp = await controller.agendarVisita(dto as any);
    expect(chatwoot.enviarMensagem).not.toHaveBeenCalled();
    expect(resp.corretor).toBeNull();
  });
});
