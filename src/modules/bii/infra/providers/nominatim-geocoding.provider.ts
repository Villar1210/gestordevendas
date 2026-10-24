// src/modules/bii/infra/providers/nominatim-geocoding.provider.ts
// Geocodificacao pelo Nominatim (OpenStreetMap), sem chave. Politica de uso:
// User-Agent proprio com contato, no maximo 1 req/s (FILA_NOMINATIM, global
// por processo), resultados cacheados (GeocodingComCacheProvider).
// Anti-SSRF: host FIXO (padrao nominatim.openstreetmap.org, ou NOMINATIM_URL
// do .env - nunca vindo do usuario); o endereco vai so como parametro
// codificado (URLSearchParams); redirect nao e seguido; timeout 10 s; resposta
// limitada a 2 MB. Erro do provedor nunca e repassado ao usuario.
import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  GeocodeResultado,
  GeocodingIndisponivelError,
  IGeocodingProvider,
  OpcoesGeocode,
  PrecisaoGeocode,
} from '../../domain/ports/geocoding-provider.interface';
import { extrairCep } from '../../domain/services/endereco';
import { VIEWBOX_CIDADE_SP } from '../../domain/services/geo';
import { FILA_NOMINATIM, FilaTaxa } from './fila-taxa';

export const NOMINATIM_URL_PADRAO = 'https://nominatim.openstreetmap.org';
export const NOMINATIM_TIMEOUT_MS = 10_000;
export const NOMINATIM_MAX_BYTES = 2 * 1024 * 1024;
export const NOMINATIM_OPCOES = 'NOMINATIM_OPCOES';

export interface OpcoesNominatim {
  fetch: typeof fetch;
  fila: FilaTaxa;
  baseUrl: string | undefined; // NOMINATIM_URL
  contato: string | undefined; // BII_CONTATO_EMAIL
  timeoutMs: number;
}

// Base URL: so https (http apenas para localhost, ex. Nominatim proprio em
// teste). Invalida -> padrao.
export function resolverBaseUrl(bruta: string | undefined): string {
  if (!bruta || !bruta.trim()) return NOMINATIM_URL_PADRAO;
  try {
    const u = new URL(bruta.trim());
    const local = u.hostname === 'localhost' || u.hostname === '127.0.0.1';
    if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) return NOMINATIM_URL_PADRAO;
    if (u.username || u.password || u.search || u.hash) return NOMINATIM_URL_PADRAO;
    return `${u.origin}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return NOMINATIM_URL_PADRAO;
  }
}

export function montarUserAgent(contato: string | undefined): string {
  // so caracteres seguros de cabecalho (sem CR/LF - anti header injection)
  const limpo = (contato ?? '').trim().replace(/[^\w.@+\-]/g, '').slice(0, 120);
  return limpo ? `gestordevendas-bii/1.0 (contato: ${limpo})` : 'gestordevendas-bii/1.0';
}

export function montarUrlBusca(baseUrl: string, consulta: string): string {
  const params = new URLSearchParams({
    format: 'jsonv2',
    limit: '1',
    countrycodes: 'br',
    addressdetails: '0',
    viewbox: VIEWBOX_CIDADE_SP,
    bounded: '1',
    q: consulta,
  });
  return `${baseUrl}/search?${params.toString()}`;
}

interface ItemNominatim {
  lat?: unknown;
  lon?: unknown;
  category?: unknown;
  type?: unknown;
  addresstype?: unknown;
  place_rank?: unknown;
  display_name?: unknown;
}

const NIVEIS_AMPLOS = new Set(['city', 'town', 'village', 'municipality', 'county', 'state', 'region', 'country', 'state_district']);

// Precisao pelo tipo devolvido. null = amplo demais (cidade/estado): tratado
// como "nao achou" - um pino no centro da cidade enganaria a analise.
export function precisaoNominatim(item: ItemNominatim): PrecisaoGeocode | null {
  const tipo = String(item.type ?? '');
  const categoria = String(item.category ?? '');
  const addresstype = String(item.addresstype ?? '');
  const rank = typeof item.place_rank === 'number' ? item.place_rank : Number(item.place_rank ?? NaN);
  if (NIVEIS_AMPLOS.has(addresstype)) return null;
  if (addresstype === 'postcode' || tipo === 'postcode') return 'cep';
  if (['house', 'building'].includes(addresstype) || categoria === 'building' || tipo === 'house' || rank >= 28) {
    return 'rooftop';
  }
  if (addresstype === 'road' || categoria === 'highway' || rank === 26 || rank === 27) return 'rua';
  if (Number.isFinite(rank) && rank >= 17) return 'bairro';
  return null;
}

export function interpretarResposta(corpo: unknown): GeocodeResultado | null {
  if (!Array.isArray(corpo) || corpo.length === 0) return null;
  const item = corpo[0] as ItemNominatim;
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const precisao = precisaoNominatim(item);
  if (!precisao) return null;
  const enderecoFormatado = String(item.display_name ?? '').slice(0, 500);
  return { lat, lng, precisao, enderecoFormatado, cep: extrairCep(enderecoFormatado) };
}

@Injectable()
export class NominatimGeocodingProvider implements IGeocodingProvider {
  readonly nome = 'nominatim';
  private readonly logger = new Logger(NominatimGeocodingProvider.name);
  private readonly opcoes: OpcoesNominatim;

  constructor(@Optional() @Inject(NOMINATIM_OPCOES) opcoes?: Partial<OpcoesNominatim>) {
    this.opcoes = {
      fetch: opcoes?.fetch ?? ((...args: Parameters<typeof fetch>) => globalThis.fetch(...args)),
      fila: opcoes?.fila ?? FILA_NOMINATIM,
      baseUrl: opcoes?.baseUrl ?? process.env.NOMINATIM_URL,
      contato: opcoes?.contato ?? process.env.BII_CONTATO_EMAIL,
      timeoutMs: opcoes?.timeoutMs ?? NOMINATIM_TIMEOUT_MS,
    };
  }

  async geocodificar(consulta: string, opcoes?: OpcoesGeocode): Promise<GeocodeResultado | null> {
    const url = montarUrlBusca(resolverBaseUrl(this.opcoes.baseUrl), consulta);
    const userAgent = montarUserAgent(this.opcoes.contato);
    return this.opcoes.fila.agendar(async () => {
      const sinais = [AbortSignal.timeout(this.opcoes.timeoutMs)];
      if (opcoes?.signal) sinais.push(opcoes.signal);
      let resposta: Response;
      try {
        resposta = await this.opcoes.fetch(url, {
          method: 'GET',
          headers: { 'User-Agent': userAgent, Accept: 'application/json', 'Accept-Language': 'pt-BR' },
          redirect: 'error',
          signal: AbortSignal.any(sinais),
        });
      } catch (erro) {
        if (opcoes?.signal?.aborted) throw erro; // desligamento/cancelamento
        const motivo = (erro as Error)?.name === 'TimeoutError' ? 'timeout' : 'falha de rede';
        this.logger.warn(`Nominatim: ${motivo}`);
        throw new GeocodingIndisponivelError(motivo);
      }
      if (!resposta.ok) {
        this.logger.warn(`Nominatim: HTTP ${resposta.status}`);
        throw new GeocodingIndisponivelError(`HTTP ${resposta.status}`);
      }
      const declarado = Number(resposta.headers.get('content-length') ?? '0');
      if (declarado > NOMINATIM_MAX_BYTES) throw new GeocodingIndisponivelError('resposta grande demais');
      let texto: string;
      try {
        texto = await resposta.text();
      } catch {
        throw new GeocodingIndisponivelError('falha ao ler a resposta');
      }
      if (texto.length > NOMINATIM_MAX_BYTES) throw new GeocodingIndisponivelError('resposta grande demais');
      let corpo: unknown;
      try {
        corpo = JSON.parse(texto);
      } catch {
        throw new GeocodingIndisponivelError('resposta invalida');
      }
      return interpretarResposta(corpo);
    }, opcoes?.signal);
  }
}
