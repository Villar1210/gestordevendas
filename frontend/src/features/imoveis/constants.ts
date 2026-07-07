// src/features/imoveis/constants.ts
// Espelha os valores aceitos pelo backend (create-imovel.dto.ts). Mantidos
// aqui em vez de importados porque frontend e backend sao projetos
// separados (sem compartilhamento de tipos entre si).

export const TIPO_OPTIONS = [
  { value: "apartamento", label: "Apartamento" },
  { value: "casa", label: "Casa" },
  { value: "comercial", label: "Comercial" },
  { value: "terreno", label: "Terreno" },
  { value: "outro", label: "Outro" },
];

export const FINALIDADE_OPTIONS = [
  { value: "venda", label: "Venda" },
  { value: "aluguel", label: "Aluguel" },
  { value: "ambos", label: "Venda e Aluguel" },
];

export const USO_OPTIONS = [
  { value: "residencial", label: "Residencial" },
  { value: "comercial", label: "Comercial" },
];

export const LOCAL_CHAVES_OPTIONS = [
  { value: "imobiliaria", label: "Imobiliaria" },
  { value: "proprietario", label: "Proprietario" },
  { value: "outro", label: "Outro" },
];

export interface StatusOption {
  value: string;
  label: string;
  // Selo (Catalogo): fundo claro + texto escuro, sempre com o label ao lado.
  badgeClassName: string;
  // Espelho de Vendas: quadrado solido + texto branco.
  solidClassName: string;
}

// Ordem fixa (nao ciclica) - cada status sempre usa a mesma cor, em
// qualquer lugar do app (selo, legenda, grid do Espelho de Vendas).
export const STATUS_OPTIONS: StatusOption[] = [
  {
    value: "disponivel",
    label: "Disponivel",
    badgeClassName: "bg-green-100 text-green-700",
    solidClassName: "bg-green-600",
  },
  {
    value: "reservado",
    label: "Reservado",
    badgeClassName: "bg-amber-100 text-amber-700",
    solidClassName: "bg-amber-600",
  },
  {
    value: "em_negociacao",
    label: "Em Negociacao",
    badgeClassName: "bg-blue-100 text-blue-700",
    solidClassName: "bg-blue-600",
  },
  {
    value: "vendido",
    label: "Vendido",
    badgeClassName: "bg-teal-100 text-teal-700",
    solidClassName: "bg-teal-600",
  },
  {
    value: "bloqueado",
    label: "Bloqueado",
    badgeClassName: "bg-red-100 text-red-700",
    solidClassName: "bg-red-600",
  },
  {
    value: "em_analise",
    label: "Em Analise",
    badgeClassName: "bg-purple-100 text-purple-700",
    solidClassName: "bg-purple-600",
  },
  {
    value: "distrato",
    label: "Distrato",
    badgeClassName: "bg-rose-100 text-rose-700",
    solidClassName: "bg-rose-600",
  },
  {
    value: "ocupado",
    label: "Ocupado",
    badgeClassName: "bg-orange-100 text-orange-700",
    solidClassName: "bg-orange-600",
  },
  {
    value: "vago",
    label: "Vago",
    badgeClassName: "bg-sky-100 text-sky-700",
    solidClassName: "bg-sky-600",
  },
  {
    value: "inativo",
    label: "Inativo",
    badgeClassName: "bg-slate-100 text-slate-700",
    solidClassName: "bg-slate-500",
  },
];

export function getStatusOption(status: string): StatusOption {
  return STATUS_OPTIONS.find((option) => option.value === status) ?? STATUS_OPTIONS[0];
}

export function getTipoLabel(tipo: string): string {
  return TIPO_OPTIONS.find((option) => option.value === tipo)?.label ?? tipo;
}

export function getFinalidadeLabel(finalidade: string): string {
  return FINALIDADE_OPTIONS.find((option) => option.value === finalidade)?.label ?? finalidade;
}
