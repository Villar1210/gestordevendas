// WhatsApp integrado - Etapa 2 (19/11/2026): o aceite do lead avisa
// ('lead.assumido') para a conversa sair da VIVI.
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AceitarLeadUseCase } from './aceitar-lead.use-case';

const pendente = { id: 'c-1', tenantId: 't-1', ownerId: 'corretor-a', atribuidoAutomaticamenteEm: new Date(), aceitoEm: null };

function montar(card: Record<string, unknown> | null) {
  const cardRepository = {
    findByIdAndTenant: jest.fn().mockResolvedValue(card),
    aceitarLead: jest.fn().mockImplementation(async (_id: string, when: Date) => ({ ...card, aceitoEm: when })),
  };
  const emitter = { emit: jest.fn() };
  return { uc: new AceitarLeadUseCase(cardRepository as never, emitter as never), cardRepository, emitter };
}
const entrada = { cardId: 'c-1', tenantId: 't-1', requesterUserId: 'corretor-a', requesterRole: 'Corretor' };

describe('AceitarLeadUseCase', () => {
  it('corretor atribuido aceita: grava o aceite e avisa lead.assumido (via aceite)', async () => {
    const { uc, cardRepository, emitter } = montar(pendente);
    await uc.execute(entrada);
    expect(cardRepository.aceitarLead).toHaveBeenCalledWith('c-1', expect.any(Date));
    expect(emitter.emit).toHaveBeenCalledWith('lead.assumido', { tenantId: 't-1', cardId: 'c-1', ownerId: 'corretor-a', via: 'aceite' });
  });

  it('clique duplo (ja aceito): nao grava nem avisa de novo', async () => {
    const { uc, cardRepository, emitter } = montar({ ...pendente, aceitoEm: new Date() });
    await uc.execute(entrada);
    expect(cardRepository.aceitarLead).not.toHaveBeenCalled();
    expect(emitter.emit).not.toHaveBeenCalled();
  });

  it('outro corretor nao aceita; card fora da Roleta e recusado - sem aviso', async () => {
    const a = montar(pendente);
    await expect(a.uc.execute({ ...entrada, requesterUserId: 'corretor-b' })).rejects.toBeInstanceOf(ForbiddenException);
    const b = montar({ ...pendente, atribuidoAutomaticamenteEm: null });
    await expect(b.uc.execute(entrada)).rejects.toBeInstanceOf(BadRequestException);
    expect(a.emitter.emit).not.toHaveBeenCalled();
    expect(b.emitter.emit).not.toHaveBeenCalled();
  });
});
