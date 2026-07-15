// src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './infra/http/auth.controller';
import { AuthenticateUserUseCase } from './application/use-cases/authenticate-user.use-case';
import { RegisterTenantUseCase } from './application/use-cases/register-tenant.use-case';
import { RequestPasswordResetUseCase } from './application/use-cases/request-password-reset.use-case';
import { ResetPasswordUseCase } from './application/use-cases/reset-password.use-case';
import { VerifyTwoFactorCodeUseCase } from './application/use-cases/verify-two-factor-code.use-case';
import { EnableTwoFactorUseCase } from './application/use-cases/enable-two-factor.use-case';
import { DisableTwoFactorUseCase } from './application/use-cases/disable-two-factor.use-case';
import { GetMeUseCase } from './application/use-cases/get-me.use-case';
import { UpdateMyProfileUseCase } from './application/use-cases/update-my-profile.use-case';
import { GetSubordinadosRecursivosUseCase } from './application/use-cases/get-subordinados-recursivos.use-case';
import { PrismaUserRepository } from './infra/database/prisma-user.repository';
import { PrismaPasswordResetTokenRepository } from './infra/database/prisma-password-reset-token.repository';
import { PrismaTwoFactorCodeRepository } from './infra/database/prisma-two-factor-code.repository';
import { JwtStrategy } from './infra/strategies/jwt.strategy';
import { PrismaService } from '../../config/prisma.service';
import { ResendEmailSender } from '../../shared/infra/services/resend-email-sender';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret-fallback',
      signOptions: { expiresIn: (process.env.JWT_EXPIRES_IN || '1d') as any },
    }),
  ],
  controllers: [AuthController],
  providers: [
    PrismaService,
    AuthenticateUserUseCase,
    RegisterTenantUseCase,
    RequestPasswordResetUseCase,
    ResetPasswordUseCase,
    VerifyTwoFactorCodeUseCase,
    EnableTwoFactorUseCase,
    DisableTwoFactorUseCase,
    GetMeUseCase,
    UpdateMyProfileUseCase,
    GetSubordinadosRecursivosUseCase,
    JwtStrategy,
    // Inversao de dependencia: o Caso de Uso pede a INTERFACE,
    // aqui entregamos a implementacao concreta (Prisma).
    { provide: 'IUserRepository', useClass: PrismaUserRepository },
    { provide: 'ITenantOnboardingRepository', useClass: PrismaUserRepository },
    { provide: 'IPasswordResetTokenRepository', useClass: PrismaPasswordResetTokenRepository },
    { provide: 'ITwoFactorCodeRepository', useClass: PrismaTwoFactorCodeRepository },
    { provide: 'IEmailSender', useClass: ResendEmailSender },
  ],
  // IUserRepository exportado para o modulo portal_cliente: o
  // PortalClienteController resolve o e-mail do usuario logado (nao vem no
  // payload do JWT, so id/tenantId/role) a partir do proprio id.
  // GetSubordinadosRecursivosUseCase exportado para os modulos que
  // precisam do escopo "equipe" do RBAC por cargo (vendas_kanban,
  // atendimento, whatsappmarketing - ver shared/domain/services/cargo-escopo.ts).
  exports: [JwtModule, 'IUserRepository', GetSubordinadosRecursivosUseCase],
})
export class AuthModule {}
