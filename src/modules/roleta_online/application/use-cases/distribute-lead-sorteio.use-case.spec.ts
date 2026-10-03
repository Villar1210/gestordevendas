// Fatia 2 (Sorteio da vez): com algoritmo "sorteio", a DistributeLeadUseCase
// usa a fila da roleta (FilaRoletaService) em vez de rodizio/menor fila.
import { DistributeLeadUseCase } from './distribute-lead.use-case';

function montar(config: Record<string, unknown>, escolha: { userId: string; roletaId: string } | null) {
  const roletaConfigRepository = { findByTenant: jest.fn().mockResolvedValue(config), updateUltimoCorretor: jest.fn() };
  const corretorRepository = { findOnlineByTenantAndRole: jest.fn() };
  const roleRepository = { findByTenantAndName: jest.fn() };
  const cardRepository = { markAtribuidoAutomaticamente: jest.fn(), updateSuggestedOwner: jest.fn() };
  const stageRepository = { findAllByPipeline: jest.fn() };
  const claimCardUseCase = { execute: jest.fn() };
  const eventEmitter = { emit: jest.fn() };
  const filaRoletaService = { escolherParaLead: jest.fn().mockResolvedValue(escolha) };
  const useCase = new DistributeLeadUseCase(
    roletaConfigRepository as any,
    corretorRepository as any,
    roleRepository as any,
    cardRepository as any,
    stageRepository as any,
    claimCardUseCase as any,
    eventEmitter as any,
    filaRoletaService as any,
  );
  return { useCase, claimCardUseCase, cardRepository, corretorRepository, filaRoletaService, eventEmitter };
}

const input = { tenantId: 't1', cardId: 'card-1', pipelineId: 'p1' };

describe('DistributeLeadUseCase - algoritmo sorteio', () => {
  it('modo automatico: atribui ao proximo da fila da roleta', async () => {
    const m = montar({ ativa: true, algoritmo: 'sorteio', modo: 'automatico' }, { userId: 'u-2', roletaId: 'r1' });
    await m.useCase.execute(input);
    expect(m.filaRoletaService.escolherParaLead).toHaveBeenCalledWith('t1', 'card-1');
    expect(m.claimCardUseCase.execute).toHaveBeenCalledWith(expect.objectContaining({ cardId: 'card-1', userId: 'u-2' }));
    expect(m.eventEmitter.emit).toHaveBeenCalledWith('lead.atribuido', expect.objectContaining({ ownerId: 'u-2' }));
    expect(m.corretorRepository.findOnlineByTenantAndRole).not.toHaveBeenCalled();
  });

  it('modo semi-automatico: so sugere', async () => {
    const m = montar({ ativa: true, algoritmo: 'sorteio', modo: 'semi_automatico' }, { userId: 'u-3', roletaId: 'r1' });
    await m.useCase.execute(input);
    expect(m.cardRepository.updateSuggestedOwner).toHaveBeenCalledWith('card-1', 'u-3');
    expect(m.claimCardUseCase.execute).not.toHaveBeenCalled();
  });

  it('sem ninguem presente na roleta: lead fica na Caixa de Entrada', async () => {
    const m = montar({ ativa: true, algoritmo: 'sorteio', modo: 'automatico' }, null);
    await m.useCase.execute(input);
    expect(m.claimCardUseCase.execute).not.toHaveBeenCalled();
    expect(m.cardRepository.updateSuggestedOwner).not.toHaveBeenCalled();
  });
});
