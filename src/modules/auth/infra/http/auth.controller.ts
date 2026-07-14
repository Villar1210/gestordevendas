// src/modules/auth/infra/http/auth.controller.ts
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { LoginDto } from './dtos/login.dto';
import { RegisterDto } from './dtos/register.dto';
import { RequestPasswordResetDto } from './dtos/request-password-reset.dto';
import { ResetPasswordDto } from './dtos/reset-password.dto';
import { VerifyTwoFactorCodeDto } from './dtos/verify-two-factor-code.dto';
import { AuthenticateUserUseCase } from '../../application/use-cases/authenticate-user.use-case';
import { RegisterTenantUseCase } from '../../application/use-cases/register-tenant.use-case';
import { RequestPasswordResetUseCase } from '../../application/use-cases/request-password-reset.use-case';
import { ResetPasswordUseCase } from '../../application/use-cases/reset-password.use-case';
import { VerifyTwoFactorCodeUseCase } from '../../application/use-cases/verify-two-factor-code.use-case';
import { EnableTwoFactorUseCase } from '../../application/use-cases/enable-two-factor.use-case';
import { DisableTwoFactorUseCase } from '../../application/use-cases/disable-two-factor.use-case';
import { GetMeUseCase } from '../../application/use-cases/get-me.use-case';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authenticateUserUseCase: AuthenticateUserUseCase,
    private readonly registerTenantUseCase: RegisterTenantUseCase,
    private readonly requestPasswordResetUseCase: RequestPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetPasswordUseCase,
    private readonly verifyTwoFactorCodeUseCase: VerifyTwoFactorCodeUseCase,
    private readonly enableTwoFactorUseCase: EnableTwoFactorUseCase,
    private readonly disableTwoFactorUseCase: DisableTwoFactorUseCase,
    private readonly getMeUseCase: GetMeUseCase,
  ) {}

  // GET /auth/me - dados do usuario autenticado (usado pela Topbar)
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Req() req: Request) {
    return this.getMeUseCase.execute(req.user!.id);
  }

  // POST /auth/register - cria a empresa (Tenant) + usuario Administrador
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const result = await this.registerTenantUseCase.execute(dto);
    return {
      message: 'Empresa e administrador criados com sucesso!',
      ...result,
    };
  }

  // POST /auth/login - autentica e devolve o token JWT
  // Sobrescreve o throttler "default" global (100/min) para 5 tentativas
  // a cada 15 minutos por IP - ver app.module.ts.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 900_000 } })
  async login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authenticateUserUseCase.execute({ ...dto, ip: req.ip });
  }

  // POST /auth/forgot-password - dispara o e-mail de redefinicao de senha.
  // Resposta identica exista ou nao o e-mail, para nao revelar cadastro.
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: RequestPasswordResetDto) {
    await this.requestPasswordResetUseCase.execute(dto);
    return {
      message: 'Se o e-mail informado existir, um link de redefinicao foi enviado.',
    };
  }

  // POST /auth/reset-password - efetiva a nova senha a partir do token recebido por e-mail
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.resetPasswordUseCase.execute({
      token: dto.token,
      newPassword: dto.newPassword,
    });
    return { message: 'Senha redefinida com sucesso.' };
  }

  // POST /auth/2fa/verify - troca o codigo de 6 digitos pelo token JWT definitivo
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  async verifyTwoFactorCode(@Body() dto: VerifyTwoFactorCodeDto) {
    return this.verifyTwoFactorCodeUseCase.execute(dto);
  }

  // POST /auth/2fa/enable - ativa o 2FA por e-mail na propria conta (exige login)
  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async enableTwoFactor(@Req() req: Request) {
    // JwtAuthGuard ja garante que req.user existe neste ponto.
    await this.enableTwoFactorUseCase.execute(req.user!.id);
    return { message: '2FA ativado com sucesso.' };
  }

  // POST /auth/2fa/disable - desativa o 2FA por e-mail na propria conta (exige login)
  @Post('2fa/disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async disableTwoFactor(@Req() req: Request) {
    // JwtAuthGuard ja garante que req.user existe neste ponto.
    await this.disableTwoFactorUseCase.execute(req.user!.id);
    return { message: '2FA desativado com sucesso.' };
  }
}
