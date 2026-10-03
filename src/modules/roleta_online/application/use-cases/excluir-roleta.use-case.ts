// src/modules/roleta_online/application/use-cases/excluir-roleta.use-case.ts
import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IRoletaRepository } from '../../domain/repositories/roleta-repository.interface';

@Injectable()
export class ExcluirRoletaUseCase {
  constructor(@Inject('IRoletaRepository') private readonly roletaRepository: IRoletaRepository) {}

  async execute(input: { tenantId: string; requesterRole: string; id: string }): Promise<void> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode configurar as roletas.');
    }
    if (!(await this.roletaRepository.findById(input.id, input.tenantId))) {
      throw new NotFoundException('Roleta nao encontrada.');
    }
    await this.roletaRepository.delete(input.id, input.tenantId);
  }
}
