// src/modules/atendimento/application/use-cases/assign-atendimento.use-case.ts
// Agente "assume" o atendimento - so permite se ele pertence a fila do
// atendimento (FilaUsuario) ou e Administrador (mesma logica de excecao
// ja usada em CancelEnvelopeUseCase/canManageQueue).
import { Injectable, Inject, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import {
  IAtendimentoRepository,
  AtendimentoRecord,
} from '../../domain/repositories/atendimento-repository.interface';
import { IFilaRepository } from '../../domain/repositories/fila-repository.interface';
import { IAtendimentoEventoRepository } from '../../domain/repositories/atendimento-evento-repository.interface';

interface AssignAtendimentoInput {
  tenantId: string;
  atendimentoId: string;
  userId: string;
  userRole: string;
}

@Injectable()
export class AssignAtendimentoUseCase {
  constructor(
    @Inject('IAtendimentoRepository')
    private readonly atendimentoRepository: IAtendimentoRepository,
    @Inject('IFilaRepository') private readonly filaRepository: IFilaRepository,
    @Inject('IAtendimentoEventoRepository')
    private readonly eventoRepository: IAtendimentoEventoRepository,
  ) {}

  async execute(input: AssignAtendimentoInput): Promise<AtendimentoRecord> {
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

    if (input.userRole !== 'Administrador') {
      if (!atendimento.filaId) {
        throw new ForbiddenException('Este atendimento ainda nao foi classificado numa fila.');
      }
      const belongs = await this.filaRepository.isUsuarioInFila(atendimento.filaId, input.userId);
      if (!belongs) {
        throw new ForbiddenException('Voce nao pertence a fila deste atendimento.');
      }
    }

    const updated = await this.atendimentoRepository.update(atendimento.id, {
      ownerId: input.userId,
      status: 'em_atendimento',
    });

    await this.eventoRepository.create({
      atendimentoId: atendimento.id,
      tipo: 'atribuido',
      userId: input.userId,
    });

    return updated;
  }
}
