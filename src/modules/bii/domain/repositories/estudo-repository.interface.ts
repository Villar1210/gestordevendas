// src/modules/bii/domain/repositories/estudo-repository.interface.ts
// BiiEstudo (POR TENANT): toda leitura por { id, tenantId } / { tenantId };
// escrita e remocao condicionais. Fatia 5.

export interface SituacaoResumo {
  ok: number;
  atencao: number;
  fora: number;
}

export interface NovoEstudo {
  tenantId: string;
  userId: string;
  analiseId: string;
  nome: string;
  enderecoFormatado: string;
  raioMetros: number;
  meses: number;
  tipologias: unknown[];
  premissas: Record<string, unknown>;
  conclusao: string | null;
  situacaoResumo: SituacaoResumo;
  resultado: Record<string, unknown>;
}

export interface EstudoResumo {
  id: string;
  nome: string;
  enderecoFormatado: string;
  raioMetros: number;
  meses: number;
  situacaoResumo: SituacaoResumo;
  createdAt: Date;
  updatedAt: Date;
}

export interface EstudoCompleto extends EstudoResumo {
  analiseId: string | null;
  conclusao: string | null;
  resultado: Record<string, unknown>;
}

export interface IEstudoRepository {
  criar(d: NovoEstudo): Promise<EstudoCompleto>;
  listarPorTenant(tenantId: string, limite: number): Promise<EstudoResumo[]>;
  buscarPorIdETenant(id: string, tenantId: string): Promise<EstudoCompleto | null>;
  contarPorTenant(tenantId: string): Promise<number>;
  // so nome e conclusao; false = nao existe no tenant
  atualizarTextos(id: string, tenantId: string, userId: string, d: { nome?: string; conclusao?: string | null }): Promise<boolean>;
  excluir(id: string, tenantId: string): Promise<boolean>;
}

export const ESTUDO_REPOSITORY = 'IEstudoRepository';
