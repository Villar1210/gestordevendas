// src/modules/configuracoes/application/use-cases/update-tenant-config.use-case.ts
import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import {
  ITenantConfigRepository,
  TenantConfigRecord,
  UpdateTenantConfigInput,
} from '../../domain/repositories/tenant-config-repository.interface';

interface UpdateTenantConfigUseCaseInput extends UpdateTenantConfigInput {
  tenantId: string;
  requesterRole: string;
}

@Injectable()
export class UpdateTenantConfigUseCase {
  constructor(
    @Inject('ITenantConfigRepository')
    private readonly tenantConfigRepository: ITenantConfigRepository,
  ) {}

  async execute(input: UpdateTenantConfigUseCaseInput): Promise<TenantConfigRecord> {
    if (input.requesterRole !== 'Administrador') {
      throw new ForbiddenException('Apenas o Administrador pode editar os dados da empresa.');
    }

    return this.tenantConfigRepository.update(input.tenantId, {
      name: input.name,
      cnpj: input.cnpj,
      endereco: input.endereco,
      numero: input.numero,
      complemento: input.complemento,
      bairro: input.bairro,
      cep: input.cep,
    });
  }
}
