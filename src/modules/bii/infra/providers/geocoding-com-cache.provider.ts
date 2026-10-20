// src/modules/bii/infra/providers/geocoding-com-cache.provider.ts
// Decorator: GeocodeCache primeiro; so consulta o Nominatim quando nao ha
// registro. Grava SEMPRE a resposta definitiva, inclusive "nao achou" (lat/lng
// nulos) - para nao repetir a mesma consulta. "Nao achou" vale 30 dias (o
// OpenStreetMap ganha enderecos novos); achado vale para sempre. Falha
// temporaria (GeocodingIndisponivelError) nao vai para o cache.
import { createHash } from 'crypto';
import { Inject, Injectable } from '@nestjs/common';
import {
  GeocodeResultado,
  IGeocodingComCache,
  OpcoesGeocode,
  ResultadoComFonte,
} from '../../domain/ports/geocoding-provider.interface';
import { GEOCODE_CACHE_REPOSITORY, IGeocodeCacheRepository } from '../../domain/repositories/geocode-cache-repository.interface';
import { extrairCep, normalizarEnderecoLivre } from '../../domain/services/endereco';
import { NominatimGeocodingProvider } from './nominatim-geocoding.provider';

export const VALIDADE_NAO_ACHOU_MS = 30 * 24 * 60 * 60 * 1000;

// Texto digitado: guarda so o hash (o cache nao revela o que foi pesquisado).
export function chaveCacheTexto(consulta: string): string {
  return `txt:${createHash('sha256').update(normalizarEnderecoLivre(consulta)).digest('hex')}`;
}

export { chaveCacheItbi } from '../../domain/ports/geocoding-provider.interface';

@Injectable()
export class GeocodingComCacheProvider implements IGeocodingComCache {
  readonly nome = 'cache+nominatim';
  // relogio substituivel em teste
  agora: () => Date = () => new Date();

  constructor(
    private readonly provedor: NominatimGeocodingProvider,
    @Inject(GEOCODE_CACHE_REPOSITORY) private readonly cache: IGeocodeCacheRepository,
  ) {}

  async geocodificar(consulta: string, opcoes?: OpcoesGeocode): Promise<GeocodeResultado | null> {
    return (await this.geocodificarComFonte(consulta, opcoes)).resultado;
  }

  async geocodificarComFonte(consulta: string, opcoes?: OpcoesGeocode): Promise<ResultadoComFonte> {
    const chave = opcoes?.chaveCache ?? chaveCacheTexto(consulta);
    const salvo = await this.cache.buscar(chave);
    if (salvo) {
      if (salvo.lat !== null && salvo.lng !== null && salvo.precisao) {
        return {
          fonte: 'cache',
          resultado: {
            lat: salvo.lat,
            lng: salvo.lng,
            precisao: salvo.precisao,
            enderecoFormatado: salvo.enderecoFormatado ?? '',
            cep: extrairCep(salvo.enderecoFormatado),
          },
        };
      }
      if (this.agora().getTime() - salvo.criadoEm.getTime() < VALIDADE_NAO_ACHOU_MS) {
        return { fonte: 'cache', resultado: null };
      }
    }
    const resultado = await this.provedor.geocodificar(consulta, { signal: opcoes?.signal });
    await this.cache.gravar({
      chave,
      provedor: this.provedor.nome,
      lat: resultado?.lat ?? null,
      lng: resultado?.lng ?? null,
      precisao: resultado?.precisao ?? null,
      enderecoFormatado: resultado?.enderecoFormatado ?? null,
    });
    return { fonte: 'provedor', resultado };
  }
}
