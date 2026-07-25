// Rede de seguranca "sem corretor online" (Camada 1 - retry ao ficar
// online, commit 8df8e29). Unitario: a garantia que queremos proteger e de
// ORQUESTRACAO (busca os cards sem dono do tenant, tenta redistribuir cada
// um, um card com erro nao pode travar os demais) - nao depende de nuance
// de query SQL, entao mockar ICardRepository/DistributeLeadUseCase da
// confianca suficiente sem precisar de banco real.
import { ICardRepository } from '../../../vendas_kanban/domain/repositories/card-repository.interface';
import { DistributeLeadUseCase } from './distribute-lead.use-case';
import { RetryDistribuicaoAoFicarOnlineUseCase } from './retry-distribuicao-ao-ficar-online.use-case';
import { buildCardRecord } from '../../../../../test/factories/card-record.factory';

describe('RetryDistribuicaoAoFicarOnlineUseCase', () => {
  function setup() {
    const cardRepository: jest.Mocked<Pick<ICardRepository, 'findAllInboxByTenant'>> = {
      findAllInboxByTenant: jest.fn(),
    };
    const distributeLeadUseCase = { execute: jest.fn() } as unknown as jest.Mocked<DistributeLeadUseCase>;

    const useCase = new RetryDistribuicaoAoFicarOnlineUseCase(
      cardRepository as unknown as ICardRepository,
      distributeLeadUseCase,
    );

    return { cardRepository, distributeLeadUseCase, useCase };
  }

  it('nao faz nada quando nao ha cards pendentes na Caixa de Entrada do tenant', async () => {
    const { cardRepository, distributeLeadUseCase, useCase } = setup();
    cardRepository.findAllInboxByTenant.mockResolvedValue([]);

    await useCase.execute({ tenantId: 'tenant-1' });

    expect(distributeLeadUseCase.execute).not.toHaveBeenCalled();
  });

  it('tenta redistribuir CADA card pendente do tenant', async () => {
    const { cardRepository, distributeLeadUseCase, useCase } = setup();
    const cardA = buildCardRecord({ id: 'card-a', tenantId: 'tenant-1', pipelineId: 'pipeline-1' });
    const cardB = buildCardRecord({ id: 'card-b', tenantId: 'tenant-1', pipelineId: 'pipeline-2' });
    cardRepository.findAllInboxByTenant.mockResolvedValue([cardA, cardB]);
    distributeLeadUseCase.execute.mockResolvedValue(undefined);

    await useCase.execute({ tenantId: 'tenant-1' });

    expect(cardRepository.findAllInboxByTenant).toHaveBeenCalledWith('tenant-1');
    expect(distributeLeadUseCase.execute).toHaveBeenCalledTimes(2);
    expect(distributeLeadUseCase.execute).toHaveBeenNthCalledWith(1, {
      tenantId: 'tenant-1',
      cardId: 'card-a',
      pipelineId: 'pipeline-1',
    });
    expect(distributeLeadUseCase.execute).toHaveBeenNthCalledWith(2, {
      tenantId: 'tenant-1',
      cardId: 'card-b',
      pipelineId: 'pipeline-2',
    });
  });

  it('um card com erro na redistribuicao NAO impede os demais de serem tentados', async () => {
    const { cardRepository, distributeLeadUseCase, useCase } = setup();
    const cardA = buildCardRecord({ id: 'card-a' });
    const cardB = buildCardRecord({ id: 'card-b' });
    const cardC = buildCardRecord({ id: 'card-c' });
    cardRepository.findAllInboxByTenant.mockResolvedValue([cardA, cardB, cardC]);
    distributeLeadUseCase.execute
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('falha simulada na distribuicao'))
      .mockResolvedValueOnce(undefined);

    await expect(useCase.execute({ tenantId: 'tenant-1' })).resolves.not.toThrow();

    expect(distributeLeadUseCase.execute).toHaveBeenCalledTimes(3);
  });
});
