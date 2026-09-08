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
import { LogoutUseCase } from './application/use-cases/logout.use-case';
import { GetSubordinadosRecursivosUseCase } from './application/use-cases/get-subordinados-recursivos.use-case';
import { PrismaUserRepository } from './infra/database/prisma-user.repository';
import { PrismaPasswordResetTokenRepository } from './infra/database/prisma-password-reset-token.repository';
import { PrismaTwoFactorCodeRepository } from './infra/database/prisma-two-factor-code.repository';
import { JwtStrategy } from './infra/strategies/jwt.strategy';
import { PrismaService } from '../../config/prisma.service';
import { ResendEmailSender } from '../../shared/infra/services/resend-email-sender';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error(
      '[FATAL] JWT_SECRET nao esta configurado no .env. ' +
      'Defina uma chave longa e aleatoria antes de iniciar o servidor.',
    );
  }
  return secret;
}

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: getJwtSecret(),
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
    LogoutUseCase,
    GetSubordinadosRecursivosUseCase,
    JwtStrategy,
    { provide: 'IUserRepository', useClass: PrismaUserRepository },
    { provide: 'ITenantOnboardingRepository', useClass: PrismaUserRepository },
    { provide: 'IPasswordResetTokenRepository', useClass: PrismaPasswordResetTokenRepository },
    { provide: 'ITwoFactorCodeRepository', useClass: PrismaTwoFactorCodeRepository },
    { provide: 'IEmailSender', useClass: ResendEmailSender },
  ],
  exports: [JwtModule, 'IUserRepository', GetSubordinadosRecursivosUseCase],
})
export class AuthModule {}
