// src/modules/atendimento/application/use-cases/list-filas.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { IFilaRepository, FilaWithUsuarioIds } from '../../domain/repositories/fila-repository.interface';

interface ListFilasInput {
  tenantId: string;
}

@Injectable()
export class ListFilasUseCase {
  constructor(@Inject('IFilaRepository') private readonly filaRepository: IFilaRepository) {}

  async execute(input: ListFilasInput): Promise<FilaWithUsuarioIds[]> {
    return this.filaRepository.findAllByTenant(input.tenantId);
  }
}
