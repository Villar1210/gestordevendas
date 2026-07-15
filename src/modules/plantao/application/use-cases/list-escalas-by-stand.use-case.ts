// src/modules/plantao/application/use-cases/list-escalas-by-stand.use-case.ts
import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import { IStandRepository } from '../../domain/repositories/stand-repository.interface';
import {
  IEscalaPlantaoRepository,
  EscalaPlantaoWithUserName,
} from '../../domain/repositories/escala-plantao-repository.interface';

interface ListEscalasByStandInput {
  standId: string;
  tenantId: string;
  requesterRole: string;
}

@Injectable()
export class ListEscalasByStandUseCase {
  constructor(
    @Inject('IStandRepository') private readonly standRepository: IStandRepository,
    @Inject('IEscalaPlantaoRepository')
    private readonly escalaPlantaoRepository: IEscalaPlantaoRepository,
  ) {}

  async execute(input: ListEscalasByStandInput): Promise<EscalaPlantaoWithUserName[]> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode ver a escala.');
    }

    const stand = await this.standRepository.findByIdAndTenant(input.standId, input.tenantId);
    if (!stand) {
      throw new NotFoundException('Stand nao encontrado.');
    }

    return this.escalaPlantaoRepository.findAllByStand(input.standId);
  }
}
