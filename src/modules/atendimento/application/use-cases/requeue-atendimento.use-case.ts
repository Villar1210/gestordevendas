// src/modules/atendimento/application/use-cases/requeue-atendimento.use-case.ts
// Devolve o atendimento para "aguardando" na mesma fila, sem dono - mesma
// ideia do "requeue" do wacalls-chat (estudado como referencia conceitual,
// nao copiado - ver CLAUDE.md).
import { Injectable, Inject, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import {
  IAtendimentoRepository,
  AtendimentoRecord,
} from '../../domain/repositories/atendimento-repository.interface';
import { IAtendimentoEventoRepository } from '../../domain/repositories/atendimento-evento-repository.interface';

interface RequeueAtendimentoInput {
  tenantId: string;
  atendimentoId: string;
  requesterId: string;
  requesterRole: string;
}

@Injectable()
export class RequeueAtendimentoUseCase {
  constructor(
    @Inject('IAtendimentoRepository')
    private readonly atendimentoRepository: IAtendimentoRepository,
    @Inject('IAtendimentoEventoRepository')
    private readonly eventoRepository: IAtendimentoEventoRepository,
  ) {}

  async execute(input: RequeueAtendimentoInput): Promise<AtendimentoRecord> {
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
      throw new ForbiddenException('Apenas o Administrador ou o dono do atendimento pode devolve-lo.');
    }

    const updated = await this.atendimentoRepository.update(atendimento.id, {
      ownerId: null,
      status: 'aguardando',
    });

    await this.eventoRepository.create({
      atendimentoId: atendimento.id,
      tipo: 'devolvido',
      userId: input.requesterId,
    });

    return updated;
  }
}
