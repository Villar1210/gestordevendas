// src/modules/vendas_kanban/domain/repositories/repique-campanha-envio-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface RepiqueCampanhaEnvioRecord {
  id: string;
  tenantId: string;
  cardId: string;
  canal: string;
  enviadoEm: Date;
  motivoRepiqueNoEnvio: string | null;
  sucesso: boolean;
  erroMensagem: string | null;
}

export interface IRepiqueCampanhaEnvioRepository {
  create(input: {
    tenantId: string;
    cardId: string;
    canal: string;
    motivoRepiqueNoEnvio?: string | null;
    sucesso: boolean;
    erroMensagem?: string | null;
  }): Promise<RepiqueCampanhaEnvioRecord>;
  // Usado pelo job (ProcessarCampanhaRepiqueUseCase) para decidir o
  // proximo canal (alterna a partir deste) e se ja passou o intervalo
  // minimo de 2 dias - null significa que este card ainda nao recebeu
  // nenhuma campanha (proximo envio = primeiro, canal inicial EMAIL).
  findUltimoPorCard(cardId: string): Promise<RepiqueCampanhaEnvioRecord | null>;
}
