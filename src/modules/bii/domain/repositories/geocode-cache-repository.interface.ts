// src/modules/bii/domain/repositories/geocode-cache-repository.interface.ts
// GeocodeCache (GLOBAL). lat/lng nulos = "o provedor nao achou".
import { PrecisaoGeocode } from '../ports/geocoding-provider.interface';

export interface GeocodeCacheRegistro {
  chave: string;
  provedor: string;
  lat: number | null;
  lng: number | null;
  precisao: PrecisaoGeocode | null;
  enderecoFormatado: string | null;
  criadoEm: Date;
}

export interface IGeocodeCacheRepository {
  buscar(chave: string): Promise<GeocodeCacheRegistro | null>;
  // upsert por chave
  gravar(registro: Omit<GeocodeCacheRegistro, 'criadoEm'>): Promise<void>;
}

export const GEOCODE_CACHE_REPOSITORY = 'IGeocodeCacheRepository';
