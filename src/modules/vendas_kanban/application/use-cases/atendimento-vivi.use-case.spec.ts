// Fase B (27/10/2026): coluna "Atendimento VIVI".
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { RegistrarAtendimentoViviUseCase, INTERVALO_AVISO_CORRETOR_MS } from './registrar-atendimento-vivi.use-case';
import {
  EncaminharAtendimentoViviParaRoletaUseCase,
  MoverAtendimentoViviParadoParaRepiqueUseCase,
} from './atendimento-vivi-gestao.use-cases';
import { CreateQuickCardUseCase, LEAD_REENTRADA_EVENT } from './create-quick-card.use-case';
import { ClaimCardUseCase } from './claim-card.use-case';

const agora = new Date('2026-10-27T15:00:00Z');

function repos(existente: Record<string, unknown> | null) {
  const cardRepository = {
    create: jest.fn().mockImplementation(async (d: object) => ({ id: 'card-novo', ...d })),
    registrarInteracaoVivi: jest.fn(),
    marcarAtendimentoVivi: jest.fn(),
    sairDoAtendimentoVivi: jest.fn(),
    updateStageAndPosition: jest.fn(),
    findByIdAndTenant: jest.fn().mockResolvedValue(existente),
    findAtendimentoViviSemInteracaoDesde: jest.fn(),
    atualizarDadosDeEntrada: jest.fn(),
    moverDoAtendimentoViviParaRepique: jest.fn(),
  };
  const pipelineRepository = {
    findAllByTenant: jest.fn().mockResolvedValue([{ id: 'p-vendas', name: 'Vendas' }]),
    findByIdAndTenant: jest.fn().mockResolvedValue({ id: 'p-vendas', name: 'Vendas' }),
  };
  const stageRepository = {
    findAllByPipeline: jest.fn().mockResolvedValue([
      { id: 's-atend', name: 'Em Atendimento', position: 0 },
      { id: 's-repique', name: 'Repique', position: 5 },
    ]),
  };
  const busca = { encontrar: jest.fn().mockResolvedValue(existente), chaveDaTrava: (t: string, p: string) => `${t}:${p}` };
  const emitter = { emit: jest.fn(), emitAsync: jest.fn().mockResolvedValue([]) };
  return { cardRepository, pipelineRepository, stageRepository, busca, emitter };
}

function registrar(existente: Record<string, unknown> | null) {
  const r = repos(existente);
  const useCase = new RegistrarAtendimentoViviUseCase(
    r.cardRepository as never,
    r.pipelineRepository as never,
    r.stageRepository as never,
    r.busca as never,
    r.emitter as never,
  );
  return { ...r, useCase };
}

const entrada = { tenantId: 't-1', phone: '5511973879858', nome: 'Maria', mensagem: 'Oi', agora };

describe('Atendimento VIVI - registro a cada mensagem', () => {
  it('telefone novo: cria o card na coluna, sem etapa, sem dono e SEM Roleta', async () => {
    const { useCase, cardRepository, emitter } = registrar(null);
    const r = await useCase.execute(entrada);
    expect(r).toEqual({ cardId: 'card-novo', situacao: 'em_atendimento_vivi', criado: true });
    expect(cardRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ pipelineId: 'p-vendas', stageId: null, ownerId: null, emAtendimentoVivi: true, ultimaInteracaoViviEm: agora }),
    );
    expect(emitter.emitAsync).not.toHaveBeenCalled();
  });

  it('ja na coluna: so registra a interacao', async () => {
    const { useCase, cardRepository } = registrar({ id: 'c-1', emAtendimentoVivi: true, ownerId: null, stageId: null });
    const r = await useCase.execute(entrada);
    expect(r.situacao).toBe('em_atendimento_vivi');
    expect(cardRepository.registrarInteracaoVivi).toHaveBeenCalledWith('c-1', agora);
    expect(cardRepository.create).not.toHaveBeenCalled();
  });

  it('cliente com corretor: avisa o corretor no maximo a cada 12 h', async () => {
    const recente = new Date(agora.getTime() - 60 * 60 * 1000);
    const a = registrar({ id: 'c-1', ownerId: 'corretor-a', stageId: 's-neg', stageName: 'Negociacao', ultimaInteracaoViviEm: recente });
    expect((await a.useCase.execute(entrada)).situacao).toBe('com_corretor');
    expect(a.emitter.emit).not.toHaveBeenCalledWith(LEAD_REENTRADA_EVENT, expect.anything());

    const antigo = new Date(agora.getTime() - INTERVALO_AVISO_CORRETOR_MS - 1);
    const b = registrar({ id: 'c-1', ownerId: 'corretor-a', stageId: 's-neg', stageName: 'Negociacao', ultimaInteracaoViviEm: antigo });
    await b.useCase.execute(entrada);
    expect(b.emitter.emit).toHaveBeenCalledWith(LEAD_REENTRADA_EVENT, expect.objectContaining({ ownerId: 'corretor-a' }));
  });

  it('Repique com corretor: volta para a 1a etapa com o mesmo corretor', async () => {
    const { useCase, cardRepository } = registrar({ id: 'c-1', pipelineId: 'p-vendas', ownerId: 'corretor-a', stageId: 's-repique', stageName: 'Repique', ultimaInteracaoViviEm: null });
    await useCase.execute(entrada);
    expect(cardRepository.updateStageAndPosition).toHaveBeenCalledWith('c-1', 's-atend', 0);
  });

  it('Repique sem corretor: volta para a coluna da VIVI', async () => {
    const { useCase, cardRepository } = registrar({ id: 'c-1', pipelineId: 'p-vendas', ownerId: null, stageId: 's-repique', stageName: 'Repique' });
    const r = await useCase.execute(entrada);
    expect(r.situacao).toBe('em_atendimento_vivi');
    expect(cardRepository.marcarAtendimentoVivi).toHaveBeenCalledWith('c-1', agora);
  });

  it('Caixa de Entrada aguardando a Roleta: so registra', async () => {
    const { useCase, cardRepository } = registrar({ id: 'c-1', ownerId: null, stageId: null, emAtendimentoVivi: false });
    expect((await useCase.execute(entrada)).situacao).toBe('aguardando_corretor');
    expect(cardRepository.marcarAtendimentoVivi).not.toHaveBeenCalled();
  });
});

describe('Atendimento VIVI - saida da coluna', () => {
  it('agendou visita / pediu corretor (entrada na Caixa de Entrada): sai da coluna e vai para a Roleta', async () => {
    const card = { id: 'c-1', pipelineId: 'p-vendas', ownerId: null, stageId: null, emAtendimentoVivi: true, phone: '5511973879858' };
    const r = repos(card);
    const quick = new CreateQuickCardUseCase(
      r.pipelineRepository as never,
      r.cardRepository as never,
      r.emitter as never,
      r.stageRepository as never,
      { create: jest.fn() } as never,
      r.busca as never,
    );
    const res = await quick.execute({
      tenantId: 't-1', pipelineId: 'p-vendas', title: 'Maria - visita via VIVI', phone: '11973879858', isSystemCall: true,
      description: 'Renda 5k, quer 2 dorm', empreendimentoId: 'emp-1',
    });
    expect(res.reaproveitado).toBe(true);
    // Resumo e produto (decide a roleta do sorteio) chegam ao card ANTES da Roleta.
    expect(r.cardRepository.atualizarDadosDeEntrada).toHaveBeenCalledWith('c-1', expect.objectContaining({ description: 'Renda 5k, quer 2 dorm', empreendimentoId: 'emp-1' }));
    expect(r.cardRepository.atualizarDadosDeEntrada.mock.invocationCallOrder[0]).toBeLessThan(r.emitter.emitAsync.mock.invocationCallOrder[0]);
    expect(r.cardRepository.sairDoAtendimentoVivi).toHaveBeenCalledWith('c-1');
    expect(r.emitter.emitAsync).toHaveBeenCalledWith('card.sem_dono.criado', expect.objectContaining({ cardId: 'c-1' }));
    expect(r.cardRepository.create).not.toHaveBeenCalled();
  });

  it('so a gestao manda direto para a Roleta', async () => {
    const card = { id: 'c-1', tenantId: 't-1', pipelineId: 'p-vendas', emAtendimentoVivi: true };
    const r = repos(card);
    const uc = new EncaminharAtendimentoViviParaRoletaUseCase(r.cardRepository as never, r.emitter as never);
    await expect(uc.execute({ tenantId: 't-1', cardId: 'c-1', requesterRole: 'Corretor', requesterCargo: 'corretor' })).rejects.toThrow(ForbiddenException);
    await uc.execute({ tenantId: 't-1', cardId: 'c-1', requesterRole: 'Corretor', requesterCargo: 'gerente' });
    expect(r.cardRepository.sairDoAtendimentoVivi).toHaveBeenCalledWith('c-1');
    expect(r.emitter.emitAsync).toHaveBeenCalledWith('card.sem_dono.criado', expect.anything());
  });

  it('7 dias sem interacao: vai para o Repique com motivo SEM_RESPOSTA_VIVI', async () => {
    const r = repos(null);
    r.cardRepository.findAtendimentoViviSemInteracaoDesde.mockResolvedValue([{ id: 'c-1', tenantId: 't-1', pipelineId: 'p-vendas' }]);
    const uc = new MoverAtendimentoViviParadoParaRepiqueUseCase(r.cardRepository as never, r.stageRepository as never, r.emitter as never);
    expect(await uc.execute(agora)).toBe(1);
    const limite = r.cardRepository.findAtendimentoViviSemInteracaoDesde.mock.calls[0][0] as Date;
    expect(agora.getTime() - limite.getTime()).toBe(7 * 24 * 60 * 60 * 1000);
    expect(r.cardRepository.moverDoAtendimentoViviParaRepique).toHaveBeenCalledWith('c-1', 's-repique', agora);
  });

  it('corretor nao "assume" lead que esta com a VIVI', async () => {
    const card = { id: 'c-1', tenantId: 't-1', pipelineId: 'p-vendas', ownerId: null, stageId: null, emAtendimentoVivi: true };
    const r = repos(card);
    const claim = new ClaimCardUseCase(r.pipelineRepository as never, r.stageRepository as never, r.cardRepository as never, r.emitter as never);
    await expect(claim.execute({ cardId: 'c-1', tenantId: 't-1', userId: 'u-1', requesterRole: 'Corretor', requesterCargo: 'corretor' } as never)).rejects.toThrow(ConflictException);
  });
});
