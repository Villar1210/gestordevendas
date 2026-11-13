// src/features/campanhas/api.ts
// Chamadas da tela de campanhas por SMS (/campanhas-sms, so Administrador).
import { apiRequest, ApiError } from "@/core/api/client";
import { apiBlob } from "@/core/api/blob";
import type {
  Campanha,
  CampanhaDetalhe,
  DadosCampanha,
  FiltroExportacao,
  PaginaContatos,
  ResultadoImportacao,
  StatusContato,
} from "./types";

const BASE = "/campanhas-sms";

export const listarCampanhas = () => apiRequest<Campanha[]>(BASE);
export const obterCampanha = (id: string) => apiRequest<CampanhaDetalhe>(`${BASE}/${id}`);

export const criarCampanha = (dados: DadosCampanha) =>
  apiRequest<Campanha>(BASE, { method: "POST", body: JSON.stringify(dados) });

export const atualizarCampanha = (id: string, dados: Partial<DadosCampanha>) =>
  apiRequest<Campanha>(`${BASE}/${id}`, { method: "PATCH", body: JSON.stringify(dados) });

export function importarContatos(id: string, arquivo: File, substituir: boolean) {
  const form = new FormData();
  form.append("file", arquivo);
  if (substituir) form.append("substituir", "true");
  return apiRequest<ResultadoImportacao>(`${BASE}/${id}/contatos/importar`, { method: "POST", body: form });
}

export function listarContatos(id: string, filtro: { status?: StatusContato; busca?: string; pagina?: number }) {
  const q = new URLSearchParams();
  if (filtro.status) q.set("status", filtro.status);
  if (filtro.busca?.trim()) q.set("busca", filtro.busca.trim());
  if (filtro.pagina && filtro.pagina > 1) q.set("pagina", String(filtro.pagina));
  const qs = q.toString();
  return apiRequest<PaginaContatos>(`${BASE}/${id}/contatos${qs ? `?${qs}` : ""}`);
}

export const enviarTeste = (id: string, telefone: string) =>
  apiRequest<{ enviado: boolean; simulado: boolean; texto: string }>(`${BASE}/${id}/teste`, {
    method: "POST",
    body: JSON.stringify({ telefone }),
  });

export const iniciarCampanha = (id: string) =>
  apiRequest<{ status: string; pendentes: number; simulado: boolean }>(`${BASE}/${id}/iniciar`, { method: "POST" });
export const pausarCampanha = (id: string) => apiRequest(`${BASE}/${id}/pausar`, { method: "POST" });
export const cancelarCampanha = (id: string) => apiRequest(`${BASE}/${id}/cancelar`, { method: "POST" });

export async function baixarCsv(id: string, filtro: FiltroExportacao): Promise<void> {
  const { blob, filename } = await apiBlob(`${BASE}/${id}/contatos.csv?filtro=${filtro}`, {}, `contatos_${filtro}.csv`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function mensagemErro(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return "Não foi possível falar com o servidor. Tente de novo.";
}
