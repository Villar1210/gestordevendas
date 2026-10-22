// src/modules/bii/domain/repositories/concorrente-repository.interface.ts
// BiiConcorrente (POR TENANT). Toda leitura por { tenantId } / { id, tenantId };
// escrita e remocao condicionais (updateMany/deleteMany where { id, tenantId })
// - devolvem false quando nada foi tocado (o use case vira 404).
// Tipologias sempre lidas/gravadas ATRAVES do concorrente.
import type { BoundingBox } from '../services/geo';
import type { FaseConcorrente, TipologiaEntrada } from '../services/concorrente';

export interface DadosConcorrente {
  nome: string;
  construtora: string | null;
  endereco: string;
  enderecoFormatado: string | null;
  lat: number;
  lng: number;
  precisao: string;
  fase: FaseConcorrente;
  dataLancamento: Date | null;
  totalUnidades: number | null;
  unidadesVendidas: number | null;
  fonte: string | null;
  fonteUrl: string | null;
  observacoes: string | null;
  tipologias: TipologiaEntrada[];
}

export interface ConcorrenteRegistro extends DadosConcorrente {
  id: string;
  origem: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConcorrenteRepository {
  listarPorTenant(tenantId: string, limite: number): Promise<ConcorrenteRegistro[]>;
  buscarPorIdETenant(id: string, tenantId: string): Promise<ConcorrenteRegistro | null>;
  buscarNoBbox(tenantId: string, bbox: BoundingBox, limite: number): Promise<ConcorrenteRegistro[]>;
  contarPorTenant(tenantId: string): Promise<number>;
  criar(tenantId: string, userId: string, dados: DadosConcorrente): Promise<ConcorrenteRegistro>;
  // substitui as tipologias numa transacao; false = nao existe no tenant
  atualizar(id: string, tenantId: string, userId: string, dados: DadosConcorrente): Promise<boolean>;
  excluir(id: string, tenantId: string): Promise<boolean>;
}

export const CONCORRENTE_REPOSITORY = 'IConcorrenteRepository';
