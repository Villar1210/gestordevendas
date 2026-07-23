// src/modules/gestao_imobiliaria/domain/repositories/tipologia-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface TipologiaRecord {
  id: string;
  tenantId: string;
  empreendimentoId: string;
  nome: string;
  areaPrivativa: number | null;
  dormitorios: number | null;
}

export interface TipologiaInput {
  nome: string;
  areaPrivativa: number | null;
  dormitorios: number | null;
}

export interface ITipologiaRepository {
  findAllByEmpreendimento(tenantId: string, empreendimentoId: string): Promise<TipologiaRecord[]>;
  // Substitui a lista inteira de tipologias do empreendimento (delete + create
  // do zero) - mesma decisao ja tomada em UpdateEnvelopeDraftUseCase (edoc)
  // para participantes/campos: mais simples e seguro do que tentar "diffar"
  // contra o estado anterior, e a ficha tecnica so e confirmada uma vez por
  // importacao de PDF.
  replaceAllForEmpreendimento(
    tenantId: string,
    empreendimentoId: string,
    tipologias: TipologiaInput[],
  ): Promise<TipologiaRecord[]>;
}
