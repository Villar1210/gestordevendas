// src/modules/rh/application/use-cases/get-contrato-parceria-config.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import {
  CONTRATO_PARCERIA_CONFIG_PADRAO,
  ContratoParceriaConfigDados,
  IContratoParceriaConfigRepository,
} from '../../domain/repositories/contrato-parceria-config-repository.interface';

@Injectable()
export class GetContratoParceriaConfigUseCase {
  constructor(
    @Inject('IContratoParceriaConfigRepository')
    private readonly repository: IContratoParceriaConfigRepository,
  ) {}

  async execute(tenantId: string): Promise<ContratoParceriaConfigDados> {
    return (await this.repository.findByTenantId(tenantId)) ?? { ...CONTRATO_PARCERIA_CONFIG_PADRAO };
  }
}
