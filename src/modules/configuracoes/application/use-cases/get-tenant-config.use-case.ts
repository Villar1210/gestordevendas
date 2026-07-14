// src/modules/configuracoes/application/use-cases/get-tenant-config.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  ITenantConfigRepository,
  TenantConfigRecord,
} from '../../domain/repositories/tenant-config-repository.interface';

interface GetTenantConfigInput {
  tenantId: string;
}

@Injectable()
export class GetTenantConfigUseCase {
  constructor(
    @Inject('ITenantConfigRepository')
    private readonly tenantConfigRepository: ITenantConfigRepository,
  ) {}

  async execute(input: GetTenantConfigInput): Promise<TenantConfigRecord> {
    const config = await this.tenantConfigRepository.findByTenantId(input.tenantId);
    if (!config) {
      throw new NotFoundException('Tenant nao encontrado.');
    }
    return config;
  }
}
