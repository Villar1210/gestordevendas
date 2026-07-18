// src/modules/super_usuario/infra/http/super-usuario.controller.ts
import { Controller, Get, Post, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { SUPER_USUARIO_ROLE_NAME } from '../../../../shared/domain/constants/super-usuario';
import { ListTenantsUseCase } from '../../application/use-cases/list-tenants.use-case';
import { ImpersonarTenantUseCase } from '../../application/use-cases/impersonar-tenant.use-case';
import { ListAcessosPlataformaUseCase } from '../../application/use-cases/list-acessos-plataforma.use-case';

@Controller('super-usuario')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(SUPER_USUARIO_ROLE_NAME)
export class SuperUsuarioController {
  constructor(
    private readonly listTenantsUseCase: ListTenantsUseCase,
    private readonly impersonarTenantUseCase: ImpersonarTenantUseCase,
    private readonly listAcessosPlataformaUseCase: ListAcessosPlataformaUseCase,
  ) {}

  // GET /super-usuario/tenants - lista todos os tenants (exceto a
  // "Plataforma" do proprio Super Usuario) - UNICA leitura cross-tenant
  // deliberada do sistema.
  @Get('tenants')
  async listTenants(@Req() req: Request) {
    return this.listTenantsUseCase.execute({ requesterRole: req.user!.role });
  }

  // POST /super-usuario/tenants/:id/impersonate - emite um token de
  // Administrador (vida curta, 2h) do tenant escolhido, registrando a
  // auditoria - ver ImpersonarTenantUseCase.
  @Post('tenants/:id/impersonate')
  async impersonate(@Param('id') id: string, @Req() req: Request) {
    return this.impersonarTenantUseCase.execute({
      requesterRole: req.user!.role,
      requesterUserId: req.user!.id,
      tenantId: id,
    });
  }

  // GET /super-usuario/meus-acessos - historico de auditoria (Fatia 3):
  // toda impersonacao que O PROPRIO Super Usuario logado ja fez.
  @Get('meus-acessos')
  async meusAcessos(@Req() req: Request) {
    return this.listAcessosPlataformaUseCase.execute({
      requesterRole: req.user!.role,
      requesterUserId: req.user!.id,
    });
  }
}
