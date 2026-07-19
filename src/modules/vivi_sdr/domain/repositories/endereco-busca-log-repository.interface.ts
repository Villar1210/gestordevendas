// src/modules/vivi_sdr/domain/repositories/endereco-busca-log-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface EnderecoBuscaLogRecord {
  id: string;
  tenantId: string;
  phoneNumber: string;
  enderecoBuscado: string;
  encontradoCatalogo: boolean;
  nomeEncontradoCatalogo: string | null;
  precisouBuscaExterna: boolean;
  confirmadoExternamente: boolean | null;
  nomeEncontradoExterno: string | null;
  escalonado: boolean;
  motivoEscalonamento: string | null;
  createdAt: Date;
}

export interface IEnderecoBuscaLogRepository {
  create(input: {
    tenantId: string;
    phoneNumber: string;
    enderecoBuscado: string;
    encontradoCatalogo: boolean;
    nomeEncontradoCatalogo?: string | null;
    precisouBuscaExterna: boolean;
    confirmadoExternamente?: boolean | null;
    nomeEncontradoExterno?: string | null;
    escalonado: boolean;
    motivoEscalonamento?: string | null;
  }): Promise<EnderecoBuscaLogRecord>;
}
