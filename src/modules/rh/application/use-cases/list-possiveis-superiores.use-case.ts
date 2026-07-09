// src/modules/rh/application/use-cases/list-possiveis-superiores.use-case.ts
import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import {
  ICadastroRepository,
  SuperiorCandidateRecord,
} from '../../domain/repositories/cadastro-repository.interface';

interface ListPossiveisSuperioresInput {
  tenantId: string;
  requesterRole: string;
}

@Injectable()
export class ListPossiveisSuperioresUseCase {
  constructor(
    @Inject('ICadastroRepository') private readonly cadastroRepository: ICadastroRepository,
  ) {}

  async execute(input: ListPossiveisSuperioresInput): Promise<SuperiorCandidateRecord[]> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode ver a lista de superiores.');
    }

    return this.cadastroRepository.findPossiveisSuperioresByTenant(input.tenantId);
  }
}
