// src/modules/atendimento/application/use-cases/close-atendimento.use-case.ts
import { Injectable, Inject, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import {
  IAtendimentoRepository,
  AtendimentoRecord,
} from '../../domain/repositories/atendimento-repository.interface';
import { IAtendimentoEventoRepository } from '../../domain/repositories/atendimento-evento-repository.interface';

interface CloseAtendimentoInput {
  tenantId: string;
  atendimentoId: string;
  requesterId: string;
  requesterRole: string;
  motivo?: string | null;
}

@Injectable()
export class CloseAtendimentoUseCase {
  constructor(
    @Inject('IAtendimentoRepository')
    private readonly atendimentoRepository: IAtendimentoRepository,
    @Inject('IAtendimentoEventoRepository')
    private readonly eventoRepository: IAtendimentoEventoRepository,
  ) {}

  async execute(input: CloseAtendimentoInput): Promise<AtendimentoRecord> {
    const atendimento = await this.atendimentoRepository.findByIdAndTenant(
      input.atendimentoId,
      input.tenantId,
    );
    if (!atendimento) {
      throw new NotFoundException('Atendimento nao encontrado.');
    }
    if (atendimento.status === 'fechado') {
      throw new ConflictException('Este atendimento ja foi fechado.');
    }
    if (input.requesterRole !== 'Administrador' && atendimento.ownerId !== input.requesterId) {
      throw new ForbiddenException('Apenas o Administrador ou o dono do atendimento pode fecha-lo.');
    }

    const motivo = input.motivo?.trim() || null;
    const updated = await this.atendimentoRepository.update(atendimento.id, {
      status: 'fechado',
      motivoFechamento: motivo,
      closedAt: new Date(),
    });

    await this.eventoRepository.create({
      atendimentoId: atendimento.id,
      tipo: 'fechado',
      userId: input.requesterId,
      detalhe: motivo,
    });

    return updated;
  }
}
