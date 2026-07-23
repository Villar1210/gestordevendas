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

// Cadastro em Lote de Unidades (Fatia 2b) - espelha ENQUADRAMENTO_VALUES em
// criar-imoveis-lote.dto.ts do backend.
export const ENQUADRAMENTO_OPTIONS = [
  { value: "nenhum", label: "Nenhum" },
  { value: "his2", label: "HIS2" },
  { value: "hmp", label: "HMP" },
  { value: "r2v", label: "R2V" },
];

export function getEnquadramentoLabel(enquadramento: string): string {
  return (
    ENQUADRAMENTO_OPTIONS.find((option) => option.value === enquadramento)?.label ?? enquadramento
  );
}

export function getTipoLabel(tipo: string): string {
  return TIPO_OPTIONS.find((option) => option.value === tipo)?.label ?? tipo;
}

export function getFinalidadeLabel(finalidade: string): string {
  return FINALIDADE_OPTIONS.find((option) => option.value === finalidade)?.label ?? finalidade;
}

export const TIPO_LANCAMENTO_OPTIONS = [
  { value: "receita", label: "Receita (a receber)" },
  { value: "repasse", label: "Repasse (a pagar)" },
];

export const CATEGORIA_LANCAMENTO_OPTIONS = [
  { value: "aluguel", label: "Aluguel" },
  { value: "venda", label: "Venda" },
  { value: "taxa_administracao", label: "Taxa de Administracao" },
  { value: "manutencao", label: "Manutencao" },
  { value: "outro", label: "Outro" },
];

export interface LancamentoStatusOption {
  value: string;
  label: string;
  badgeClassName: string;
}

export const STATUS_LANCAMENTO_OPTIONS: LancamentoStatusOption[] = [
  { value: "pendente", label: "Pendente", badgeClassName: "bg-slate-100 text-slate-700" },
  { value: "pago", label: "Pago", badgeClassName: "bg-green-100 text-green-700" },
  { value: "atrasado", label: "Atrasado", badgeClassName: "bg-red-100 text-red-700" },
];

export function getTipoLancamentoLabel(tipo: string): string {
  return TIPO_LANCAMENTO_OPTIONS.find((option) => option.value === tipo)?.label ?? tipo;
}

export function getCategoriaLancamentoLabel(categoria: string): string {
  return (
    CATEGORIA_LANCAMENTO_OPTIONS.find((option) => option.value === categoria)?.label ?? categoria
  );
}

export function getStatusLancamentoOption(status: string): LancamentoStatusOption {
  return STATUS_LANCAMENTO_OPTIONS.find((option) => option.value === status) ?? STATUS_LANCAMENTO_OPTIONS[0];
}

export interface StatusAnaliseCreditoOption {
  value: string;
  label: string;
  badgeClassName: string;
}

export const STATUS_ANALISE_CREDITO_OPTIONS: StatusAnaliseCreditoOption[] = [
  { value: "nao_iniciada", label: "Nao Iniciada", badgeClassName: "bg-slate-100 text-slate-700" },
  { value: "em_analise", label: "Em Analise", badgeClassName: "bg-amber-100 text-amber-700" },
  { value: "aprovado", label: "Aprovado", badgeClassName: "bg-green-100 text-green-700" },
  { value: "reprovado", label: "Reprovado", badgeClassName: "bg-red-100 text-red-700" },
];

export function getStatusAnaliseCreditoOption(status: string): StatusAnaliseCreditoOption {
  return (
    STATUS_ANALISE_CREDITO_OPTIONS.find((option) => option.value === status) ??
    STATUS_ANALISE_CREDITO_OPTIONS[0]
  );
}

export const TIPO_DOCUMENTO_OPTIONS = [
  { value: "rg_cpf", label: "RG/CPF" },
  { value: "comprovante_renda", label: "Comprovante de Renda" },
  { value: "comprovante_residencia", label: "Comprovante de Residencia" },
  { value: "outro", label: "Outro" },
];

export function getTipoDocumentoLabel(tipo: string): string {
  return TIPO_DOCUMENTO_OPTIONS.find((option) => option.value === tipo)?.label ?? tipo;
}

// Empreendimento.origemImportacao (Fatia 4, tela de Revisao e Publicacao) -
// espelha os valores gravados pelo backend: "planilha" (CriarImoveisLoteUseCase,
// Fatia 3a), "ia_pdf" (ConfirmarFichaTecnicaUseCase, Fatia 3c) ou null
// (cadastro manual - nunca escreve nesse campo).
export const ORIGEM_IMPORTACAO_LABELS: Record<string, string> = {
  planilha: "Importado via planilha",
  ia_pdf: "Importado via IA (PDF)",
};

export function getOrigemImportacaoLabel(origemImportacao: string | null): string {
  if (!origemImportacao) return "Cadastro manual";
  return ORIGEM_IMPORTACAO_LABELS[origemImportacao] ?? origemImportacao;
}

// EmpreendimentoPhoto.categoria (Fatia 5) - espelha
// EMPREENDIMENTO_PHOTO_CATEGORIAS do backend (empreendimento-repository.interface.ts).
export const EMPREENDIMENTO_PHOTO_CATEGORIA_OPTIONS = [
  { value: "planta", label: "Planta do Empreendimento" },
  { value: "area_comum", label: "Area Comum" },
];

export function getEmpreendimentoPhotoCategoriaLabel(categoria: string): string {
  return (
    EMPREENDIMENTO_PHOTO_CATEGORIA_OPTIONS.find((option) => option.value === categoria)?.label ??
    categoria
  );
}
