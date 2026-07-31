// Defesa em profundidade: um Corretor comum nao pode editar um card que
// pertence ao pipeline de remarketing ("Leads Nao Qualificados"), mesmo
// sabendo o cardId diretamente. Mesma checagem, mesma funcao de dominio
// (podeAcessarPipelineRemarketing) - ver demais specs irmas de restricao do
// funil de remarketing.
import { UpdateCardUseCase } from './update-card.use-case';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';

function setup(pipelineName: string) {
  const cardRepository = { findByIdAndTenant: jest.fn(), update: jest.fn() };
  const pipelineRepository = { findByIdAndTenant: jest.fn() };

  const useCase = new UpdateCardUseCase(
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
  cardRepository.update.mockImplementation(async (id, data) => ({ id, ...data }));

  return { useCase, cardRepository };
}

describe('UpdateCardUseCase - restricao do funil de remarketing', () => {
  it('Corretor comum tentando editar um card do funil de remarketing: bloqueado (Forbidden)', async () => {
    const { useCase, cardRepository } = setup('Leads Nao Qualificados');

    await expect(
      useCase.execute({
        cardId: 'card-1',
        tenantId: 'tenant-1',
        requesterRole: 'Corretor',
        requesterCargo: 'corretor',
        title: 'Titulo adulterado',
      }),
    ).rejects.toThrow('Voce nao tem acesso a este funil.');

    expect(cardRepository.update).not.toHaveBeenCalled();
  });

  it('Administrador: consegue editar card do funil de remarketing', async () => {
    const { useCase } = setup('Leads Nao Qualificados');

    const card = await useCase.execute({
      cardId: 'card-1',
      tenantId: 'tenant-1',
      requesterRole: 'Administrador',
      requesterCargo: null,
      title: 'Titulo corrigido pelo Admin',
    });

    expect(card.title).toBe('Titulo corrigido pelo Admin');
  });

  it('cargo coordenador: consegue editar card do funil de remarketing', async () => {
    const { useCase } = setup('Leads Nao Qualificados');

    const card = await useCase.execute({
      cardId: 'card-1',
      tenantId: 'tenant-1',
      requesterRole: 'Corretor',
      requesterCargo: 'coordenador',
      title: 'Titulo corrigido pelo coordenador',
    });

    expect(card.title).toBe('Titulo corrigido pelo coordenador');
  });

  it('Corretor comum: editar card de pipeline normal continua funcionando sem alteracao', async () => {
    const { useCase } = setup('Vendas');

    const card = await useCase.execute({
      cardId: 'card-1',
      tenantId: 'tenant-1',
      requesterRole: 'Corretor',
      requesterCargo: 'corretor',
      title: 'Titulo normal',
    });

    expect(card.title).toBe('Titulo normal');
  });
});
