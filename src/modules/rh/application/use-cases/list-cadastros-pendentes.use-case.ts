// src/modules/rh/application/use-cases/list-cadastros-pendentes.use-case.ts
import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import {
  ICadastroRepository,
  CadastroRecord,
} from '../../domain/repositories/cadastro-repository.interface';

interface ListCadastrosPendentesInput {
  tenantId: string;
  requesterRole: string;
}

@Injectable()
export class ListCadastrosPendentesUseCase {
  constructor(
    @Inject('ICadastroRepository') private readonly cadastroRepository: ICadastroRepository,
  ) {}

  async execute(input: ListCadastrosPendentesInput): Promise<CadastroRecord[]> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode ver cadastros pendentes.');
    }

    return this.cadastroRepository.findAllPendentesByTenant(input.tenantId);
  }
}
