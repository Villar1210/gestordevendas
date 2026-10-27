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

// Fase B (27/10/2026): o funil de VENDAS padrao do tenant = o mais antigo que
// NAO e o funil de remarketing. Usado por quem cria card "do sistema" (VIVI,
// WhatsApp sem VIVI, redes sociais) - antes alguns usavam pipelines[0] e,
// se o remarketing fosse o mais antigo, o lead caia no funil errado.
// `pipelines` deve vir ordenado do mais antigo para o mais novo
// (IPipelineRepository.findAllByTenant ja ordena por createdAt).
export function funilDeVendasPadrao<T extends { name: string }>(pipelines: T[]): T | undefined {
  return pipelines.find((p) => p.name !== REMARKETING_PIPELINE_NOME);
}
