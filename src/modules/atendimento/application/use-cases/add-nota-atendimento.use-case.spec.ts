// Auditoria de seguranca (achado I2, 28/07/2026): AddNotaAtendimentoUseCase
// nao checava escopo antes de gravar uma nota - qualquer usuario do tenant
// conseguia adicionar nota em qualquer atendimento, mesmo sem ser dono nem
// Administrador. Mesmo padrao de checagem ja usado em
// CloseAtendimentoUseCase/TransferAtendimentoUseCase/RequeueAtendimentoUseCase
// (isOwner OU Administrador). Unitario: o que importa e o BRANCHING de
// autorizacao, nao persistencia real.
import { ForbiddenException, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { AddNotaAtendimentoUseCase } from './add-nota-atendimento.use-case';
import { IAtendimentoRepository } from '../../domain/repositories/atendimento-repository.interface';
import { IAtendimentoEventoRepository } from '../../domain/repositories/atendimento-evento-repository.interface';

function setup() {
  const atendimentoRepository = { findByIdAndTenant: jest.fn() };
  const eventoRepository = { create: jest.fn() };

  const useCase = new AddNotaAtendimentoUseCase(
    atendimentoRepository as unknown as IAtendimentoRepository,
    eventoRepository as unknown as IAtendimentoEventoRepository,
  );

  const atendimento = {
    id: 'atendimento-1',
    tenantId: 'tenant-1',
    status: 'em_atendimento',
    ownerId: 'dono-1',
  };
  atendimentoRepository.findByIdAndTenant.mockResolvedValue(atendimento);
  eventoRepository.create.mockImplementation((data: unknown) => ({ id: 'evento-1', ...(data as object) }));

  return { useCase, atendimentoRepository, eventoRepository, atendimento };
}

describe('AddNotaAtendimentoUseCase - checagem de escopo (achado I2)', () => {
  it('lanca BadRequestException se o texto vier vazio ou so com espacos (achado I14)', async () => {
    const { useCase, atendimentoRepository, eventoRepository } = setup();

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        atendimentoId: 'atendimento-1',
        userId: 'dono-1',
        requesterRole: 'Corretor',
        texto: '   ',
      }),
    ).rejects.toThrow(BadRequestException);

    // Validacao acontece ANTES de buscar o atendimento no banco.
    expect(atendimentoRepository.findByIdAndTenant).not.toHaveBeenCalled();
    expect(eventoRepository.create).not.toHaveBeenCalled();
  });

  it('o DONO do atendimento consegue adicionar a nota', async () => {
    const { useCase, eventoRepository } = setup();

    const result = await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      userId: 'dono-1',
      requesterRole: 'Corretor',
      texto: 'Cliente confirmou o pagamento.',
    });

    expect(eventoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ atendimentoId: 'atendimento-1', tipo: 'nota', userId: 'dono-1' }),
    );
    expect(result.id).toBe('evento-1');
  });

  it('o Administrador consegue adicionar a nota MESMO NAO sendo o dono', async () => {
    const { useCase, eventoRepository } = setup();

    await useCase.execute({
      tenantId: 'tenant-1',
      atendimentoId: 'atendimento-1',
      userId: 'admin-1',
      requesterRole: 'Administrador',
      texto: 'Nota do administrador.',
    });

    expect(eventoRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ atendimentoId: 'atendimento-1', tipo: 'nota', userId: 'admin-1' }),
    );
  });

  it('BLOQUEIA um usuario que NAO e dono nem Administrador', async () => {
    const { useCase, eventoRepository } = setup();

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        atendimentoId: 'atendimento-1',
        userId: 'outro-corretor',
        requesterRole: 'Corretor',
        texto: 'Tentativa indevida.',
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(eventoRepository.create).not.toHaveBeenCalled();
  });

  it('continua lancando NotFoundException se o atendimento nao existir (sem regressao)', async () => {
    const { useCase, atendimentoRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        atendimentoId: 'inexistente',
        userId: 'dono-1',
        requesterRole: 'Corretor',
        texto: 'Nota.',
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('BLOQUEIA adicionar nota em atendimento ja fechado (achado I2b), mesmo sendo o dono', async () => {
    const { useCase, atendimentoRepository, eventoRepository } = setup();
    atendimentoRepository.findByIdAndTenant.mockResolvedValue({
      id: 'atendimento-1',
      tenantId: 'tenant-1',
      status: 'fechado',
      ownerId: 'dono-1',
    });

    await expect(
      useCase.execute({
        tenantId: 'tenant-1',
        atendimentoId: 'atendimento-1',
        userId: 'dono-1',
        requesterRole: 'Corretor',
        texto: 'Nota tardia.',
      }),
    ).rejects.toThrow(ConflictException);

    expect(eventoRepository.create).not.toHaveBeenCalled();
  });
});
