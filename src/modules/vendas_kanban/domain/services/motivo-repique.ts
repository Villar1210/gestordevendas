// src/modules/vendas_kanban/domain/services/motivo-repique.ts
// Camada de DOMINIO: valores validos de Card.motivoRepique. SEM_PERFIL
// reaproveita o mesmo conceito ja usado pela VIVI (transferir_para_corretor
// motivo "sem_perfil" - ver vivi_sdr/domain/services/classificar-renda.ts),
// so em maiusculas para consistencia com os demais valores deste enum -
// NAO ha wiring automatico hoje entre os dois (o campo so e preenchido
// pelo modal manual do Kanban ou pelo job de inatividade, ver
// MoverLeadsInativosParaRepiqueUseCase).
export const MOTIVOS_REPIQUE = [
  'SEM_RESPOSTA_90_DIAS',
  'RESTRICAO_CPF',
  'PRECO',
  'SEM_PERFIL',
  'OUTRO',
] as const;

export type MotivoRepique = (typeof MOTIVOS_REPIQUE)[number];

export function isMotivoRepiqueValido(valor: string): valor is MotivoRepique {
  return (MOTIVOS_REPIQUE as readonly string[]).includes(valor);
}
