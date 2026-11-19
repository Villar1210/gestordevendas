// WhatsApp integrado - Etapa 2 (19/11/2026): confirmar a sugestao da Roleta
// tambem tira a conversa da VIVI ('lead.assumido').
import { ConflictException } from '@nestjs/common';
import { ConfirmSuggestedOwnerUseCase } from './confirm-suggested-owner.use-case';

function montar(card: Record<string, unknown> | null) {
  const cardRepository = {
    findByIdAndTenant: jest.fn().mockResolvedValue(card),
    updateSuggestedOwner: jest.fn().mockResolvedValue({ ...card, suggestedOwnerId: null }),
  };
  const claim = { execute: jest.fn().mockResolvedValue({}) };
  const emitter = { emit: jest.fn() };
  return { uc: new ConfirmSuggestedOwnerUseCase(cardRepository as never, claim as never, emitter as never), claim, emitter };
}
const entrada = { cardId: 'c-1', tenantId: 't-1', requesterUserId: 'corretor-a', requesterRole: 'Corretor', requesterCargo: null };

describe('ConfirmSuggestedOwnerUseCase', () => {
  it('confirma: assume o card e avisa lead.atribuido e lead.assumido (via sugestao)', async () => {
    const { uc, claim, emitter } = montar({ id: 'c-1', suggestedOwnerId: 'corretor-a' });
    await uc.execute(entrada);
    expect(claim.execute).toHaveBeenCalledWith(expect.objectContaining({ userId: 'corretor-a' }));
    expect(emitter.emit).toHaveBeenCalledWith('lead.atribuido', expect.objectContaining({ ownerId: 'corretor-a' }));
    expect(emitter.emit).toHaveBeenCalledWith('lead.assumido', { tenantId: 't-1', cardId: 'c-1', ownerId: 'corretor-a', via: 'sugestao' });
  });

  it('sem sugestao pendente: recusa e nao avisa', async () => {
    const { uc, emitter } = montar({ id: 'c-1', suggestedOwnerId: null });
    await expect(uc.execute(entrada)).rejects.toBeInstanceOf(ConflictException);
    expect(emitter.emit).not.toHaveBeenCalled();
  });
});
