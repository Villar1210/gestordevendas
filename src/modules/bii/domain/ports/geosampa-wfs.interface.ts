// src/modules/bii/domain/ports/geosampa-wfs.interface.ts
// Acesso as camadas publicas do GeoSampa (WFS da Prefeitura de SP).
export type CamadaGeoSampa = 'quadra_fiscal' | 'lote_cidadao';

export interface FeatureGeoSampa {
  properties?: Record<string, unknown> | null;
  geometry?: unknown;
}

export class GeoSampaIndisponivelError extends Error {
  constructor(motivo: string) {
    super(`GeoSampa indisponível: ${motivo}`);
    this.name = 'GeoSampaIndisponivelError';
  }
}

export interface IGeoSampaWfs {
  // total de feicoes da camada (resultType=hits)
  contar(camada: CamadaGeoSampa, signal?: AbortSignal): Promise<number>;
  // uma pagina (startIndex/count), ja em WGS84 (EPSG:4326)
  pagina(camada: CamadaGeoSampa, inicio: number, quantidade: number, signal?: AbortSignal): Promise<FeatureGeoSampa[]>;
}

export const GEOSAMPA_WFS = Symbol('IGeoSampaWfs');
