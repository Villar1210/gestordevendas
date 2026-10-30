// src/modules/gestao_imobiliaria/domain/repositories/construtora-repository.interface.ts
// Camada de DOMINIO: contrato do cadastro de Construtoras, sem Prisma.
// Toda leitura/escrita e por { id, tenantId } (isolamento multitenant).

export interface ConstrutoraRecord {
  id: string;
  tenantId: string;
  nome: string;
  nomeNormalizado: string;
  site: string | null;
  sobre: string | null;
  diferenciais: string | null;
  logoUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
  // So na listagem e no detalhe: quantos empreendimentos usam esta construtora.
  quantidadeEmpreendimentos?: number;
}

export interface CriarConstrutoraDados {
  tenantId: string;
  nome: string;
  nomeNormalizado: string;
  site?: string | null;
  sobre?: string | null;
  diferenciais?: string | null;
}

export interface AtualizarConstrutoraDados {
  nome?: string;
  nomeNormalizado?: string;
  site?: string | null;
  sobre?: string | null;
  diferenciais?: string | null;
  logoUrl?: string | null;
}

export interface IConstrutoraRepository {
  // Nome normalizado repetido no tenant -> UniqueConstraintViolationError.
  create(dados: CriarConstrutoraDados): Promise<ConstrutoraRecord>;
  findByIdAndTenant(id: string, tenantId: string): Promise<ConstrutoraRecord | null>;
  findByNomeNormalizado(tenantId: string, nomeNormalizado: string): Promise<ConstrutoraRecord | null>;
  // Ordenada por nome, com quantidadeEmpreendimentos.
  findAllByTenant(tenantId: string): Promise<ConstrutoraRecord[]>;
  // updateMany condicional { id, tenantId }; null = nao existe neste tenant.
  // Mudou o nome: o texto Empreendimento.construtora dos vinculados passa a
  // ser o nome novo, na MESMA transacao (texto e cadastro ficam iguais).
  // Nome normalizado repetido -> UniqueConstraintViolationError.
  update(id: string, tenantId: string, dados: AtualizarConstrutoraDados): Promise<ConstrutoraRecord | null>;
  countEmpreendimentos(id: string, tenantId: string): Promise<number>;
  // Exclui SO se nenhum empreendimento estiver vinculado (conferido dentro
  // da transacao). Devolve quantos empreendimentos impediram (0 = excluida)
  // ou null quando a construtora nao existe neste tenant.
  deleteSemVinculo(id: string, tenantId: string): Promise<{ vinculados: number } | null>;
}
