// src/modules/super_usuario/super-usuario.module.ts
import { Module } from '@nestjs/common';
import { SuperUsuarioController } from './infra/http/super-usuario.controller';
import { ListTenantsUseCase } from './application/use-cases/list-tenants.use-case';
import { ImpersonarTenantUseCase } from './application/use-cases/impersonar-tenant.use-case';
import { PrismaTenantRepository } from './infra/database/prisma-tenant.repository';
import { PrismaAcessoPlataformaLogRepository } from './infra/database/prisma-acesso-plataforma-log.repository';
import { PrismaService } from '../../config/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  // Dependencia de modulo (nao circular): super_usuario consome
  // IUserRepository (achar o Administrador do tenant escolhido) e
  // JwtModule/JwtService (assinar o token de impersonacao) ja exportados
  // por AuthModule. O caminho inverso nao existe - AuthModule nao conhece
  // super_usuario.
  imports: [AuthModule],
  controllers: [SuperUsuarioController],
  providers: [
    PrismaService,
    ListTenantsUseCase,
    ImpersonarTenantUseCase,
    // Inversao de dependencia: o Caso de Uso pede a INTERFACE,
    // aqui entregamos a implementacao concreta (Prisma).
    { provide: 'ITenantRepository', useClass: PrismaTenantRepository },
    { provide: 'IAcessoPlataformaLogRepository', useClass: PrismaAcessoPlataformaLogRepository },
  ],
})
export class SuperUsuarioModule {}
