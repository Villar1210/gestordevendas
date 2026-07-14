// src/modules/configuracoes/configuracoes.module.ts
import { Module } from '@nestjs/common';
import { TenantConfigController } from './infra/http/tenant-config.controller';
import { GetTenantConfigUseCase } from './application/use-cases/get-tenant-config.use-case';
import { UpdateTenantConfigUseCase } from './application/use-cases/update-tenant-config.use-case';
import { PrismaTenantConfigRepository } from './infra/database/prisma-tenant-config.repository';
import { PrismaService } from '../../config/prisma.service';

@Module({
  controllers: [TenantConfigController],
  providers: [
    PrismaService,
    GetTenantConfigUseCase,
    UpdateTenantConfigUseCase,
    { provide: 'ITenantConfigRepository', useClass: PrismaTenantConfigRepository },
  ],
  // Exportado para o modulo rh: GerarContratoPrestacaoServicoUseCase le os
  // dados de razao social/CNPJ/endereco do CONTRATANTE para preencher o
  // contrato de prestacao de servico.
  exports: ['ITenantConfigRepository'],
})
export class ConfiguracoesModule {}
