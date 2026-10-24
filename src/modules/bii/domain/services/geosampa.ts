// src/modules/bii/domain/services/geosampa.ts
// Regras PURAS da Fatia 6 (localizacao do ITBI pelo SQL do IPTU com as
// camadas publicas do GeoSampa). Sem Nest/Prisma/rede.
// Contrato: docs/bii/fatia6/CONTRATO_LOCALIZACAO_SQL.md.

export type Posicao = [number, number]; // [lng, lat] (GeoJSON, WGS84)
export type Anel = Posicao[];
export type GeometriaPoligonal =
  | { type: 'Polygon'; coordinates: Anel[] }
  | { type: 'MultiPolygon'; coordinates: Anel[][] };

export interface CentroideArea {
  lat: number;
  lng: number;
  // area em graus^2 (so para ponderar entre partes da MESMA quadra)
  peso: number;
}

const numeroValido = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

// Centroide de UM anel pela formula da area assinada (shoelace). Anel com
// area ~0 (degenerado): media dos vertices.
function centroideAnel(anel: Anel): { cx: number; cy: number; a: number } | null {
  const pts = anel.filter((p) => Array.isArray(p) && numeroValido(p[0]) && numeroValido(p[1]));
  if (pts.length < 3) return null;
  // coordenadas relativas ao 1o vertice: com lng/lat absolutos (~46, ~23) o
  // produto cruzado perde precisao em poligonos pequenos (lotes de ~10 m)
  const [ox, oy] = pts[0];
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const x0 = pts[i][0] - ox;
    const y0 = pts[i][1] - oy;
    const x1 = pts[(i + 1) % pts.length][0] - ox;
    const y1 = pts[(i + 1) % pts.length][1] - oy;
    const f = x0 * y1 - x1 * y0;
    a += f;
    cx += (x0 + x1) * f;
    cy += (y0 + y1) * f;
  }
  a /= 2;
  if (Math.abs(a) < 1e-14) {
    const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
    const my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return { cx: mx, cy: my, a: 0 };
  }
  return { cx: cx / (6 * a) + ox, cy: cy / (6 * a) + oy, a };
}

// Centroide de Polygon/MultiPolygon: anel externo soma, buracos subtraem
// (pela area assinada com o sinal invertido em relacao ao externo).
export function centroideGeometria(g: unknown): CentroideArea | null {
  if (!g || typeof g !== 'object') return null;
  const geo = g as { type?: unknown; coordinates?: unknown };
  let poligonos: Anel[][];
  if (geo.type === 'Polygon' && Array.isArray(geo.coordinates)) poligonos = [geo.coordinates as Anel[]];
  else if (geo.type === 'MultiPolygon' && Array.isArray(geo.coordinates)) poligonos = geo.coordinates as Anel[][];
  else return null;
  let somaA = 0;
  let somaX = 0;
  let somaY = 0;
  let degenerados: Array<{ cx: number; cy: number }> = [];
  for (const poligono of poligonos) {
    if (!Array.isArray(poligono)) continue;
    poligono.forEach((anel, i) => {
      if (!Array.isArray(anel)) return;
      const c = centroideAnel(anel);
      if (!c) return;
      if (c.a === 0) {
        if (i === 0) degenerados.push(c);
        return;
      }
      // externo positivo; buraco com sinal oposto ao externo
      const area = i === 0 ? Math.abs(c.a) : -Math.abs(c.a);
      somaA += area;
      somaX += c.cx * area;
      somaY += c.cy * area;
    });
  }
  if (somaA > 1e-14) {
    const lng = somaX / somaA;
    const lat = somaY / somaA;
    return coordenadaPlausivel(lat, lng) ? { lat, lng, peso: somaA } : null;
  }
  if (degenerados.length) {
    const lng = degenerados.reduce((s, d) => s + d.cx, 0) / degenerados.length;
    const lat = degenerados.reduce((s, d) => s + d.cy, 0) / degenerados.length;
    degenerados = [];
    return coordenadaPlausivel(lat, lng) ? { lat, lng, peso: 0 } : null;
  }
  return null;
}

// Retangulo da cidade de Sao Paulo (mesmo de geo.ts, com folga): ponto fora
// = geometria errada/CRS errado - descartado.
function coordenadaPlausivel(lat: number, lng: number): boolean {
  return lat >= -24.05 && lat <= -23.3 && lng >= -46.9 && lng <= -46.3;
}

// Combina partes da MESMA quadra (subquadras) ponderando pela area.
export function combinarCentroides(partes: CentroideArea[]): CentroideArea | null {
  const validas = partes.filter((p) => numeroValido(p.lat) && numeroValido(p.lng));
  if (!validas.length) return null;
  const peso = validas.reduce((s, p) => s + p.peso, 0);
  if (peso <= 0) {
    return {
      lat: validas.reduce((s, p) => s + p.lat, 0) / validas.length,
      lng: validas.reduce((s, p) => s + p.lng, 0) / validas.length,
      peso: 0,
    };
  }
  return {
    lat: validas.reduce((s, p) => s + p.lat * p.peso, 0) / peso,
    lng: validas.reduce((s, p) => s + p.lng * p.peso, 0) / peso,
    peso,
  };
}

const so = (v: unknown, tamanho: number): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  if (!/^\d+$/.test(s) || s.length > tamanho) return null;
  return s.padStart(tamanho, '0');
};

export interface QuadraParte {
  setor: string;
  quadra: string;
  centroide: CentroideArea;
}

export interface LoteFiscal {
  setor: string;
  quadra: string;
  lote: string;
  condominio: string;
  ativo: boolean;
  lat: number;
  lng: number;
}

interface FeatureGeoJson {
  properties?: Record<string, unknown> | null;
  geometry?: unknown;
}

// Feature da camada quadra_fiscal -> parte da quadra (so tipo F, situacao 1).
export function interpretarQuadra(f: FeatureGeoJson): QuadraParte | null {
  const p = f?.properties ?? {};
  if (String(p.cd_tipo_quadra ?? '').toUpperCase() !== 'F') return null;
  const setor = so(p.cd_setor_fiscal, 3);
  const quadra = so(p.cd_quadra_fiscal, 3);
  if (!setor || !quadra) return null;
  const centroide = centroideGeometria(f.geometry);
  if (!centroide) return null;
  return { setor, quadra, centroide };
}

// Feature da camada lote_cidadao -> lote fiscal (so tipo F).
export function interpretarLote(f: FeatureGeoJson): LoteFiscal | null {
  const p = f?.properties ?? {};
  if (String(p.cd_tipo_lote ?? '').toUpperCase() !== 'F') return null;
  const setor = so(p.cd_setor_fiscal, 3);
  const quadra = so(p.cd_quadra_fiscal, 3);
  const lote = so(p.cd_lote, 4);
  const condominio = so(p.cd_condominio ?? '00', 2) ?? '00';
  if (!setor || !quadra || !lote) return null;
  const c = centroideGeometria(f.geometry);
  if (!c) return null;
  const situacao = String(p.tx_situ_lote ?? '').toUpperCase();
  return { setor, quadra, lote, condominio, ativo: situacao !== 'CANCELADO', lat: c.lat, lng: c.lng };
}

// SQL do IPTU no ITBI: 11 digitos (setor 3, quadra 3, lote 4, digito 1).
// Aceita pontuacao (000.000.0000-0); qualquer outro formato = null.
export function decomporSql(sql: string | null | undefined): { setor: string; quadra: string; lote: string } | null {
  if (!sql) return null;
  const d = String(sql).replace(/[.\-\s]/g, '');
  if (!/^\d{11}$/.test(d)) return null;
  const setor = d.slice(0, 3);
  const quadra = d.slice(3, 6);
  if (setor === '000' || quadra === '000') return null;
  return { setor, quadra, lote: d.slice(6, 10) };
}

// Ordem de confianca das coordenadas de uma guia (maior = melhor). So se
// sobrescreve com uma precisao MELHOR.
export const RANK_PRECISAO: Record<string, number> = {
  lote: 6,
  rooftop: 5,
  quadra: 4,
  rua: 3,
  cep: 2,
  bairro: 1,
};

// Precisoes que uma localizacao nova pode substituir.
export function precisoesPiores(nova: 'lote' | 'quadra'): string[] {
  const r = RANK_PRECISAO[nova];
  return Object.keys(RANK_PRECISAO).filter((k) => RANK_PRECISAO[k] < r);
}

export const ATRIBUICAO_GEOSAMPA = 'Localização das guias: GeoSampa — Prefeitura de São Paulo (CC BY-SA 4.0)';
