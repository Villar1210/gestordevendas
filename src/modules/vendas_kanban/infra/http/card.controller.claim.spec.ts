// WhatsApp integrado - Etapa 2 (19/11/2026): "iniciar atendimento" (claim
// manual) torna o usuario dono de vez -> 'lead.assumido'. A Roleta
// automatica usa o mesmo ClaimCardUseCase, mas NAO passa por aqui (la o
// dono ainda precisa aceitar).
import { CardController } from './card.controller';

describe('CardController.claim', () => {
  it('assume o card e avisa lead.assumido (via iniciar_atendimento)', async () => {
    const claim = { execute: jest.fn().mockResolvedValue({ id: 'c-1', tenantId: 't-1', ownerId: 'u-1' }) };
    const emitter = { emit: jest.fn() };
    const args: unknown[] = Array(14).fill({});
    args[10] = claim;
    const controller = new (CardController as any)(...args, emitter) as CardController;
    const req = { user: { id: 'u-1', tenantId: 't-1', role: 'Corretor', cargo: null } } as never;

    const r = await controller.claim('c-1', req);

    expect(r).toEqual({ id: 'c-1', tenantId: 't-1', ownerId: 'u-1' });
    expect(emitter.emit).toHaveBeenCalledWith('lead.assumido', { tenantId: 't-1', cardId: 'c-1', ownerId: 'u-1', via: 'iniciar_atendimento' });
  });

  it('se o claim falhar (ex.: ja tem dono), nao avisa', async () => {
    const claim = { execute: jest.fn().mockRejectedValue(new Error('Lead ja foi assumido por outro corretor.')) };
    const emitter = { emit: jest.fn() };
    const args: unknown[] = Array(14).fill({});
    args[10] = claim;
    const controller = new (CardController as any)(...args, emitter) as CardController;
    await expect(controller.claim('c-1', { user: { id: 'u-1', tenantId: 't-1', role: 'Corretor', cargo: null } } as never)).rejects.toThrow();
    expect(emitter.emit).not.toHaveBeenCalled();
  });
});
