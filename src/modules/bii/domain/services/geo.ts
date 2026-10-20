// src/modules/bii/domain/services/geo.ts
// Distancia (haversine), bounding box a partir de um raio e limites da Grande
// SP. Funcoes PURAS. Busca no raio = bounding box no SQL (usa o indice
// lat/lng) + haversine aqui para cortar os cantos do quadrado.

export interface GeoPonto {
  lat: number;
  lng: number;
}

export interface BoundingBox {
  sul: number;
  norte: number;
  oeste: number;
  leste: number;
}

export const RAIO_TERRA_METROS = 6_371_008.8; // raio medio (IUGG)

export function coordenadaValida(p: GeoPonto): boolean {
  return (
    Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180
  );
}

const rad = (graus: number) => (graus * Math.PI) / 180;

export function distanciaMetros(a: GeoPonto, b: GeoPonto): number {
  if (!coordenadaValida(a) || !coordenadaValida(b)) throw new Error('Coordenada invalida.');
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * RAIO_TERRA_METROS * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Quadrado que CONTEM o circulo (com 1% de folga para arredondamento). Perto
// dos polos a longitude abre para o mundo todo (irrelevante em SP, mas evita
// divisao por zero).
export function boundingBox(centro: GeoPonto, raioMetros: number): BoundingBox {
  if (!coordenadaValida(centro)) throw new Error('Coordenada invalida.');
  if (!Number.isFinite(raioMetros) || raioMetros <= 0) throw new Error('Raio invalido.');
  const r = raioMetros * 1.01;
  const dLat = (r / RAIO_TERRA_METROS) * (180 / Math.PI);
  const cosLat = Math.cos(rad(centro.lat));
  const dLng = cosLat < 1e-6 ? 180 : (r / (RAIO_TERRA_METROS * cosLat)) * (180 / Math.PI);
  return {
    sul: Math.max(-90, centro.lat - dLat),
    norte: Math.min(90, centro.lat + dLat),
    oeste: Math.max(-180, centro.lng - dLng),
    leste: Math.min(180, centro.lng + dLng),
  };
}

// Inclusivo no limite (distancia == raio entra).
export function dentroDoRaio(centro: GeoPonto, ponto: GeoPonto, raioMetros: number): boolean {
  return distanciaMetros(centro, ponto) <= raioMetros;
}

// Retangulo AMPLO da Grande SP (39 municipios da RMSP, com folga). Resultado de
// geocodificacao fora dele = "nao encontrado" (ex.: rua homonima em outro
// estado).
export const RETANGULO_GRANDE_SP: BoundingBox = { sul: -24.1, norte: -23.15, oeste: -47.25, leste: -45.65 };

export function dentroDaGrandeSP(p: GeoPonto): boolean {
  const r = RETANGULO_GRANDE_SP;
  return coordenadaValida(p) && p.lat >= r.sul && p.lat <= r.norte && p.lng >= r.oeste && p.lng <= r.leste;
}

// Viewbox da CIDADE de Sao Paulo para o Nominatim (oeste,norte,leste,sul) -
// so orienta (bounded=0), nao restringe.
export const VIEWBOX_CIDADE_SP = '-46.83,-23.35,-46.36,-24.01';
