// src/modules/plantao/application/use-cases/list-stands.use-case.ts
import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { IStandRepository, StandRecord } from '../../domain/repositories/stand-repository.interface';

interface ListStandsInput {
  tenantId: string;
  requesterRole: string;
}

@Injectable()
export class ListStandsUseCase {
  constructor(@Inject('IStandRepository') private readonly standRepository: IStandRepository) {}

  async execute(input: ListStandsInput): Promise<StandRecord[]> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode ver a lista de stands.');
    }

    return this.standRepository.findAllByTenant(input.tenantId);
  }
}
