// src/modules/social_media/application/use-cases/processar-callback-oauth.use-case.ts
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Canal } from '../../../../shared/domain/enums/canal.enum';
import {
  ISocialAccountRepository,
  CreateSocialAccountInput,
} from '../../domain/repositories/social-account-repository.interface';
import { IMetaOAuthService } from '../../domain/services/meta-oauth.interface';

export interface ProcessarCallbackOAuthInput {
  tenantId: string;
  code: string;
}

export interface ProcessarCallbackOAuthOutput {
  contasConectadas: number;
}

@Injectable()
export class ProcessarCallbackOAuthUseCase {
  private readonly logger = new Logger(ProcessarCallbackOAuthUseCase.name);

  constructor(
    @Inject('ISocialAccountRepository')
    private readonly socialAccountRepository: ISocialAccountRepository,
    @Inject('IMetaOAuthService') private readonly metaOAuthService: IMetaOAuthService,
  ) {}

  async execute(input: ProcessarCallbackOAuthInput): Promise<ProcessarCallbackOAuthOutput> {
    const { accessToken: shortLivedToken } = await this.metaOAuthService.exchangeCodeForAccessToken(
      input.code,
    );
    const { accessToken: longLivedToken, expiresInSeconds } =
      await this.metaOAuthService.exchangeForLongLivedToken(shortLivedToken);
    const tokenExpiresAt = expiresInSeconds ? new Date(Date.now() + expiresInSeconds * 1000) : null;

    const pages = await this.metaOAuthService.listUserPages(longLivedToken);
    this.logger.debug(`Gravando no banco: ${pages.length} pagina(s) a processar para tenantId=${input.tenantId}.`);

    let contasConectadas = 0;
    for (const page of pages) {
      await this.upsertConta({
        tenantId: input.tenantId,
        canal: Canal.FACEBOOK,
        externalId: page.externalId,
        accountName: page.name,
        accessToken: page.accessToken,
        tokenExpiresAt,
        status: 'CONNECTED',
      });
      contasConectadas++;

      if (page.instagram) {
        await this.upsertConta({
          tenantId: input.tenantId,
          canal: Canal.INSTAGRAM,
          externalId: page.instagram.externalId,
          // Nome de exibicao com fallback: o campo "username" do
          // instagram_business_account pode nao vir preenchido em algum
          // caso de borda da Graph API - preferimos um nome legivel
          // (nome da pagina vinculada) a deixar accountName vazio.
          accountName: page.instagram.username || `${page.name} (Instagram)`,
          // Nao existe um token proprio do Instagram nesta modelagem da
          // Graph API - operacoes na conta do Instagram Business vinculada
          // usam o MESMO token da Pagina do Facebook (ver
          // MetaPageAccount.accessToken).
          accessToken: page.accessToken,
          tokenExpiresAt,
          status: 'CONNECTED',
        });
        contasConectadas++;
      }
    }

    this.logger.debug(`Callback OAuth concluido: ${contasConectadas} SocialAccount conectada(s).`);
    return { contasConectadas };
  }

  private async upsertConta(input: CreateSocialAccountInput): Promise<void> {
    const existente = await this.socialAccountRepository.findByTenantCanalAndExternalId(
      input.tenantId,
      input.canal,
      input.externalId,
    );

    if (existente) {
      await this.socialAccountRepository.update(existente.id, {
        accountName: input.accountName,
        accessToken: input.accessToken,
        tokenExpiresAt: input.tokenExpiresAt,
        status: input.status,
      });
      this.logger.debug(`Conta atualizada: canal=${input.canal} externalId=${input.externalId}`);
      return;
    }

    await this.socialAccountRepository.create(input);
    this.logger.debug(`Conta criada: canal=${input.canal} externalId=${input.externalId}`);
  }
}
