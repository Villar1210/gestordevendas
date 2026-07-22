// src/modules/social_media/social-media.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../../config/prisma.service';
import { SocialController } from './infra/http/social.controller';
import { SocialWebhookController } from './infra/http/social-webhook.controller';
import { IniciarConexaoSocialUseCase } from './application/use-cases/iniciar-conexao-social.use-case';
import { ProcessarCallbackOAuthUseCase } from './application/use-cases/processar-callback-oauth.use-case';
import { ListSocialAccountsUseCase } from './application/use-cases/list-social-accounts.use-case';
import { DesconectarContaSocialUseCase } from './application/use-cases/desconectar-conta-social.use-case';
import { ProcessMetaWebhookEventUseCase } from './application/use-cases/process-meta-webhook-event.use-case';
import { PrismaSocialAccountRepository } from './infra/database/prisma-social-account.repository';
import { PrismaSocialMessageRepository } from './infra/database/prisma-social-message.repository';
import { MetaGraphApiOAuthService } from './infra/services/meta-graph-api-oauth.service';
import { MetaGraphApiMessagingService } from './infra/services/meta-graph-api-messaging.service';

@Module({
  // AuthModule so pelo JwtModule que ele exporta - o "state" assinado do
  // fluxo OAuth reaproveita a MESMA JwtService/JWT_SECRET ja usada pelo
  // login (payload proprio, com "purpose" marcando o que e - ver
  // domain/services/social-oauth-state.ts), sem precisar de um segredo
  // novo so para isso.
  imports: [AuthModule],
  controllers: [SocialController, SocialWebhookController],
  providers: [
    PrismaService,
    IniciarConexaoSocialUseCase,
    ProcessarCallbackOAuthUseCase,
    ListSocialAccountsUseCase,
    DesconectarContaSocialUseCase,
    ProcessMetaWebhookEventUseCase,
    // Inversao de dependencia: o Caso de Uso pede a INTERFACE,
    // aqui entregamos a implementacao concreta.
    { provide: 'ISocialAccountRepository', useClass: PrismaSocialAccountRepository },
    { provide: 'ISocialMessageRepository', useClass: PrismaSocialMessageRepository },
    { provide: 'IMetaOAuthService', useClass: MetaGraphApiOAuthService },
    { provide: 'ISocialMessagingService', useClass: MetaGraphApiMessagingService },
  ],
  // Exportado para CanaisModule (MessageDispatcherService, canais
  // INSTAGRAM/FACEBOOK) e para ViviSdrModule (ProcessIncomingSocialMessageUseCase,
  // que le SocialAccount/SocialMessage para alimentar a VIVI) - mesmo
  // padrao de dependencia de modulo (nao circular) ja usado por outros
  // modulos deste projeto (ex: roleta_online -> vendas_kanban+rh).
  exports: ['ISocialAccountRepository', 'ISocialMessageRepository', 'ISocialMessagingService'],
})
export class SocialMediaModule {}
