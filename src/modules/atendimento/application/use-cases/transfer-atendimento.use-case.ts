// src/modules/atendimento/application/use-cases/transfer-atendimento.use-case.ts
import { Injectable, Inject, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import {
  IAtendimentoRepository,
  AtendimentoRecord,
} from '../../domain/repositories/atendimento-repository.interface';
import { IAtendimentoEventoRepository } from '../../domain/repositories/atendimento-evento-repository.interface';

interface TransferAtendimentoInput {
  tenantId: string;
  atendimentoId: string;
  requesterId: string;
  requesterRole: string;
  // Pelo menos um dos dois deve ser informado.
  novoFilaId?: string;
  novoOwnerId?: string;
}

@Injectable()
export class TransferAtendimentoUseCase {
  constructor(
    @Inject('IAtendimentoRepository')
    private readonly atendimentoRepository: IAtendimentoRepository,
    @Inject('IAtendimentoEventoRepository')
    private readonly eventoRepository: IAtendimentoEventoRepository,
  ) {}

  async execute(input: TransferAtendimentoInput): Promise<AtendimentoRecord> {
    if (!input.novoFilaId && !input.novoOwnerId) {
      throw new BadRequestException('Informe a nova fila e/ou o novo agente.');
    }

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
      throw new ForbiddenException('Apenas o Administrador ou o dono do atendimento pode transferi-lo.');
    }

    const updated = await this.atendimentoRepository.update(atendimento.id, {
      ...(input.novoFilaId ? { filaId: input.novoFilaId } : {}),
      ...(input.novoOwnerId ? { ownerId: input.novoOwnerId, status: 'em_atendimento' } : {}),
    });

    const detalheParts: string[] = [];
    if (input.novoFilaId) detalheParts.push(`fila=${input.novoFilaId}`);
    if (input.novoOwnerId) detalheParts.push(`agente=${input.novoOwnerId}`);

    await this.eventoRepository.create({
      atendimentoId: atendimento.id,
      tipo: 'transferido',
      userId: input.requesterId,
      detalhe: detalheParts.join(' · '),
    });

    return updated;
  }
}
