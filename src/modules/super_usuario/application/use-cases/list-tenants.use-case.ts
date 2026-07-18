// src/modules/super_usuario/application/use-cases/list-tenants.use-case.ts
import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import { ITenantRepository, TenantSummary } from '../../domain/repositories/tenant-repository.interface';
import { SUPER_USUARIO_ROLE_NAME } from '../../../../shared/domain/constants/super-usuario';

interface ListTenantsInput {
  requesterRole: string;
}

// Reforca a checagem de role dentro do proprio caso de uso (nao so no
// RolesGuard do controller) - mesmo padrao ja usado em
// CreateCorretorUseCase (RH). Justificativa extra aqui: esta e a UNICA
// leitura cross-tenant deliberada do sistema inteiro, entao vale a
// defesa em profundidade.
@Injectable()
export class ListTenantsUseCase {
  constructor(@Inject('ITenantRepository') private readonly tenantRepository: ITenantRepository) {}

  async execute(input: ListTenantsInput): Promise<TenantSummary[]> {
    if (input.requesterRole !== SUPER_USUARIO_ROLE_NAME) {
      throw new ForbiddenException('Apenas o Super Usuario pode listar os tenants.');
    }
    return this.tenantRepository.findAllExceptPlataforma();
  }
}
