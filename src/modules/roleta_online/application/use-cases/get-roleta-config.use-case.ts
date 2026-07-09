// src/modules/roleta_online/application/use-cases/get-roleta-config.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IRoletaConfigRepository,
  RoletaConfigRecord,
} from '../../domain/repositories/roleta-config-repository.interface';

interface GetRoletaConfigInput {
  tenantId: string;
}

@Injectable()
export class GetRoletaConfigUseCase {
  constructor(
    @Inject('IRoletaConfigRepository')
    private readonly roletaConfigRepository: IRoletaConfigRepository,
  ) {}

  async execute(input: GetRoletaConfigInput): Promise<RoletaConfigRecord> {
    const existing = await this.roletaConfigRepository.findByTenant(input.tenantId);
    if (existing) {
      return existing;
    }

    // Nenhuma config ainda - cria com os defaults do schema (round_robin,
    // semi_automatico, inativa) na primeira vez que o tenant acessa a tela.
    return this.roletaConfigRepository.upsert({ tenantId: input.tenantId });
  }
}
