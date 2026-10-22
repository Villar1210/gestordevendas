// Integracao da Viabilidade (BII Fatia 4) com /bii/viabilidade (so Administrador).
import { apiRequest, ApiError } from "@/core/api/client";
import type { ParametrosVigentes, ViabilidadeInput, ViabilidadeResposta } from "../types-viabilidade";

export function mensagemErroViabilidade(err: unknown): string {
  if (!(err instanceof ApiError)) return "Não foi possível calcular agora. Verifique sua conexão e tente de novo.";
  if (err.status === 429) return "Muitos cálculos em pouco tempo. Aguarde um minuto e tente de novo.";
  if (err.status === 400 || err.status === 403) return err.message;
  return "Não foi possível calcular agora. Tente de novo em instantes.";
}

export function carregarParametros(): Promise<ParametrosVigentes> {
  return apiRequest<ParametrosVigentes>("/bii/viabilidade/parametros");
}

export function calcularViabilidade(input: ViabilidadeInput): Promise<ViabilidadeResposta> {
  return apiRequest<ViabilidadeResposta>("/bii/viabilidade", { method: "POST", body: JSON.stringify(input) });
}
