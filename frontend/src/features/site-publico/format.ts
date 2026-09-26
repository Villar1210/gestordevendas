// src/features/site-publico/format.ts
const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export function formatarPreco(valor: number | null | undefined): string | null {
  return valor ? moeda.format(valor) : null;
}

// Fotos sao servidas pelo backend em /uploads, atras do prefixo /api do
// nginx (vale tanto no dominio da plataforma quanto no dominio da empresa).
export function urlFoto(caminho: string | null | undefined): string | null {
  if (!caminho) return null;
  if (/^https?:\/\//.test(caminho)) return caminho;
  return `/api${caminho.startsWith("/") ? "" : "/"}${caminho}`;
}

export const TIPOS: Record<string, string> = {
  apartamento: "Apartamento",
  casa: "Casa",
  comercial: "Comercial",
  terreno: "Terreno",
  outro: "Outro",
};

export const STATUS_OBRA: Record<string, string> = {
  lancamento: "Lançamento",
  em_obras: "Em obras",
  pronto: "Pronto para morar",
};

export function localizacao(bairro?: string | null, cidade?: string | null, uf?: string | null) {
  return [bairro, [cidade, uf].filter(Boolean).join("/")].filter(Boolean).join(", ");
}

// 33,53 (padrao brasileiro, nao 33.53).
const numero = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
export function formatarArea(valor: number): string {
  return numero.format(valor);
}
