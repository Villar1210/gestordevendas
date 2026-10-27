// Fase B (Q5, 27/10/2026): o mesmo cliente nao vira 2 cards. Entrada nova de
// um telefone que ja tem card aberto vai para o card existente.
import { ConflictException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CreateQuickCardUseCase, LEAD_REENTRADA_EVENT } from './create-quick-card.use-case';
import { CreateCardUseCase } from './create-card.use-case';
import { CardAbertoPorTelefoneService } from '../services/card-aberto-por-telefone.service';

function montar(abertos: Array<Record<string, unknown>>) {
  const cardRepository = {
    findAbertosPorTrechoTelefone: jest.fn().mockResolvedValue(abertos),
    create: jest.fn().mockImplementation(async (d: object) => ({ id: 'card-novo', ...d })),
    findByIdAndTenant: jest.fn().mockImplementation(async (id: string) => abertos.find((c) => c.id === id) ?? null),
    updateStageAndPosition: jest.fn(),
    moverParaCaixaDeEntrada: jest.fn(),
    findAllByStage: jest.fn().mockResolvedValue([]),
  };
  const pipelineRepository = { findByIdAndTenant: jest.fn().mockResolvedValue({ id: 'p-1', name: 'Vendas' }) };
  const stageRepository = {
    findAllByPipeline: jest.fn().mockResolvedValue([
      { id: 's-atend', position: 0 },
      { id: 's-repique', position: 5 },
    ]),
    findByIdAndTenant: jest.fn().mockResolvedValue({ id: 's-atend', pipelineId: 'p-1' }),
  };
  const noteRepository = { create: jest.fn() };
  const emitter = { emit: jest.fn(), emitAsync: jest.fn().mockResolvedValue([]) };
  const busca = new CardAbertoPorTelefoneService(cardRepository as never);
  const useCase = new CreateQuickCardUseCase(
    pipelineRepository as never,
    cardRepository as never,
    emitter as unknown as EventEmitter2,
    stageRepository as never,
    noteRepository as never,
    busca,
  );
  const manual = new CreateCardUseCase(stageRepository as never, cardRepository as never, emitter as unknown as EventEmitter2, busca);
  return { useCase, manual, cardRepository, noteRepository, emitter };
}

const entrada = { tenantId: 't-1', pipelineId: 'p-1', title: 'Maria', origem: 'site', phone: '(11) 97387-9858', isSystemCall: true };

describe('Telefone unico na entrada de leads', () => {
  it('telefone novo: cria card e manda para a Roleta', async () => {
    const { useCase, cardRepository, emitter } = montar([]);
    const card = await useCase.execute(entrada);
    expect(card.reaproveitado).toBeUndefined();
    expect(cardRepository.create).toHaveBeenCalled();
    expect(emitter.emitAsync).toHaveBeenCalledWith('card.sem_dono.criado', expect.anything());
  });

  it('cliente com card aberto de um corretor: nao cria outro, anota e avisa o dono', async () => {
    const aberto = { id: 'c-1', pipelineId: 'p-1', stageId: 's-neg', stageName: 'Negociacao', ownerId: 'corretor-a', phone: '5511973879858' };
    const { useCase, cardRepository, noteRepository, emitter } = montar([aberto]);
    const card = await useCase.execute(entrada);
    expect(card.reaproveitado).toBe(true);
    expect(card.id).toBe('c-1');
    expect(cardRepository.create).not.toHaveBeenCalled();
    expect(noteRepository.create).toHaveBeenCalledWith(expect.objectContaining({ cardId: 'c-1' }));
    expect(emitter.emit).toHaveBeenCalledWith(LEAD_REENTRADA_EVENT, expect.objectContaining({ ownerId: 'corretor-a' }));
    expect(cardRepository.updateStageAndPosition).not.toHaveBeenCalled();
  });

  it('cliente no Repique com corretor: volta para a 1a etapa com o mesmo corretor', async () => {
    const aberto = { id: 'c-1', pipelineId: 'p-1', stageId: 's-repique', stageName: 'Repique', ownerId: 'corretor-a', phone: '11973879858' };
    const { useCase, cardRepository } = montar([aberto]);
    await useCase.execute(entrada);
    expect(cardRepository.updateStageAndPosition).toHaveBeenCalledWith('c-1', 's-atend', 0);
  });

  it('cliente no Repique sem corretor: volta para a Caixa de Entrada e passa pela Roleta', async () => {
    const aberto = { id: 'c-1', pipelineId: 'p-1', stageId: 's-repique', stageName: 'Repique', ownerId: null, phone: '11973879858' };
    const { useCase, cardRepository, emitter } = montar([aberto]);
    await useCase.execute(entrada);
    expect(cardRepository.moverParaCaixaDeEntrada).toHaveBeenCalledWith('c-1');
    expect(emitter.emitAsync).toHaveBeenCalledWith('card.sem_dono.criado', expect.objectContaining({ cardId: 'c-1' }));
  });

  it('telefone parecido mas diferente (mesmo final) cria card novo', async () => {
    const outro = { id: 'c-9', pipelineId: 'p-1', stageId: 's-neg', stageName: 'Negociacao', ownerId: 'x', phone: '(21) 97387-9858' };
    const { useCase, cardRepository } = montar([outro]);
    await useCase.execute(entrada);
    expect(cardRepository.create).toHaveBeenCalled();
  });

  it('"+ Novo Negocio" de cliente que ja esta com outro corretor: recusado', async () => {
    const aberto = { id: 'c-1', pipelineId: 'p-1', stageId: 's-neg', stageName: 'Negociacao', ownerId: 'corretor-a', phone: '11973879858' };
    const { manual, cardRepository } = montar([aberto]);
    await expect(
      manual.execute({ tenantId: 't-1', ownerId: 'corretor-b', pipelineId: 'p-1', title: 'Maria', phone: '11 97387-9858' }),
    ).rejects.toThrow(ConflictException);
    expect(cardRepository.create).not.toHaveBeenCalled();
  });
});
