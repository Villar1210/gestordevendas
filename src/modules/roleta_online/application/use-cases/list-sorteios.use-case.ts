// src/modules/roleta_online/application/use-cases/list-sorteios.use-case.ts
// Fatia 2 (Sorteio da vez): historico de sorteios (transparencia).
import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IRoletaRepository, SorteioRecord } from '../../domain/repositories/roleta-repository.interface';

@Injectable()
export class ListSorteiosUseCase {
  constructor(@Inject('IRoletaRepository') private readonly roletaRepository: IRoletaRepository) {}

  async execute(input: { tenantId: string; roletaId: string }): Promise<SorteioRecord[]> {
    if (!(await this.roletaRepository.findById(input.roletaId, input.tenantId))) {
      throw new NotFoundException('Roleta nao encontrada.');
    }
    return this.roletaRepository.listSorteios(input.roletaId, 30);
  }
}
