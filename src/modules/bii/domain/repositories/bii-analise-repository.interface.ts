// src/modules/bii/domain/repositories/bii-analise-repository.interface.ts
// BiiAnalise (POR TENANT): toda leitura por { id, tenantId } / { tenantId }.

export interface NovaBiiAnalise {
  tenantId: string;
  createdById: string;
  impersonadoPor: string | null;
  enderecoDigitado: string;
  enderecoFormatado: string;
  lat: number;
  lng: number;
  precisao: string;
  raioMetros: number;
  meses: number;
  areaMin: number | null;
  areaMax: number | null;
  transacoes: number;
  precoM2Mediano: number | null;
  resultado: Record<string, unknown>;
}

export interface BiiAnaliseResumo {
  id: string;
  enderecoDigitado: string;
  enderecoFormatado: string;
  raioMetros: number;
  meses: number;
  transacoes: number;
  precoM2Mediano: number | null;
  createdAt: Date;
}

export interface BiiAnaliseCompleta {
  id: string;
  resultado: Record<string, unknown>;
  createdAt: Date;
}

export interface IBiiAnaliseRepository {
  criar(dados: NovaBiiAnalise): Promise<{ id: string; createdAt: Date }>;
  listarPorTenant(tenantId: string, limite: number): Promise<BiiAnaliseResumo[]>;
  buscarPorIdETenant(id: string, tenantId: string): Promise<BiiAnaliseCompleta | null>;
}

export const BII_ANALISE_REPOSITORY = 'IBiiAnaliseRepository';
