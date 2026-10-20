// src/modules/bii/domain/ports/geocoding-provider.interface.ts
// Porta de geocodificacao (endereco em texto -> ponto). Implementacoes em
// infra/providers: NominatimGeocodingProvider (OpenStreetMap) e o decorator
// GeocodingComCacheProvider (GeocodeCache, inclusive "nao achou").

export type PrecisaoGeocode = 'rooftop' | 'rua' | 'cep' | 'bairro';

export interface GeocodeResultado {
  lat: number;
  lng: number;
  precisao: PrecisaoGeocode;
  enderecoFormatado: string;
  cep: string | null; // so se o provedor devolveu (nunca inventado)
}

export interface OpcoesGeocode {
  // chave do GeocodeCache; sem ela, o decorator calcula a partir do texto
  chaveCache?: string;
  signal?: AbortSignal;
}

export interface IGeocodingProvider {
  readonly nome: string;
  // null = o provedor respondeu e NAO achou (resposta definitiva, vai para o
  // cache). Falha de rede/timeout/HTTP 5xx/429 -> lanca GeocodingIndisponivelError
  // (nao vai para o cache).
  geocodificar(consulta: string, opcoes?: OpcoesGeocode): Promise<GeocodeResultado | null>;
}

export class GeocodingIndisponivelError extends Error {
  constructor(motivo: string) {
    super(`Geocodificacao indisponivel: ${motivo}`);
    this.name = 'GeocodingIndisponivelError';
  }
}

export const GEOCODING_PROVIDER = 'IGeocodingProvider';

// Provedor com cache que informa de onde veio a resposta (o job em lote conta
// consultas reais x acertos de cache).
export interface ResultadoComFonte {
  resultado: GeocodeResultado | null;
  fonte: 'cache' | 'provedor';
}

export interface IGeocodingComCache extends IGeocodingProvider {
  geocodificarComFonte(consulta: string, opcoes?: OpcoesGeocode): Promise<ResultadoComFonte>;
}

export const GEOCODING_COM_CACHE = 'IGeocodingComCache';

// Chave do GeocodeCache para um endereco do ITBI.
export function chaveCacheItbi(enderecoChave: string): string {
  return `itbi:${enderecoChave}`.slice(0, 300);
}
