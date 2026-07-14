// src/modules/configuracoes/infra/http/tenant-config.controller.ts
import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { DASHBOARD_ROLES } from '../../../../shared/domain/constants/dashboard-roles';
import { UpdateTenantConfigDto } from './dtos/update-tenant-config.dto';
import { GetTenantConfigUseCase } from '../../application/use-cases/get-tenant-config.use-case';
import { UpdateTenantConfigUseCase } from '../../application/use-cases/update-tenant-config.use-case';

@Controller('configuracoes/empresa')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(...DASHBOARD_ROLES)
export class TenantConfigController {
  constructor(
    private readonly getTenantConfigUseCase: GetTenantConfigUseCase,
    private readonly updateTenantConfigUseCase: UpdateTenantConfigUseCase,
  ) {}

  // GET /configuracoes/empresa - qualquer role de dashboard pode ver (ex:
  // o contrato gerado pelo modulo rh depende desses dados, mas so o
  // Administrador pode editar - checagem estrita dentro do UseCase).
  @Get()
  async get(@Req() req: Request) {
    return this.getTenantConfigUseCase.execute({ tenantId: req.user!.tenantId });
  }

  // PATCH /configuracoes/empresa - so Administrador (reforcado dentro do
  // UseCase, nao so aqui - mesmo padrao ja usado no RhController).
  @Patch()
  async update(@Body() dto: UpdateTenantConfigDto, @Req() req: Request) {
    return this.updateTenantConfigUseCase.execute({
      tenantId: req.user!.tenantId,
      requesterRole: req.user!.role,
      ...dto,
    });
  }
}
