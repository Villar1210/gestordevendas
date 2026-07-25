// src/modules/vendas_kanban/domain/services/remarketing-pipeline.ts
// Nome fixo do pipeline/stage de deposito da captura automatica de lead
// minimo (nome via pushName do WhatsApp + telefone) - ver
// CapturarLeadMinimoUseCase/GetOrCreateRemarketingPipelineUseCase. Pipeline
// SEPARADO do funil de vendas real (diferente da stage "Repique", que fica
// DENTRO do pipeline de vendas para leads ja qualificados mas sem perfil de
// renda) - aqui o contato ainda nao teve NENHUMA interacao de qualificacao,
// so mandou uma mensagem.
export const REMARKETING_PIPELINE_NOME = 'Leads Nao Qualificados';
export const REMARKETING_STAGE_NOME = 'Aguardando Reengajamento';

// Restricao de visibilidade deste pipeline especifico (decisao do usuario,
// tomada antes da implementacao original desta fatia): so Administrador ou
// quem tem cargo hierarquico "coordenador" podem ver/acessar o funil de
// remarketing - um Corretor comum nao deve ver esses leads brutos ainda nao
// reengajados. Reaproveita o mesmo vocabulario de papel/cargo ja usado por
// resolveEscopo (shared/domain/services/cargo-escopo.ts), mas e uma
// checagem BINARIA e especifica deste pipeline - nao os 4 escopos
// (todos/equipe/proprio/plantao) usados para filtrar CARDS por dono em
// outros lugares (GetBoardUseCase). "cargo" recebido cru (nao normalizado)
// porque o valor ja vem normalizado em minusculas do proprio cadastro (ver
// VALID_CARGOS_HIERARQUICOS no modulo rh).
export function podeAcessarPipelineRemarketing(role: string, cargo: string | null): boolean {
  return role === 'Administrador' || cargo === 'coordenador';
}
