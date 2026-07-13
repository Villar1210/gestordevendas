import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { IFilaRepository } from '../../domain/repositories/fila-repository.interface';

interface DeleteFilaInput {
  tenantId: string;
  filaId: string;
}

@Injectable()
export class DeleteFilaUseCase {
  constructor(@Inject('IFilaRepository') private readonly filaRepository: IFilaRepository) {}

  async execute(input: DeleteFilaInput): Promise<void> {
    const fila = await this.filaRepository.findByIdAndTenant(input.filaId, input.tenantId);
    if (!fila) {
      throw new NotFoundException('Fila nao encontrada.');
    }

    await this.filaRepository.deleteById(input.filaId);
  }
}
