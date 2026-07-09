// src/modules/rh/application/use-cases/update-status-disponibilidade.use-case.ts
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { ICorretorRepository } from '../../domain/repositories/corretor-repository.interface';

const VALID_STATUSES = ['online', 'ausente', 'offline'];

interface UpdateStatusDisponibilidadeInput {
  userId: string;
  tenantId: string;
  status: string;
}

@Injectable()
export class UpdateStatusDisponibilidadeUseCase {
  constructor(
    @Inject('ICorretorRepository') private readonly corretorRepository: ICorretorRepository,
  ) {}

  async execute(input: UpdateStatusDisponibilidadeInput): Promise<void> {
    if (!VALID_STATUSES.includes(input.status)) {
      throw new BadRequestException(
        `Status invalido. Use um destes: ${VALID_STATUSES.join(', ')}.`,
      );
    }

    await this.corretorRepository.updateStatusDisponibilidade(
      input.userId,
      input.tenantId,
      input.status,
    );
  }
}
