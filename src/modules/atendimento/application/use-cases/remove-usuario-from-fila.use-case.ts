// src/modules/atendimento/application/use-cases/remove-usuario-from-fila.use-case.ts
import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { IFilaRepository } from '../../domain/repositories/fila-repository.interface';

interface RemoveUsuarioFromFilaInput {
  tenantId: string;
  filaId: string;
  userId: string;
}

@Injectable()
export class RemoveUsuarioFromFilaUseCase {
  private readonly logger = new Logger(RemoveUsuarioFromFilaUseCase.name);

  constructor(@Inject('IFilaRepository') private readonly filaRepository: IFilaRepository) {}

  async execute(input: RemoveUsuarioFromFilaInput): Promise<void> {
    const fila = await this.filaRepository.findByIdAndTenant(input.filaId, input.tenantId);
    if (!fila) {
      throw new NotFoundException('Fila nao encontrada.');
    }

    await this.filaRepository.removeUsuario(input.filaId, input.userId);
    this.logger.log(`[Atendimento] Usuario ${input.userId} desvinculado da fila "${fila.nome}" (${fila.id}).`);
  }
}
