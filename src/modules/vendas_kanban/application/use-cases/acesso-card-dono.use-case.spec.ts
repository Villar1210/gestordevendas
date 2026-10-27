// Q11 do mapa de processos (27/10/2026): antes, qualquer corretor com o id de
// um card de outro corretor conseguia mover, editar, excluir e mexer em
// atividades/notas. Agora so dono, superiores e Administrador.
import { ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MoveCardUseCase } from './move-card.use-case';
import { UpdateCardUseCase } from './update-card.use-case';
import { DeleteCardUseCase } from './delete-card.use-case';
import { CreateNoteUseCase } from './create-note.use-case';
import { CreateActivityUseCase } from './create-activity.use-case';
import { ToggleActivityDoneUseCase } from './toggle-activity-done.use-case';
import { ListNotesByCardUseCase } from './list-notes-by-card.use-case';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import { INoteRepository } from '../../domain/repositories/note-repository.interface';
import { IActivityRepository } from '../../domain/repositories/activity-repository.interface';
import { RequisitanteCard } from '../services/acesso-card.service';
import { acessoCardSemChecagem } from '../../../../../test/vendas_kanban/acesso-card.helper';

const corretorA: RequisitanteCard = { userId: 'corretor-a', role: 'Corretor', cargo: 'corretor', standId: null };
const corretorB: RequisitanteCard = { userId: 'corretor-b', role: 'Corretor', cargo: 'corretor', standId: null };
const gerenteDoA: RequisitanteCard = { userId: 'gerente', role: 'Corretor', cargo: 'gerente', standId: null };
const admin: RequisitanteCard = { userId: 'admin', role: 'Administrador', cargo: null, standId: null };

function repos(ownerId: string | null) {
  const card = { id: 'card-1', tenantId: 't-1', pipelineId: 'p-1', stageId: 's-1', ownerId };
  const cardRepository = {
    findByIdAndTenant: jest.fn().mockResolvedValue(card),
    update: jest.fn().mockResolvedValue(card),
    delete: jest.fn(),
    updateStageAndPosition: jest.fn().mockResolvedValue({ newPosition: 0 }),
  };
  const pipelineRepository = { findByIdAndTenant: jest.fn().mockResolvedValue({ id: 'p-1', name: 'Vendas' }) };
  const stageRepository = {
    findByIdAndTenant: jest.fn().mockResolvedValue({ id: 's-2', pipelineId: 'p-1', name: 'Negociacao' }),
  };
  const noteRepository = { create: jest.fn().mockResolvedValue({ id: 'n-1' }), findAllByCard: jest.fn().mockResolvedValue([]) };
  const activityRepository = {
    create: jest.fn().mockResolvedValue({ id: 'a-1' }),
    findByIdAndTenant: jest.fn().mockResolvedValue({ id: 'a-1', cardId: 'card-1', done: false }),
    setDone: jest.fn().mockResolvedValue({ id: 'a-1', done: true }),
  };
  return { cardRepository, pipelineRepository, stageRepository, noteRepository, activityRepository };
}

const acesso = () => acessoCardSemChecagem(['corretor-a']);

describe('Card: so dono, superiores e Administrador alteram', () => {
  it('outro corretor NAO move, edita, exclui, anota, agenda nem conclui atividade', async () => {
    const r = repos('corretor-a');
    const move = new MoveCardUseCase(
      r.stageRepository as unknown as IStageRepository,
      r.cardRepository as unknown as ICardRepository,
      r.pipelineRepository as unknown as IPipelineRepository,
      { emit: jest.fn() } as unknown as EventEmitter2,
      acesso(),
    );
    const update = new UpdateCardUseCase(r.cardRepository as unknown as ICardRepository, r.pipelineRepository as unknown as IPipelineRepository, acesso());
    const del = new DeleteCardUseCase(r.cardRepository as unknown as ICardRepository, r.pipelineRepository as unknown as IPipelineRepository, acesso());
    const note = new CreateNoteUseCase(r.cardRepository as unknown as ICardRepository, r.noteRepository as unknown as INoteRepository, acesso());
    const activity = new CreateActivityUseCase(r.cardRepository as unknown as ICardRepository, r.activityRepository as unknown as IActivityRepository, acesso());
    const toggle = new ToggleActivityDoneUseCase(
      r.activityRepository as unknown as IActivityRepository,
      r.cardRepository as unknown as ICardRepository,
      acesso(),
    );
    const base = { tenantId: 't-1', requisitante: corretorB };

    await expect(move.execute({ ...base, cardId: 'card-1', targetStageId: 's-2', newPosition: 0, requesterRole: 'Corretor', requesterCargo: 'corretor' } as never)).rejects.toThrow(ForbiddenException);
    await expect(update.execute({ ...base, cardId: 'card-1', requesterRole: 'Corretor', requesterCargo: 'corretor', title: 'x' })).rejects.toThrow(ForbiddenException);
    await expect(del.execute({ ...base, cardId: 'card-1', requesterRole: 'Corretor', requesterCargo: 'corretor' })).rejects.toThrow(ForbiddenException);
    await expect(note.execute({ ...base, cardId: 'card-1', body: 'x' })).rejects.toThrow(ForbiddenException);
    await expect(activity.execute({ ...base, cardId: 'card-1', type: 'ligacao' })).rejects.toThrow(ForbiddenException);
    await expect(toggle.execute({ ...base, activityId: 'a-1' })).rejects.toThrow(ForbiddenException);

    expect(r.cardRepository.updateStageAndPosition).not.toHaveBeenCalled();
    expect(r.cardRepository.update).not.toHaveBeenCalled();
    expect(r.cardRepository.delete).not.toHaveBeenCalled();
    expect(r.noteRepository.create).not.toHaveBeenCalled();
    expect(r.activityRepository.create).not.toHaveBeenCalled();
    expect(r.activityRepository.setDone).not.toHaveBeenCalled();
  });

  it('dono, gerente do dono e Administrador editam', async () => {
    for (const quem of [corretorA, gerenteDoA, admin]) {
      const r = repos('corretor-a');
      const update = new UpdateCardUseCase(r.cardRepository as unknown as ICardRepository, r.pipelineRepository as unknown as IPipelineRepository, acesso());
      await update.execute({ cardId: 'card-1', tenantId: 't-1', requesterRole: quem.role, requesterCargo: quem.cargo, title: 'ok', requisitante: quem });
      expect(r.cardRepository.update).toHaveBeenCalled();
    }
  });

  it('outro corretor tambem NAO le as notas do card', async () => {
    const r = repos('corretor-a');
    const list = new ListNotesByCardUseCase(
      r.cardRepository as unknown as ICardRepository,
      r.pipelineRepository as unknown as IPipelineRepository,
      r.noteRepository as unknown as INoteRepository,
      acesso(),
    );
    await expect(list.execute({ cardId: 'card-1', tenantId: 't-1', requesterRole: 'Corretor', requesterCargo: 'corretor', requisitante: corretorB })).rejects.toThrow(ForbiddenException);
  });

  it('chamada interna do sistema (sem requisitante, ex.: VIVI movendo card) continua liberada', async () => {
    const r = repos('corretor-a');
    const note = new CreateNoteUseCase(r.cardRepository as unknown as ICardRepository, r.noteRepository as unknown as INoteRepository, acesso());
    await note.execute({ tenantId: 't-1', cardId: 'card-1', body: 'resumo da VIVI' });
    expect(r.noteRepository.create).toHaveBeenCalled();
  });
});
