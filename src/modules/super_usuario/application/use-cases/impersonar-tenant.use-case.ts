// src/modules/super_usuario/application/use-cases/impersonar-tenant.use-case.ts
// "Entrar como Administrador" num tenant qualquer - emite um token JWT
// normal de Administrador daquele tenant (reaproveitando 100% da
// maquinaria de isolamento ja existente, sem tocar em nenhum guard/use
// case do resto do sistema), so que de VIDA CURTA e marcado com
// impersonadoPor para auditoria. A identidade usada e a do Administrador
// REAL que ja existe no tenant (o primeiro criado) - decisao confirmada
// com o usuario: mais simples, e literalmente "entrar como Administrador".
// A rastreabilidade de que foi o Super Usuario fica no
// AcessoPlataformaLog (fora do tenant), nao dentro dele.
import { Injectable, Inject, ForbiddenException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ITenantRepository } from '../../domain/repositories/tenant-repository.interface';
import { IAcessoPlataformaLogRepository } from '../../domain/repositories/acesso-plataforma-log-repository.interface';
import { IUserRepository } from '../../../auth/domain/repositories/user-repository.interface';
import { SUPER_USUARIO_ROLE_NAME } from '../../../../shared/domain/constants/super-usuario';

const ADMINISTRADOR_ROLE_NAME = 'Administrador';
// Vida curta de proposito (bem menor que o padrao de login normal, 1-30
// dias) - limita o estrago de um token de impersonacao vazado/copiado.
const IMPERSONATION_TOKEN_TTL = '2h';

interface ImpersonarTenantInput {
  requesterRole: string;
  requesterUserId: string;
  tenantId: string;
}

export interface ImpersonarTenantResult {
  token: string;
  tenantNome: string;
}

@Injectable()
export class ImpersonarTenantUseCase {
  constructor(
    @Inject('ITenantRepository') private readonly tenantRepository: ITenantRepository,
    @Inject('IAcessoPlataformaLogRepository')
    private readonly acessoPlataformaLogRepository: IAcessoPlataformaLogRepository,
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    private readonly jwtService: JwtService,
  ) {}

  async execute(input: ImpersonarTenantInput): Promise<ImpersonarTenantResult> {
    // Defesa em profundidade - reforca (nao substitui) o RolesGuard do
    // controller, mesmo padrao ja usado em ListTenantsUseCase.
    if (input.requesterRole !== SUPER_USUARIO_ROLE_NAME) {
      throw new ForbiddenException('Apenas o Super Usuario pode impersonar um tenant.');
    }

    const tenant = await this.tenantRepository.findByIdExceptPlataforma(input.tenantId);
    if (!tenant) {
      throw new NotFoundException('Tenant nao encontrado.');
    }

    const administradores = await this.userRepository.findAllByTenantAndRole(
      tenant.id,
      ADMINISTRADOR_ROLE_NAME,
    );
    const [primeiroAdministrador] = administradores;
    if (!primeiroAdministrador) {
      throw new NotFoundException('Este tenant nao possui nenhum Administrador para impersonar.');
    }

    const token = this.jwtService.sign(
      {
        sub: primeiroAdministrador.id,
        tenantId: tenant.id,
        role: ADMINISTRADOR_ROLE_NAME,
        cargo: null,
        standId: null,
        impersonadoPor: input.requesterUserId,
      },
      { expiresIn: IMPERSONATION_TOKEN_TTL },
    );

    await this.acessoPlataformaLogRepository.create({
      superUsuarioId: input.requesterUserId,
      tenantId: tenant.id,
      tenantNome: tenant.name,
    });

    return { token, tenantNome: tenant.name };
  }
}
