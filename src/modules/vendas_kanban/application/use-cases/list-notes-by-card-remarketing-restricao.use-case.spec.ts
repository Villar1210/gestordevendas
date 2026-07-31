// Defesa em profundidade: um Corretor comum nao pode listar as anotacoes de
// um card que pertence ao pipeline de remarketing ("Leads Nao Qualificados"),
// mesmo sabendo o cardId diretamente. Mesma checagem, mesma funcao de
// dominio (podeAcessarPipelineRemarketing) - ver
// list-activities-by-card-remarketing-restricao.use-case.spec.ts e demais
// specs irmas de restricao do funil de remarketing.
import { ListNotesByCardUseCase } from './list-notes-by-card.use-case';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { INoteRepository } from '../../domain/repositories/note-repository.interface';

function setup(pipelineName: string) {
  const cardRepository = { findByIdAndTenant: jest.fn() };
  const pipelineRepository = { findByIdAndTenant: jest.fn() };
  const noteRepository = { findAllByCard: jest.fn() };

  const useCase = new ListNotesByCardUseCase(
    cardRepository as unknown as ICardRepository,
    pipelineRepository as unknown as IPipelineRepository,
    noteRepository as unknown as INoteRepository,
  );

  cardRepository.findByIdAndTenant.mockResolvedValue({
    id: 'card-1',
    tenantId: 'tenant-1',
    pipelineId: 'pipeline-1',
  });
  pipelineRepository.findByIdAndTenant.mockResolvedValue({
    id: 'pipeline-1',
    tenantId: 'tenant-1',
    name: pipelineName,
    createdAt: new Date(),
  });
  noteRepository.findAllByCard.mockResolvedValue([{ id: 'note-1' }]);

  return { useCase, noteRepository };
}

describe('ListNotesByCardUseCase - restricao do funil de remarketing', () => {
  it('Corretor comum tentando listar notas de um card do funil de remarketing: bloqueado (Forbidden)', async () => {
    const { useCase, noteRepository } = setup('Leads Nao Qualificados');

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        cardId: 'card-1',
        requesterRole: 'Corretor',
        requesterCargo: 'corretor',
      }),
    ).rejects.toThrow('Voce nao tem acesso a este funil.');

    expect(noteRepository.findAllByCard).not.toHaveBeenCalled();
  });

  it('Administrador: consegue listar notas de um card do funil de remarketing', async () => {
    const { useCase } = setup('Leads Nao Qualificados');

    const notes = await useCase.execute({
      tenantId: 'tenant-1',
      cardId: 'card-1',
      requesterRole: 'Administrador',
      requesterCargo: null,
    });

    expect(notes).toHaveLength(1);
  });

  it('cargo coordenador: consegue listar notas de um card do funil de remarketing', async () => {
    const { useCase } = setup('Leads Nao Qualificados');

    const notes = await useCase.execute({
      tenantId: 'tenant-1',
      cardId: 'card-1',
      requesterRole: 'Corretor',
      requesterCargo: 'coordenador',
    });

    expect(notes).toHaveLength(1);
  });

  it('Corretor comum: listagem em card de pipeline normal continua funcionando sem alteracao', async () => {
    const { useCase } = setup('Vendas');

    const notes = await useCase.execute({
      tenantId: 'tenant-1',
      cardId: 'card-1',
      requesterRole: 'Corretor',
      requesterCargo: 'corretor',
    });

    expect(notes).toHaveLength(1);
  });
});
