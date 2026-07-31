// Achado I14 da auditoria: ClassifyAndRouteAtendimentoUseCase nao tinha
// nenhuma spec. Unitario: cobre a decisao de reaproveitar vs criar a fila,
// a montagem condicional do update (urgente) e do detalhe do evento
// (resumo/urgente combinados), e o payload do evento generico emitido.
import { NotFoundException } from '@nestjs/common';
import { ClassifyAndRouteAtendimentoUseCase } from './classify-and-route-atendimento.use-case';
import { IAtendimentoRepository } from '../../domain/repositories/atendimento-repository.interface';
import { IFilaRepository, FilaRecord } from '../../domain/repositories/fila-repository.interface';
import { IAtendimentoEventoRepository } from '../../domain/repositories/atendimento-evento-repository.interface';
import { buildAtendimentoRecord } from '../../../../../test/factories/atendimento-record.factory';

function setup() {
  const atendimentoRepository = {
    findByIdAndTenant: jest.fn(),
    update: jest.fn(),
  };
  const filaRepository = {
    findByTenantAndNome: jest.fn(),
    create: jest.fn(),
  };
  const eventoRepository = { create: jest.fn() };
  const eventEmitter = { emit: jest.fn() };

  const useCase = new ClassifyAndRouteAtendimentoUseCase(
    atendimentoRepository as unknown as IAtendimentoRepository,
    filaRepository as unknown as IFilaRepository,
    eventoRepository as unknown as IAtendimentoEventoRepository,
    eventEmitter as any,
  );

  const atendimento = buildAtendimentoRecord({ id: 'atendimento-1', tenantId: 'tenant-1' });
  atendimentoRepository.findByIdAndTenant.mockResolvedValue(atendimento);
  atendimentoRepository.update.mockImplementation((id: string, data: unknown) => ({
    ...atendimento,
    id,
    ...(data as object),
  }));
  eventoRepository.create.mockResolvedValue({ id: 'evento-1' });

  return { useCase, atendimentoRepository, filaRepository, eventoRepository, eventEmitter, atendimento };
}

describe('ClassifyAndRouteAtendimentoUseCase', () => {
  it('lanca NotFoundException se o atendimento nao existir', async () => {
    const { useCase, atendimentoRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(null);

    await expect(
      useCase.execute({ tenantId: 'tenant-1', atendimentoId: 'inexistente', filaNome: 'Suporte' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('REAPROVEITA a fila se ja existir uma com esse nome (nao chama filaRepository.create)', async () => {
    const { useCase, filaRepository } = setup();
    const filaExistente: FilaRecord = {
      id: 'fila-1',
      tenantId: 'tenant-1',
      nome: 'Suporte',
      descricao: null,
      createdAt: new Date(),
    };
    filaRepository.findByTenantAndNome.mockResolvedValue(filaExistente);

    await useCase.execute({ tenantId: 'tenant-1', atendimentoId: 'atendimento-1', filaNome: 'Suporte' });

    expect(filaRepository.create).not.toHaveBeenCalled();
  });

  it('CRIA uma fila nova se nenhuma existir com esse nome (categoria renomeada/removida pelo tenant)', async () => {
    const { useCase, filaRepository } = setup();
    filaRepository.findByTenantAndNome.mockResolvedValue(null);
    filaRepository.create.mockResolvedValue({
      id: 'fila-nova',
      tenantId: 'tenant-1',
      nome: 'Financeiro',
      descricao: null,
      createdAt: new Date(),
    });

    await useCase.execute({ tenantId: 'tenant-1', atendimentoId: 'atendimento-1', filaNome: 'Financeiro' });

    expect(filaRepository.create).toHaveBeenCalledWith({ tenantId: 'tenant-1', nome: 'Financeiro' });
  });

  it('atualiza o atendimento com filaId, SEM incluir "urgente" quando input.urgente e falso/ausente', async () => {
    const { useCase, atendimentoRepository, filaRepository } = setup();
    filaRepository.findByTenantAndNome.mockResolvedValue({
      id: 'fila-1',
      tenantId: 'tenant-1',
      nome: 'Suporte',
      descricao: null,
      createdAt: new Date(),
    });

    await useCase.execute({ tenantId: 'tenant-1', atendimentoId: 'atendimento-1', filaNome: 'Suporte' });

    expect(atendimentoRepository.update).toHaveBeenCalledWith('atendimento-1', { filaId: 'fila-1' });
  });

  it('inclui urgente:true no update quando input.urgente e true', async () => {
    const { useCase, atendimentoRepository, filaRepository } = setup();
    filaRepository.findByTenantAndNome.mockResolvedValue({
      id: 'fila-1',
      tenantId: 'tenant-1',
      nome: 'Suporte',
      descricao: null,
      createdAt: new Date(),
    });

    await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      filaNome: 'Suporte',
      urgente: true,
    });

    expect(atendimentoRepository.update).toHaveBeenCalledWith('atendimento-1', {
      filaId: 'fila-1',
      urgente: true,
    });
  });

  it.each([
    [undefined, undefined, 'Classificado na fila "Suporte"'],
    [true, undefined, 'Classificado na fila "Suporte" [URGENTE]'],
    [undefined, 'Duvida sobre boleto', 'Classificado na fila "Suporte": Duvida sobre boleto'],
    [true, 'Duvida sobre boleto', 'Classificado na fila "Suporte" [URGENTE]: Duvida sobre boleto'],
  ])(
    'monta o detalhe do evento combinando urgente=%s e resumo=%s corretamente',
    async (urgente, resumo, detalheEsperado) => {
      const { useCase, eventoRepository, filaRepository } = setup();
      filaRepository.findByTenantAndNome.mockResolvedValue({
        id: 'fila-1',
        tenantId: 'tenant-1',
        nome: 'Suporte',
        descricao: null,
        createdAt: new Date(),
      });

      await useCase.execute({
        tenantId: 'tenant-1',
        atendimentoId: 'atendimento-1',
        filaNome: 'Suporte',
        urgente,
        resumo,
      });

      expect(eventoRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ detalhe: detalheEsperado }),
      );
    },
  );

  it('grava userId=null no evento quando a classificacao e automatica (VIVI, sem userId)', async () => {
    const { useCase, eventoRepository, filaRepository } = setup();
    filaRepository.findByTenantAndNome.mockResolvedValue({
      id: 'fila-1',
      tenantId: 'tenant-1',
      nome: 'Suporte',
      descricao: null,
      createdAt: new Date(),
    });

    await useCase.execute({ tenantId: 'tenant-1', atendimentoId: 'atendimento-1', filaNome: 'Suporte' });

    expect(eventoRepository.create).toHaveBeenCalledWith(expect.objectContaining({ userId: null }));
  });

  it('grava o userId do Administrador quando a classificacao e manual', async () => {
    const { useCase, eventoRepository, filaRepository } = setup();
    filaRepository.findByTenantAndNome.mockResolvedValue({
      id: 'fila-1',
      tenantId: 'tenant-1',
      nome: 'Suporte',
      descricao: null,
      createdAt: new Date(),
    });

    await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      filaNome: 'Suporte',
      userId: 'admin-1',
    });

    expect(eventoRepository.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'admin-1' }));
  });

  it('emite "atendimento.classificado" com o payload correto', async () => {
    const { useCase, eventEmitter, filaRepository } = setup();
    filaRepository.findByTenantAndNome.mockResolvedValue({
      id: 'fila-1',
      tenantId: 'tenant-1',
      nome: 'Suporte',
      descricao: null,
      createdAt: new Date(),
    });

    await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      filaNome: 'Suporte',
      urgente: true,
    });

    expect(eventEmitter.emit).toHaveBeenCalledWith('atendimento.classificado', {
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      filaId: 'fila-1',
      filaNome: 'Suporte',
      urgente: true,
    });
  });

  it('retorna o atendimento atualizado (resultado de atendimentoRepository.update)', async () => {
    const { useCase, atendimentoRepository, filaRepository } = setup();
    filaRepository.findByTenantAndNome.mockResolvedValue({
      id: 'fila-1',
      tenantId: 'tenant-1',
      nome: 'Suporte',
      descricao: null,
      createdAt: new Date(),
    });
    atendimentoRepository.update.mockResolvedValue({ id: 'atendimento-1', filaId: 'fila-1' });

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      filaNome: 'Suporte',
    });

    expect(result).toEqual({ id: 'atendimento-1', filaId: 'fila-1' });
  });
});
