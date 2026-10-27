// Integracao da Viabilidade financeira (BII Fatia 7) com
// /bii/viabilidade-financeira (so Administrador, so calculo).
import { apiRequest } from "@/core/api/client";
import type { ParametrosFinanceiros, PremissasFinanceirasInput, ResultadoFinanceiro, TipologiaFinanceira } from "../types-financeiro";

export function carregarParametrosFinanceiros(): Promise<ParametrosFinanceiros> {
  return apiRequest<ParametrosFinanceiros>("/bii/viabilidade-financeira/parametros");
}

export function calcularFinanceiro(input: { tipologias: TipologiaFinanceira[]; premissas: PremissasFinanceirasInput }): Promise<ResultadoFinanceiro> {
  return apiRequest<ResultadoFinanceiro>("/bii/viabilidade-financeira", { method: "POST", body: JSON.stringify(input) });
}
