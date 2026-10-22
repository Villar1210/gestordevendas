// Integracao do Estudo de terreno (BII Fatia 5) com /bii/estudos (so
// Administrador). Erros com `code` estavel (BII_SOMENTE_LEITURA) decididos
// pelo code, nunca pelo texto.
import { apiRequest, ApiError } from "@/core/api/client";
import type { CriarEstudoInput, Estudo, EstudoListaItem } from "../types-estudo";
import { ehSomenteLeitura } from "./useBiiAnaliseIntegration";

export function mensagemErroEstudo(err: unknown): string {
  if (!(err instanceof ApiError)) return "Não foi possível concluir agora. Verifique sua conexão e tente de novo.";
  if (ehSomenteLeitura(err)) return err.message;
  if (err.status === 429) return "Muitas alterações em pouco tempo. Aguarde um minuto e tente de novo.";
  if (err.status === 404) return "Estudo ou análise não encontrado. Pode ter sido excluído ou ser de outra conta.";
  if (err.status === 400 || err.status === 403 || err.status === 409) return err.message;
  return "Não foi possível concluir agora. Tente de novo em instantes.";
}

export function listarEstudos(): Promise<EstudoListaItem[]> {
  return apiRequest<EstudoListaItem[]>("/bii/estudos");
}

export function carregarEstudo(id: string): Promise<Estudo> {
  return apiRequest<Estudo>(`/bii/estudos/${encodeURIComponent(id)}`);
}

export function criarEstudo(input: CriarEstudoInput): Promise<Estudo> {
  return apiRequest<Estudo>("/bii/estudos", { method: "POST", body: JSON.stringify(input) });
}

export function atualizarEstudo(id: string, dados: { nome?: string; conclusao?: string | null }): Promise<Estudo> {
  return apiRequest<Estudo>(`/bii/estudos/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(dados) });
}

export function excluirEstudo(id: string): Promise<void> {
  return apiRequest<void>(`/bii/estudos/${encodeURIComponent(id)}`, { method: "DELETE" });
}
