// src/modules/social_media/domain/services/meta-oauth.interface.ts
// Camada de DOMINIO: contrato de integracao com o provedor OAuth (Meta
// Graph API), sem saber que existe "fetch" ou qualquer detalhe HTTP -
// mesmo padrao ja usado por IEmailSender/IFileStorageService/
// IDocumentConverterService neste projeto.

export interface MetaTokenExchangeResult {
  accessToken: string;
  expiresInSeconds: number | null;
}

export interface MetaInstagramAccount {
  externalId: string;
  username: string;
}

export interface MetaPageAccount {
  externalId: string;
  name: string;
  // Token de acesso da PROPRIA pagina - usado tambem para operacoes na
  // conta do Instagram Business vinculada (nao existe um token separado
  // para o Instagram nesta modelagem da Graph API).
  accessToken: string;
  instagram: MetaInstagramAccount | null;
}

export interface IMetaOAuthService {
  buildAuthorizationUrl(state: string): string;
  exchangeCodeForAccessToken(code: string): Promise<MetaTokenExchangeResult>;
  // Um token de usuario de curta duracao (~1-2h) vira um de longa duracao
  // (~60 dias) - sem isso, toda conexao expiraria quase imediatamente.
  exchangeForLongLivedToken(shortLivedAccessToken: string): Promise<MetaTokenExchangeResult>;
  listUserPages(userAccessToken: string): Promise<MetaPageAccount[]>;
}
