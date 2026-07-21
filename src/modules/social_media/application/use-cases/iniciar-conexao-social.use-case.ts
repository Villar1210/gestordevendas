// src/modules/social_media/application/use-cases/iniciar-conexao-social.use-case.ts
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { IMetaOAuthService } from '../../domain/services/meta-oauth.interface';
import { SOCIAL_OAUTH_STATE_PURPOSE } from '../../domain/services/social-oauth-state';

export interface IniciarConexaoSocialInput {
  tenantId: string;
  userId: string;
}

export interface IniciarConexaoSocialOutput {
  url: string;
}

// Janela curta de proposito - o usuario tem 10 minutos para concluir o
// consentimento na tela da Meta antes do "state" expirar (ver
// ProcessarCallbackOAuthUseCase, que rejeita um state expirado/invalido).
const STATE_EXPIRES_IN = '10m';

@Injectable()
export class IniciarConexaoSocialUseCase {
  constructor(
    private readonly jwtService: JwtService,
    @Inject('IMetaOAuthService') private readonly metaOAuthService: IMetaOAuthService,
  ) {}

  execute(input: IniciarConexaoSocialInput): IniciarConexaoSocialOutput {
    const state = this.jwtService.sign(
      {
        tenantId: input.tenantId,
        userId: input.userId,
        purpose: SOCIAL_OAUTH_STATE_PURPOSE,
      },
      { expiresIn: STATE_EXPIRES_IN },
    );

    return { url: this.metaOAuthService.buildAuthorizationUrl(state) };
  }
}
