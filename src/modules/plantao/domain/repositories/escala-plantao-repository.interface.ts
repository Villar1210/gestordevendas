// src/modules/plantao/domain/repositories/escala-plantao-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.
export interface EscalaPlantaoRecord {
  id: string;
  tenantId: string;
  standId: string;
  userId: string;
  diaSemana: number;
}

export interface EscalaPlantaoWithUserName extends EscalaPlantaoRecord {
  userName: string;
}

export interface IEscalaPlantaoRepository {
  findByStandUserDia(standId: string, userId: string, diaSemana: number): Promise<EscalaPlantaoRecord | null>;
  create(input: { tenantId: string; standId: string; userId: string; diaSemana: number }): Promise<EscalaPlantaoRecord>;
  delete(id: string): Promise<void>;
  findByIdAndTenant(id: string, tenantId: string): Promise<EscalaPlantaoRecord | null>;
  // Grade semanal completa de um stand (7 dias), usada pela tela de
  // gestao no Painel Administrativo.
  findAllByStand(standId: string): Promise<EscalaPlantaoWithUserName[]>;
  // Quem esta escalado num stand num dia especifico (0=domingo...6=sabado)
  // - usado pelo escopo 'plantao' do RBAC (GetCorretoresEscaladosHojeUseCase)
  // para restringir a visibilidade do Coordenador aos corretores escalados
  // HOJE no stand dele.
  findAllByStandAndDia(standId: string, diaSemana: number): Promise<{ userId: string }[]>;
}
