// src/features/atendimento/constants.ts
// Espelha os valores aceitos pelo backend (Atendimento.status,
// AtendimentoEvento.tipo).

export interface StatusOption {
  value: string;
  label: string;
  badgeClassName: string;
}

export const STATUS_OPTIONS: StatusOption[] = [
  { value: "aguardando", label: "Aguardando", badgeClassName: "bg-slate-100 text-slate-700" },
  {
    value: "em_atendimento",
    label: "Em Atendimento",
    badgeClassName: "bg-blue-100 text-blue-700",
  },
  { value: "fechado", label: "Fechado", badgeClassName: "bg-green-100 text-green-700" },
];

export function getStatusOption(status: string): StatusOption {
  return STATUS_OPTIONS.find((option) => option.value === status) ?? STATUS_OPTIONS[0];
}

// Espelha src/modules/atendimento/domain/services/motivo-fechamento.ts
// (MOTIVOS_FECHAMENTO) - projetos separados, sem compartilhamento de codigo
// (mesmo padrao ja usado por MOTIVO_REPIQUE_OPTIONS no Kanban). "Abandono"
// (deteccao automatica por timeout) fica de fora de proposito - e o escopo
// do I8b, ainda nao implementado.
export const MOTIVO_FECHAMENTO_OPTIONS: { value: string; label: string }[] = [
  { value: "venda_concluida", label: "Venda concluida" },
  { value: "desistencia", label: "Desistencia" },
  { value: "finalizacao_normal", label: "Finalizacao normal" },
];

export const EVENTO_TIPO_LABELS: Record<string, string> = {
  criado: "Criado",
  classificado: "Classificado",
  atribuido: "Assumiu o atendimento",
  transferido: "Transferido",
  devolvido: "Devolvido para a fila",
  fechado: "Fechado",
  nota: "Nota",
};

// As 3 abas de status da Central de Atendimento (lista de atendimentos).
// Independente do filtro de fila, que e um controle separado (dropdown).
export type AtendimentoTab = "atendendo" | "aguardando" | "todos";

export const ATENDIMENTO_TABS: { id: AtendimentoTab; label: string }[] = [
  { id: "atendendo", label: "Atendendo" },
  { id: "aguardando", label: "Aguardando" },
  { id: "todos", label: "Todos" },
];

// Fila nao tem campo de cor no schema (decisao desta fatia: sem alterar o
// Prisma) - a cor do card/chip e derivada de um hash deterministico do
// nome, para toda fila com o mesmo nome sempre cair na mesma cor.
const FILA_COLORS = [
  "#57adf8",
  "#10b981",
  "#f59e0b",
  "#f43f5e",
  "#8b5cf6",
  "#06b6d4",
  "#eab308",
];

export function colorForFilaNome(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = nome.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FILA_COLORS[Math.abs(hash) % FILA_COLORS.length];
}

// Estilo do chip de fila (ChatRow, header do ChatView): fundo translucido
// (hex + alpha) na mesma cor do texto, mesmo truque usado no wacalls-chat
// estudado como referencia (tagChipStyle).
export function filaChipStyle(nome: string): { backgroundColor: string; color: string } {
  const color = colorForFilaNome(nome);
  return { backgroundColor: `${color}22`, color };
}
