// src/modules/social_media/infra/services/meta-graph-api-oauth.service.ts
// Camada de INFRA: implementa IMetaOAuthService chamando a Graph API da
// Meta de verdade, via "fetch" nativo do Node (disponivel desde o Node 18,
// este projeto roda Node 20 - sem nenhuma dependencia nova como axios).
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  IMetaOAuthService,
  MetaPageAccount,
  MetaTokenExchangeResult,
} from '../../domain/services/meta-oauth.interface';

// v25.0 e a versao estavel da Graph API no momento desta fatia (v23 ja
// esta em fim de vida, v20 sera desativada em 24/09/2026) - bump aqui
// quando for necessario migrar para uma versao mais nova.
const GRAPH_API_VERSION = 'v25.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const OAUTH_DIALOG_URL = `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`;

// pages_show_list/pages_read_engagement/pages_manage_posts: listar e
// publicar nas Paginas do Facebook administradas pelo usuario.
// instagram_basic/instagram_content_publish: ler e publicar na conta do
// Instagram Business vinculada a cada Pagina (nao existe login direto do
// Instagram neste fluxo - a conta do Instagram so aparece atraves da
// Pagina do Facebook a que esta vinculada, ver listUserPages).
// So usado no fluxo de Facebook Login CLASSICO (App tipo Consumidor) - ver
// META_LOGIN_CONFIG_ID abaixo para o fluxo de Apps tipo Empresa.
const REQUIRED_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
].join(',');

interface GraphApiErrorBody {
  error?: { message?: string; type?: string; code?: number };
}

@Injectable()
export class MetaGraphApiOAuthService implements IMetaOAuthService {
  private readonly logger = new Logger(MetaGraphApiOAuthService.name);

  // Apps tipo Empresa usam "Facebook Login for Business", que troca o
  // parametro "scope" por "config_id" - um id gerado ao criar uma "Login
  // Configuration" no App Dashboard (Facebook Login for Business >
  // Configurations), onde as permissoes/assets ficam declarados de
  // antemao. Confirmado na pratica (Fatia 2a): com "scope" direto, o
  // dialogo carregava e ate concedia as permissoes (confirmado via
  // GET /me/permissions), mas GET /me/accounts voltava sempre vazio - o
  // acesso as Paginas so e concedido de verdade atraves do config_id.
  // Se META_LOGIN_CONFIG_ID estiver preenchido, usa o fluxo config_id
  // (Apps tipo Empresa); senao cai no fluxo classico via "scope" (Apps
  // tipo Consumidor) - os dois nunca sao combinados na mesma URL.
  buildAuthorizationUrl(state: string): string {
    const configId = process.env.META_LOGIN_CONFIG_ID;

    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID || '',
      redirect_uri: process.env.META_REDIRECT_URI || '',
      state,
      response_type: 'code',
      ...(configId ? { config_id: configId } : { scope: REQUIRED_SCOPES }),
    });

    return `${OAUTH_DIALOG_URL}?${params.toString()}`;
  }

  async exchangeCodeForAccessToken(code: string): Promise<MetaTokenExchangeResult> {
    this.logger.debug('Etapa 1/3: trocando code por access_token de curta duracao...');
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID || '',
      client_secret: process.env.META_APP_SECRET || '',
      redirect_uri: process.env.META_REDIRECT_URI || '',
      code,
    });

    const body = await this.getJson(
      `${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`,
      'exchangeCodeForAccessToken',
    );
    this.logger.debug(
      `Etapa 1/3 OK: token de curta duracao obtido (expires_in=${body.expires_in ?? 'n/a'}).`,
    );
    return { accessToken: body.access_token as string, expiresInSeconds: body.expires_in ?? null };
  }

  async exchangeForLongLivedToken(shortLivedAccessToken: string): Promise<MetaTokenExchangeResult> {
    this.logger.debug('Etapa 2/3: trocando token de curta duracao por um de longa duracao...');
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: process.env.META_APP_ID || '',
      client_secret: process.env.META_APP_SECRET || '',
      fb_exchange_token: shortLivedAccessToken,
    });

    const body = await this.getJson(
      `${GRAPH_API_BASE}/oauth/access_token?${params.toString()}`,
      'exchangeForLongLivedToken',
    );
    this.logger.debug(
      `Etapa 2/3 OK: token de longa duracao obtido (expires_in=${body.expires_in ?? 'n/a'}).`,
    );
    return { accessToken: body.access_token as string, expiresInSeconds: body.expires_in ?? null };
  }

  // LIMITACAO CONHECIDA: nao pagina o resultado (body.paging.next) - a
  // Graph API devolve so a 1a pagina de resultados (25 itens por padrao).
  // Suficiente para o uso tipico (um usuario administra poucas Paginas do
  // Facebook), mas um usuario com muitas Paginas nao veria todas nesta
  // fatia. Revisitar se isso incomodar na pratica.
  async listUserPages(userAccessToken: string): Promise<MetaPageAccount[]> {
    this.logger.debug('Etapa 3/3: buscando Paginas do Facebook administradas pelo usuario...');
    const params = new URLSearchParams({
      fields: 'id,name,access_token,instagram_business_account{id,username}',
      access_token: userAccessToken,
    });

    const body = await this.getJson(`${GRAPH_API_BASE}/me/accounts?${params.toString()}`, 'listUserPages');
    const pages = (body.data ?? []) as Array<{
      id: string;
      name: string;
      access_token: string;
      instagram_business_account?: { id: string; username?: string };
    }>;

    const resultado = pages.map((page) => ({
      externalId: page.id,
      name: page.name,
      accessToken: page.access_token,
      instagram: page.instagram_business_account
        ? {
            externalId: page.instagram_business_account.id,
            username: page.instagram_business_account.username ?? '',
          }
        : null,
    }));

    const comInstagram = resultado.filter((p) => p.instagram).length;
    this.logger.debug(
      `Etapa 3/3 OK: ${resultado.length} pagina(s) encontrada(s), ${comInstagram} com Instagram Business vinculado.`,
    );
    if (resultado.length === 0) {
      this.logger.warn(
        'Nenhuma Pagina retornada por /me/accounts - o usuario que autorizou pode nao administrar ' +
          'nenhuma Pagina do Facebook, ou nao concedeu o escopo pages_show_list durante o consentimento.',
      );
      // Diagnostico extra (so roda quando o resultado vem vazio, sem custo
      // no caminho feliz): confirma exatamente quais permissoes o token
      // final realmente carrega, distinguindo "usuario negou a permissao
      // no consentimento" de "problema de configuracao do App/Business
      // Portfolio" (nao teria como saber so pelo /me/accounts vazio).
      await this.debugLogGrantedPermissions(userAccessToken);
    }

    return resultado;
  }

  private async debugLogGrantedPermissions(userAccessToken: string): Promise<void> {
    try {
      const params = new URLSearchParams({ access_token: userAccessToken });
      const body = await this.getJson(`${GRAPH_API_BASE}/me/permissions?${params.toString()}`, 'debugPermissions');
      const permissoes = (body.data ?? []) as Array<{ permission: string; status: string }>;
      this.logger.warn(
        `Diagnostico - permissoes no token final: ${JSON.stringify(permissoes.map((p) => `${p.permission}:${p.status}`))}`,
      );
    } catch (err) {
      this.logger.warn(`Diagnostico - falha ao consultar /me/permissions: ${(err as Error).message}`);
    }
  }

  private async getJson(url: string, etapa: string): Promise<any> {
    const response = await fetch(url);
    const body = (await response.json().catch(() => null)) as (GraphApiErrorBody & Record<string, any>) | null;

    if (!response.ok) {
      const mensagem = body?.error?.message ?? `HTTP ${response.status}`;
      this.logger.error(
        `Falha na Graph API (${etapa}): status=${response.status} error=${JSON.stringify(body?.error ?? body)}`,
      );
      throw new BadRequestException(`Falha na chamada a Graph API da Meta (${etapa}): ${mensagem}`);
    }

    return body ?? {};
  }
}
