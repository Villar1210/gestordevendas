// Defesa em profundidade: um Corretor comum nao pode criar um card
// diretamente no pipeline de remarketing ("Leads Nao Qualificados") via
// POST /cards/quick, mesmo sabendo o pipelineId (que ja e escondido do
// seletor por ListPipelinesUseCase). Mesma checagem, mesma funcao de
// dominio (podeAcessarPipelineRemarketing) - ver
// get-board-remarketing-restricao.use-case.spec.ts,
// claim-card-remarketing-restricao.use-case.spec.ts e
// get-inbox-remarketing-restricao.use-case.spec.ts.
import { CreateQuickCardUseCase } from './create-quick-card.use-case';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { EventEmitter2 } from '@nestjs/event-emitter';

function setup(pipelineName: string) {
  const pipelineRepository = { findByIdAndTenant: jest.fn() };
  const cardRepository = { create: jest.fn() };
  const eventEmitter = { emit: jest.fn() };

  const useCase = new CreateQuickCardUseCase(
    pipelineRepository as unknown as IPipelineRepository,
    cardRepository as unknown as ICardRepository,
    eventEmitter as unknown as EventEmitter2,
  );

  pipelineRepository.findByIdAndTenant.mockResolvedValue({
    id: 'pipeline-1',
    tenantId: 'tenant-1',
    name: pipelineName,
    createdAt: new Date(),
  });
  cardRepository.create.mockImplementation(async (data) => ({ id: 'card-1', ...data }));

  return { useCase, cardRepository };
}

describe('CreateQuickCardUseCase - restricao do funil de remarketing', () => {
  it('Corretor comum tentando criar card no funil de remarketing: bloqueado (Forbidden)', async () => {
    const { useCase, cardRepository } = setup('Leads Nao Qualificados');

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        pipelineId: 'pipeline-1',
        requesterRole: 'Corretor',
        requesterCargo: 'corretor',
        title: 'Lead suspeito',
      }),
    ).rejects.toThrow('Voce nao tem acesso a este funil.');

    expect(cardRepository.create).not.toHaveBeenCalled();
  });

  it('Administrador: consegue criar card no funil de remarketing', async () => {
    const { useCase } = setup('Leads Nao Qualificados');

    const card = await useCase.execute({
      tenantId: 'tenant-1',
      pipelineId: 'pipeline-1',
      requesterRole: 'Administrador',
      requesterCargo: null,
      title: 'Lead remarketing',
    });

    expect(card.id).toBe('card-1');
  });

  it('cargo coordenador: consegue criar card no funil de remarketing', async () => {
    const { useCase } = setup('Leads Nao Qualificados');

    const card = await useCase.execute({
      tenantId: 'tenant-1',
      pipelineId: 'pipeline-1',
      requesterRole: 'Corretor',
      requesterCargo: 'coordenador',
      title: 'Lead remarketing',
    });

    expect(card.id).toBe('card-1');
  });

  it('Corretor comum: criacao em pipeline normal continua funcionando sem alteracao', async () => {
    const { useCase } = setup('Vendas');

    const card = await useCase.execute({
      tenantId: 'tenant-1',
      pipelineId: 'pipeline-1',
      requesterRole: 'Corretor',
      requesterCargo: 'corretor',
      title: 'Lead normal',
    });

    expect(card.id).toBe('card-1');
  });

  it('isSystemCall=true: cria no funil de remarketing mesmo sem requesterRole/requesterCargo preenchidos', async () => {
    const { useCase, cardRepository } = setup('Leads Nao Qualificados');

    const card = await useCase.execute({
      tenantId: 'tenant-1',
      pipelineId: 'pipeline-1',
      isSystemCall: true,
      title: 'Lead capturado automaticamente',
    });

    expect(card.id).toBe('card-1');
    expect(cardRepository.create).toHaveBeenCalledTimes(1);
  });

  it('isSystemCall=true: cria no funil de remarketing independente da role/cargo informados', async () => {
    const { useCase } = setup('Leads Nao Qualificados');

    const card = await useCase.execute({
      tenantId: 'tenant-1',
      pipelineId: 'pipeline-1',
      isSystemCall: true,
      requesterRole: 'Corretor',
      requesterCargo: 'corretor',
      title: 'Lead capturado automaticamente',
    });

    expect(card.id).toBe('card-1');
  });
});
