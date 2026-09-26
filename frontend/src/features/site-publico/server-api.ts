// src/features/site-publico/server-api.ts
// Leituras da vitrine feitas NO SERVIDOR do Next (melhor para Google/SEO e
// para o link compartilhado no WhatsApp mostrar titulo e foto).
// Chama o backend direto pela rede interna (API_INTERNAL_URL) e repassa o
// IP real do visitante - sem isso, o limite de requisicoes por IP da API
// seria dividido entre TODOS os visitantes do site.
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import type {
  EmpreendimentoDetalhe,
  EmpreendimentoResumo,
  ImovelDetalhe,
  ImovelResumo,
  Paginado,
  SiteInfo,
} from "./types";

export const CABECALHO_DOMINIO_PROPRIO = "x-vitrine-dominio-proprio";

const API_INTERNAL_URL = process.env.API_INTERNAL_URL || "http://127.0.0.1:3333";

async function getJson<T>(path: string): Promise<T | null> {
  const h = await headers();
  // So X-Real-IP (o nginx sobrescreve com $remote_addr). O X-Forwarded-For
  // tem entradas escritas pelo proprio visitante - aceitar isso deixaria
  // qualquer um "trocar de IP" e furar o limite de requisicoes.
  const ipVisitante = h.get("x-real-ip")?.trim() || undefined;
  const res = await fetch(`${API_INTERNAL_URL}${path}`, {
    headers: ipVisitante ? { "X-Forwarded-For": ipVisitante } : undefined,
    // Dados mudam quando o corretor edita um imovel - cache curto.
    next: { revalidate: 60 },
  });
  // 404: nao existe / nao publicado. 400: id malformado vindo da URL.
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`Falha ao consultar ${path}: ${res.status}`);
  return (await res.json()) as T;
}

// O segmento [site] da rota e o slug (ex: "direcional", pre-visualizacao em
// gestordevendas.ivillar.com.br/site/direcional) ou o dominio proprio
// (ex: "direcional.ivillar.com.br", reescrito pelo middleware).
export async function resolverSite(site: string): Promise<SiteInfo & { base: string }> {
  let decodificado: string;
  try {
    decodificado = decodeURIComponent(site).toLowerCase();
  } catch {
    notFound();
  }
  if (decodificado.includes(".")) {
    const info = await getJson<SiteInfo>(
      `/public/site/resolver?host=${encodeURIComponent(decodificado)}`,
    );
    if (!info) notFound();
    // Links sem prefixo so quando a pagina foi aberta PELO dominio da
    // empresa (marcado pelo middleware). Aberta como
    // gestordevendas.../site/<dominio>, os links continuam em /site/<slug>.
    const h = await headers();
    return { ...info, base: h.get(CABECALHO_DOMINIO_PROPRIO) === "1" ? "" : `/site/${info.slug}` };
  }
  const info = await getJson<SiteInfo>(`/public/site/${encodeURIComponent(decodificado)}`);
  if (!info) notFound();
  return { ...info, base: `/site/${info.slug}` };
}

// Listas sao "complementares": se a API estiver sobrecarregada (429/5xx),
// a pagina abre com a lista vazia em vez de virar tela de erro.
async function tolerante<T>(promessa: Promise<T | null>, vazio: T, oQue: string): Promise<T> {
  try {
    return (await promessa) ?? vazio;
  } catch (err) {
    console.error(`[vitrine] ${oQue}:`, err instanceof Error ? err.message : err);
    return vazio;
  }
}

export async function listarImoveis(slug: string, query: URLSearchParams) {
  return tolerante(
    getJson<Paginado<ImovelResumo>>(`/public/site/${slug}/imoveis?${query.toString()}`),
    { itens: [], total: 0, page: 1, pageSize: 12 },
    "listar imoveis",
  );
}

export async function obterImovel(slug: string, id: string) {
  return getJson<ImovelDetalhe>(`/public/site/${slug}/imoveis/${encodeURIComponent(id)}`);
}

export async function listarEmpreendimentos(slug: string) {
  return tolerante(
    getJson<EmpreendimentoResumo[]>(`/public/site/${slug}/empreendimentos`),
    [] as EmpreendimentoResumo[],
    "listar empreendimentos",
  );
}

export async function obterEmpreendimento(slug: string, id: string) {
  return getJson<EmpreendimentoDetalhe>(
    `/public/site/${slug}/empreendimentos/${encodeURIComponent(id)}`,
  );
}
