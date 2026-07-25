// Captura automatica de lead minimo (funil de remarketing) - unitario:
// mocka ICardRepository/GetOrCreateRemarketingPipelineUseCase/
// CreateQuickCardUseCase, verifica so a DECISAO (capturar vs pular) e a
// resiliencia a erro (nunca lanca excecao - ver comentario da classe).
import { CapturarLeadMinimoUseCase } from './capturar-lead-minimo.use-case';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { GetOrCreateRemarketingPipelineUseCase } from './get-or-create-remarketing-pipeline.use-case';
import { CreateQuickCardUseCase } from './create-quick-card.use-case';
import { buildCardRecord } from '../../../../../test/factories/card-record.factory';

function setup() {
  const cardRepository = { existsByTenantAndPhone: jest.fn() };
  const getOrCreateRemarketingPipelineUseCase = { execute: jest.fn() };
  const createQuickCardUseCase = { execute: jest.fn() };

  const useCase = new CapturarLeadMinimoUseCase(
    cardRepository as unknown as ICardRepository,
    getOrCreateRemarketingPipelineUseCase as unknown as GetOrCreateRemarketingPipelineUseCase,
    createQuickCardUseCase as unknown as CreateQuickCardUseCase,
  );

  return { useCase, cardRepository, getOrCreateRemarketingPipelineUseCase, createQuickCardUseCase };
}

describe('CapturarLeadMinimoUseCase', () => {
  it('primeiro contato (sem nenhum Card para o telefone): cria o Card minimo no pipeline de remarketing, com o nome do pushName', async () => {
    const { useCase, cardRepository, getOrCreateRemarketingPipelineUseCase, createQuickCardUseCase } = setup();
    cardRepository.existsByTenantAndPhone.mockResolvedValue(false);
    getOrCreateRemarketingPipelineUseCase.execute.mockResolvedValue({
      pipelineId: 'pipeline-remarketing',
      stageId: 'stage-aguardando-reengajamento',
    });
    createQuickCardUseCase.execute.mockResolvedValue(buildCardRecord({ id: 'card-1' }));

    const resultado = await useCase.execute({
      tenantId: 'tenant-1',
      phoneNumber: '5511999990000',
      pushName: 'Daniel',
    });

    expect(resultado?.id).toBe('card-1');
    expect(createQuickCardUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        pipelineId: 'pipeline-remarketing',
        stageId: 'stage-aguardando-reengajamento',
        title: 'Daniel',
        origem: 'captura_auto_vivi',
        phone: '5511999990000',
      }),
    );
  });

  it('sem pushName: usa o proprio numero de telefone como titulo', async () => {
    const { useCase, cardRepository, getOrCreateRemarketingPipelineUseCase, createQuickCardUseCase } = setup();
    cardRepository.existsByTenantAndPhone.mockResolvedValue(false);
    getOrCreateRemarketingPipelineUseCase.execute.mockResolvedValue({
      pipelineId: 'pipeline-remarketing',
      stageId: 'stage-aguardando-reengajamento',
    });
    createQuickCardUseCase.execute.mockResolvedValue(buildCardRecord({ id: 'card-2' }));

    await useCase.execute({ tenantId: 'tenant-1', phoneNumber: '5511999990000', pushName: null });

    expect(createQuickCardUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({ title: '5511999990000' }),
    );
  });

  it('ja existe ALGUM Card para este telefone (qualquer pipeline): NAO captura de novo', async () => {
    const { useCase, cardRepository, createQuickCardUseCase } = setup();
    cardRepository.existsByTenantAndPhone.mockResolvedValue(true);

    const resultado = await useCase.execute({ tenantId: 'tenant-1', phoneNumber: '5511999990000' });

    expect(resultado).toBeNull();
    expect(createQuickCardUseCase.execute).not.toHaveBeenCalled();
  });

  it('erro em qualquer etapa: engole a excecao e retorna null, nunca derruba o chamador', async () => {
    const { useCase, cardRepository } = setup();
    cardRepository.existsByTenantAndPhone.mockRejectedValue(new Error('banco fora do ar'));

    await expect(
      useCase.execute({ tenantId: 'tenant-1', phoneNumber: '5511999990000' }),
    ).resolves.toBeNull();
  });
});
