// Fase B (Q6, 27/10/2026): sem aceite no prazo e sem outro corretor, o lead
// vai para a gestao (antes ficava com quem nao aceitou, sem aviso).
import { ProcessRoletaTimeoutsUseCase, LEAD_ESCALADO_GESTAO_EVENT } from './process-roleta-timeouts.use-case';

const AGORA = new Date(Date.UTC(2026, 9, 27, 15, 0)); // 12h em Sao Paulo
const vencido = new Date(AGORA.getTime() - 10 * 60_000);
const card = { id: 'c-1', tenantId: 't-1', pipelineId: 'p-1', stageId: 's-1', ownerId: 'corretor-a', atribuidoAutomaticamenteEm: vencido };

function montar(config: { algoritmo: string }, opcoes: { online?: Array<{ id: string }>; escolha?: { userId: string } | null; gestor?: { id: string; name: string } | null }) {
  const cardRepository = {
    findPendentesDeAceite: jest.fn().mockResolvedValue([card]),
    reatribuirSeAindaPendente: jest.fn().mockResolvedValue(true),
    clearAtribuidoAutomaticamente: jest.fn(),
  };
  const emitter = { emit: jest.fn() };
  const useCase = new ProcessRoletaTimeoutsUseCase(
    { findByTenant: jest.fn().mockResolvedValue({ ...config, timeoutAceiteMinutos: 5, ultimoCorretorId: null }), updateUltimoCorretor: jest.fn() } as never,
    { findOnlineByTenantAndRole: jest.fn().mockResolvedValue(opcoes.online ?? []) } as never,
    { findByTenantAndName: jest.fn().mockResolvedValue({ id: 'role-corretor' }) } as never,
    cardRepository as never,
    { findAllByPipeline: jest.fn().mockResolvedValue([]) } as never,
    emitter as never,
    { escolherParaLead: jest.fn().mockResolvedValue(opcoes.escolha ?? null) } as never,
    { encontrarParaCorretor: jest.fn().mockResolvedValue(opcoes.gestor === undefined ? { id: 'gerente', name: 'Gerente' } : opcoes.gestor) } as never,
  );
  return { useCase, cardRepository, emitter };
}

describe('Timeout da Roleta sem outro corretor', () => {
  it('round robin sem ninguem online: lead vai para o gestor, sem novo prazo, com avisos', async () => {
    const { useCase, cardRepository, emitter } = montar({ algoritmo: 'round_robin' }, { online: [{ id: 'corretor-a' }] });
    await useCase.execute(AGORA);
    expect(cardRepository.reatribuirSeAindaPendente).toHaveBeenCalledWith('c-1', 'gerente', expect.any(Date), 'corretor-a');
    expect(cardRepository.clearAtribuidoAutomaticamente).toHaveBeenCalledWith('c-1');
    expect(emitter.emit).toHaveBeenCalledWith('lead.atribuido', expect.objectContaining({ ownerId: 'gerente' }));
    expect(emitter.emit).toHaveBeenCalledWith(LEAD_ESCALADO_GESTAO_EVENT, expect.objectContaining({ gestorId: 'gerente', corretorAnteriorId: 'corretor-a' }));
  });

  it('sorteio sem outro corretor presente: tambem vai para o gestor', async () => {
    const { useCase, cardRepository } = montar({ algoritmo: 'sorteio' }, { escolha: null });
    await useCase.execute(AGORA);
    expect(cardRepository.reatribuirSeAindaPendente).toHaveBeenCalledWith('c-1', 'gerente', expect.any(Date), 'corretor-a');
  });

  it('com outro corretor online continua reatribuindo para ele (sem mudar)', async () => {
    const { useCase, cardRepository, emitter } = montar({ algoritmo: 'round_robin' }, { online: [{ id: 'corretor-a' }, { id: 'corretor-b' }] });
    await useCase.execute(AGORA);
    expect(cardRepository.reatribuirSeAindaPendente).toHaveBeenCalledWith('c-1', 'corretor-b', expect.any(Date), 'corretor-a');
    expect(emitter.emit).not.toHaveBeenCalledWith(LEAD_ESCALADO_GESTAO_EVENT, expect.anything());
  });

  it('sem gestor no tenant: mantem com o corretor e para de contar o prazo', async () => {
    const { useCase, cardRepository } = montar({ algoritmo: 'round_robin' }, { online: [], gestor: null });
    await useCase.execute(AGORA);
    expect(cardRepository.reatribuirSeAindaPendente).not.toHaveBeenCalled();
    expect(cardRepository.clearAtribuidoAutomaticamente).toHaveBeenCalledWith('c-1');
  });

  it('fora do horario (22h) o prazo fica parado', async () => {
    const { useCase, cardRepository } = montar({ algoritmo: 'round_robin' }, { online: [] });
    await useCase.execute(new Date(Date.UTC(2026, 9, 28, 1, 0)));
    expect(cardRepository.findPendentesDeAceite).not.toHaveBeenCalled();
  });

  it('lead atribuido as 19h58: as 9h02 do dia seguinte ainda esta no prazo', async () => {
    const atribuido = new Date(Date.UTC(2026, 9, 27, 22, 58)); // 19h58 SP
    const { useCase, cardRepository } = montar({ algoritmo: 'round_robin' }, { online: [] });
    cardRepository.findPendentesDeAceite.mockResolvedValue([{ ...card, atribuidoAutomaticamenteEm: atribuido }]);
    await useCase.execute(new Date(Date.UTC(2026, 9, 28, 12, 2))); // 9h02 SP
    expect(cardRepository.reatribuirSeAindaPendente).not.toHaveBeenCalled();
  });

  it('corretor aceitou no meio do caminho: nao repassa nem avisa', async () => {
    const { useCase, cardRepository, emitter } = montar({ algoritmo: 'round_robin' }, { online: [] });
    cardRepository.reatribuirSeAindaPendente.mockResolvedValue(false);
    await useCase.execute(AGORA);
    expect(emitter.emit).not.toHaveBeenCalled();
  });
});
