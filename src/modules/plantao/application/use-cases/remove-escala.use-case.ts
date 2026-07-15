// src/modules/plantao/application/use-cases/remove-escala.use-case.ts
import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import { IEscalaPlantaoRepository } from '../../domain/repositories/escala-plantao-repository.interface';

interface RemoveEscalaInput {
  escalaId: string;
  tenantId: string;
  requesterRole: string;
}

@Injectable()
export class RemoveEscalaUseCase {
  constructor(
    @Inject('IEscalaPlantaoRepository')
    private readonly escalaPlantaoRepository: IEscalaPlantaoRepository,
  ) {}

  async execute(input: RemoveEscalaInput): Promise<void> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode remover a escala.');
    }

    const escala = await this.escalaPlantaoRepository.findByIdAndTenant(
      input.escalaId,
      input.tenantId,
    );
    if (!escala) {
      throw new NotFoundException('Escala nao encontrada.');
    }

    await this.escalaPlantaoRepository.delete(input.escalaId);
  }
}
