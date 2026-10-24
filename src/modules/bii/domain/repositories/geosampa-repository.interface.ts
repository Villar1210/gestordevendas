// src/modules/bii/domain/repositories/geosampa-repository.interface.ts
// Quadras e lotes fiscais do GeoSampa (tabelas GLOBAIS, dado publico, sem
// tenantId - como o ITBI) e a aplicacao das coordenadas nas guias do ITBI.
import { LoteFiscal } from '../services/geosampa';

export interface QuadraFiscal {
  setor: string;
  quadra: string;
  lat: number;
  lng: number;
}

export interface ContagemGeoSampa {
  quadras: number;
  lotes: number;
  atualizadoEm: Date | null; // ultima gravacao de quadra
}

export interface CoberturaPorPrecisao {
  total: number;
  lote: number;
  quadra: number;
  endereco: number; // rooftop/rua/cep/bairro (Nominatim)
  semLocal: number;
}

export interface ResultadoLocalizacao {
  porLote: number;
  porQuadra: number;
}

export interface IGeoSampaRepository {
  gravarQuadras(quadras: QuadraFiscal[]): Promise<number>;
  gravarLotes(lotes: LoteFiscal[]): Promise<number>;
  contar(): Promise<ContagemGeoSampa>;
  // setores distintos presentes nas guias do ITBI (para processar em partes)
  setoresDoItbi(importacaoId?: string): Promise<string[]>;
  // aplica lote (exato) e depois quadra nas guias daquele setor; so troca
  // coordenada de precisao PIOR (ver RANK_PRECISAO)
  localizarSetor(setor: string, importacaoId?: string): Promise<ResultadoLocalizacao>;
  coberturaPorPrecisao(): Promise<CoberturaPorPrecisao>;
}

export const GEOSAMPA_REPOSITORY = Symbol('IGeoSampaRepository');
