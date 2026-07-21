// src/modules/social_media/infra/http/social.controller.ts
// Mistura deliberada de rotas publicas e autenticadas no MESMO controller
// (mesmo padrao ja usado em RhController, por causa de /rh/cadastro-publico):
// guards aplicados por METODO, nao no controller inteiro.
import { Controller, Delete, Get, Logger, Param, Query, Req, Res, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../shared/infra/http/guards/roles.guard';
import { Roles } from '../../../../shared/infra/http/decorators/roles.decorator';
import { SocialCallbackQueryDto } from './dtos/social-callback-query.dto';
import { IniciarConexaoSocialUseCase } from '../../application/use-cases/iniciar-conexao-social.use-case';
import { ProcessarCallbackOAuthUseCase } from '../../application/use-cases/processar-callback-oauth.use-case';
import { ListSocialAccountsUseCase } from '../../application/use-cases/list-social-accounts.use-case';
import { DesconectarContaSocialUseCase } from '../../application/use-cases/desconectar-conta-social.use-case';
import { isSocialOAuthStatePayload } from '../../domain/services/social-oauth-state';

function frontendRedesSociaisUrl(): string {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
  return `${frontendUrl}/dashboard/redes-sociais`;
}

@Controller('social')
export class SocialController {
  private readonly logger = new Logger(SocialController.name);

  constructor(
    private readonly iniciarConexaoSocialUseCase: IniciarConexaoSocialUseCase,
    private readonly processarCallbackOAuthUseCase: ProcessarCallbackOAuthUseCase,
    private readonly listSocialAccountsUseCase: ListSocialAccountsUseCase,
    private readonly desconectarContaSocialUseCase: DesconectarContaSocialUseCase,
    private readonly jwtService: JwtService,
  ) {}

  // GET /social/conectar/iniciar - Conectar contas sociais e uma acao
  // sensivel (credenciais de OAuth), restrita a Administrador - mesmo
  // criterio ja usado para dados financeiros (FinanceiroController) e
  // aprovacoes de RH.
  @Get('conectar/iniciar')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  iniciar(@Req() req: Request) {
    return this.iniciarConexaoSocialUseCase.execute({
      tenantId: req.user!.tenantId,
      userId: req.user!.id,
    });
  }

  // GET /social/callback - rota PUBLICA (o navegador chega aqui via
  // redirect da propria Meta apos o consentimento, uma navegacao comum de
  // pagina - nao uma chamada fetch/XHR do frontend, entao NAO carrega o
  // header Authorization do login normal). A seguranca vem inteiramente da
  // validacao do "state" assinado (JWT de vida curta, ver
  // IniciarConexaoSocialUseCase) - mesmo raciocinio ja usado pelos links
  // publicos de assinatura do E-doc e de descadastro do Repique.
  @Get('callback')
  async callback(
    @Query() query: SocialCallbackQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const redesSociaisUrl = frontendRedesSociaisUrl();

    if (query.error) {
      res.redirect(`${redesSociaisUrl}?social=cancelado`);
      return;
    }

    if (!query.code || !query.state) {
      res.redirect(`${redesSociaisUrl}?social=erro&motivo=parametros_ausentes`);
      return;
    }

    let payload: unknown;
    try {
      payload = this.jwtService.verify(query.state);
    } catch (err) {
      this.logger.warn(`State invalido/expirado no callback OAuth: ${(err as Error).message}`);
      res.redirect(`${redesSociaisUrl}?social=erro&motivo=state_invalido`);
      return;
    }

    if (!isSocialOAuthStatePayload(payload)) {
      this.logger.warn('State decodificado nao tem o formato esperado (purpose incorreto ou ausente).');
      res.redirect(`${redesSociaisUrl}?social=erro&motivo=state_invalido`);
      return;
    }

    try {
      const resultado = await this.processarCallbackOAuthUseCase.execute({
        tenantId: payload.tenantId,
        code: query.code,
      });
      res.redirect(`${redesSociaisUrl}?social=sucesso&contas=${resultado.contasConectadas}`);
    } catch (err) {
      this.logger.error(
        `Falha ao processar callback OAuth (tenantId=${payload.tenantId}): ${(err as Error).message}`,
        (err as Error).stack,
      );
      res.redirect(`${redesSociaisUrl}?social=erro&motivo=falha_conexao`);
    }
  }

  // GET /social/contas
  @Get('contas')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  listar(@Req() req: Request) {
    return this.listSocialAccountsUseCase.execute({ tenantId: req.user!.tenantId });
  }

  // DELETE /social/contas/:id
  @Delete('contas/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('Administrador')
  desconectar(@Param('id') id: string, @Req() req: Request) {
    return this.desconectarContaSocialUseCase.execute({ tenantId: req.user!.tenantId, id });
  }
}
