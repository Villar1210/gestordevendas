// src/modules/plantao/application/use-cases/create-stand.use-case.ts
import { Injectable, Inject, ForbiddenException, BadRequestException } from '@nestjs/common';
import { IStandRepository, StandRecord } from '../../domain/repositories/stand-repository.interface';

interface CreateStandInput {
  tenantId: string;
  requesterRole: string;
  nome: string;
  endereco?: string | null;
}

@Injectable()
export class CreateStandUseCase {
  constructor(@Inject('IStandRepository') private readonly standRepository: IStandRepository) {}

  async execute(input: CreateStandInput): Promise<StandRecord> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode criar stands.');
    }
    if (!input.nome.trim()) {
      throw new BadRequestException('Informe o nome do stand.');
    }

    return this.standRepository.create({
      tenantId: input.tenantId,
      nome: input.nome.trim(),
      endereco: input.endereco,
    });
  }
}
