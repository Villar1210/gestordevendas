// src/modules/social_media/social-media.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../../config/prisma.service';
import { SocialController } from './infra/http/social.controller';
import { IniciarConexaoSocialUseCase } from './application/use-cases/iniciar-conexao-social.use-case';
import { ProcessarCallbackOAuthUseCase } from './application/use-cases/processar-callback-oauth.use-case';
import { ListSocialAccountsUseCase } from './application/use-cases/list-social-accounts.use-case';
import { DesconectarContaSocialUseCase } from './application/use-cases/desconectar-conta-social.use-case';
import { PrismaSocialAccountRepository } from './infra/database/prisma-social-account.repository';
import { MetaGraphApiOAuthService } from './infra/services/meta-graph-api-oauth.service';

@Module({
  // AuthModule so pelo JwtModule que ele exporta - o "state" assinado do
  // fluxo OAuth reaproveita a MESMA JwtService/JWT_SECRET ja usada pelo
  // login (payload proprio, com "purpose" marcando o que e - ver
  // domain/services/social-oauth-state.ts), sem precisar de um segredo
  // novo so para isso.
  imports: [AuthModule],
  controllers: [SocialController],
  providers: [
    PrismaService,
    IniciarConexaoSocialUseCase,
    ProcessarCallbackOAuthUseCase,
    ListSocialAccountsUseCase,
    DesconectarContaSocialUseCase,
    // Inversao de dependencia: o Caso de Uso pede a INTERFACE,
    // aqui entregamos a implementacao concreta.
    { provide: 'ISocialAccountRepository', useClass: PrismaSocialAccountRepository },
    { provide: 'IMetaOAuthService', useClass: MetaGraphApiOAuthService },
  ],
})
export class SocialMediaModule {}
