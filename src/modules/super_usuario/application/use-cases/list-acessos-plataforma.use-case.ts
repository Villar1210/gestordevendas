// src/modules/super_usuario/application/use-cases/list-acessos-plataforma.use-case.ts
import { Injectable, Inject, ForbiddenException } from '@nestjs/common';
import {
  IAcessoPlataformaLogRepository,
  AcessoPlataformaLogRecord,
} from '../../domain/repositories/acesso-plataforma-log-repository.interface';
import { SUPER_USUARIO_ROLE_NAME } from '../../../../shared/domain/constants/super-usuario';

interface ListAcessosPlataformaInput {
  requesterRole: string;
  requesterUserId: string;
}

// Historico de auditoria (Fatia 3) - cada Super Usuario ve so os PROPRIOS
// acessos (findAllBySuperUsuario), nunca os de outro Super Usuario -
// mesma checagem de role em profundidade ja usada em
// ListTenantsUseCase/ImpersonarTenantUseCase.
@Injectable()
export class ListAcessosPlataformaUseCase {
  constructor(
    @Inject('IAcessoPlataformaLogRepository')
    private readonly acessoPlataformaLogRepository: IAcessoPlataformaLogRepository,
  ) {}

  async execute(input: ListAcessosPlataformaInput): Promise<AcessoPlataformaLogRecord[]> {
    if (input.requesterRole !== SUPER_USUARIO_ROLE_NAME) {
      throw new ForbiddenException('Apenas o Super Usuario pode ver este historico.');
    }
    return this.acessoPlataformaLogRepository.findAllBySuperUsuario(input.requesterUserId);
  }
}
