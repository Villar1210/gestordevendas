// src/modules/rh/application/use-cases/list-corretores.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { ICorretorRepository, CorretorRecord } from '../../domain/repositories/corretor-repository.interface';
import { IRoleRepository } from '../../domain/repositories/role-repository.interface';

const CORRETOR_ROLE_NAME = 'Corretor';

interface ListCorretoresInput {
  tenantId: string;
}

@Injectable()
export class ListCorretoresUseCase {
  constructor(
    @Inject('ICorretorRepository') private readonly corretorRepository: ICorretorRepository,
    @Inject('IRoleRepository') private readonly roleRepository: IRoleRepository,
  ) {}

  async execute(input: ListCorretoresInput): Promise<CorretorRecord[]> {
    const role = await this.roleRepository.findByTenantAndName(
      input.tenantId,
      CORRETOR_ROLE_NAME,
    );
    // Ainda nenhum corretor foi criado neste tenant - Role "Corretor" nem existe.
    if (!role) {
      return [];
    }

    return this.corretorRepository.findAllByTenantAndRole(input.tenantId, role.id);
  }
}
