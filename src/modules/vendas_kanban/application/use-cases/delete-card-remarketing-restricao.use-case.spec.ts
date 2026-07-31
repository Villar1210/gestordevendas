// Defesa em profundidade: um Corretor comum nao pode excluir um card que
// pertence ao pipeline de remarketing ("Leads Nao Qualificados"), mesmo
// sabendo o cardId diretamente. Mesma checagem, mesma funcao de dominio
// (podeAcessarPipelineRemarketing) - ver demais specs irmas de restricao do
// funil de remarketing.
import { DeleteCardUseCase } from './delete-card.use-case';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';

function setup(pipelineName: string) {
  const cardRepository = { findByIdAndTenant: jest.fn(), delete: jest.fn() };
  const pipelineRepository = { findByIdAndTenant: jest.fn() };

  const useCase = new DeleteCardUseCase(
    cardRepository as unknown as ICardRepository,
    pipelineRepository as unknown as IPipelineRepository,
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
  cardRepository.delete.mockResolvedValue(undefined);

  return { useCase, cardRepository };
}

describe('DeleteCardUseCase - restricao do funil de remarketing', () => {
  it('Corretor comum tentando excluir um card do funil de remarketing: bloqueado (Forbidden)', async () => {
    const { useCase, cardRepository } = setup('Leads Nao Qualificados');

    await expect(
      useCase.execute({
        cardId: 'card-1',
        tenantId: 'tenant-1',
        requesterRole: 'Corretor',
        requesterCargo: 'corretor',
      }),
    ).rejects.toThrow('Voce nao tem acesso a este funil.');

    expect(cardRepository.delete).not.toHaveBeenCalled();
  });

  it('Administrador: consegue excluir card do funil de remarketing', async () => {
    const { useCase, cardRepository } = setup('Leads Nao Qualificados');

    await useCase.execute({
      cardId: 'card-1',
      tenantId: 'tenant-1',
      requesterRole: 'Administrador',
      requesterCargo: null,
    });

    expect(cardRepository.delete).toHaveBeenCalledWith('card-1');
  });

  it('cargo coordenador: consegue excluir card do funil de remarketing', async () => {
    const { useCase, cardRepository } = setup('Leads Nao Qualificados');

    await useCase.execute({
      cardId: 'card-1',
      tenantId: 'tenant-1',
      requesterRole: 'Corretor',
      requesterCargo: 'coordenador',
    });

    expect(cardRepository.delete).toHaveBeenCalledWith('card-1');
  });

  it('Corretor comum: excluir card de pipeline normal continua funcionando sem alteracao', async () => {
    const { useCase, cardRepository } = setup('Vendas');

    await useCase.execute({
      cardId: 'card-1',
      tenantId: 'tenant-1',
      requesterRole: 'Corretor',
      requesterCargo: 'corretor',
    });

    expect(cardRepository.delete).toHaveBeenCalledWith('card-1');
  });
});
