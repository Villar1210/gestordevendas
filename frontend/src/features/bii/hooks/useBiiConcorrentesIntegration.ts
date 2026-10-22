// Integracao dos Concorrentes (BII Fatia 3) com /bii/concorrentes (so
// Administrador). Erros com `code` estavel (BII_SOMENTE_LEITURA) sao lidos
// pelo code, nunca pelo texto.
import { apiRequest, ApiError } from "@/core/api/client";
import type { Concorrente, ConcorrenteInput } from "../types-concorrentes";
import { ehSomenteLeitura } from "./useBiiAnaliseIntegration";

const ERRO_GENERICO = "Não foi possível concluir agora. Verifique sua conexão e tente de novo.";

export function mensagemErroConcorrente(err: unknown): string {
  if (!(err instanceof ApiError)) return ERRO_GENERICO;
  if (ehSomenteLeitura(err)) return err.message;
  if (err.status === 429) return "Muitas alterações em pouco tempo. Aguarde um minuto e tente de novo.";
  if (err.status === 503) return "O serviço de mapas está ocupado no momento. Tente de novo em alguns instantes.";
  if (err.status === 404) return "Concorrente não encontrado. Ele pode ter sido excluído.";
  if ([400, 403, 409, 422].includes(err.status)) return err.message;
  return ERRO_GENERICO;
}

export { ehSomenteLeitura };

export function listarConcorrentes(): Promise<Concorrente[]> {
  return apiRequest<Concorrente[]>("/bii/concorrentes");
}

export function criarConcorrente(input: ConcorrenteInput): Promise<Concorrente> {
  return apiRequest<Concorrente>("/bii/concorrentes", { method: "POST", body: JSON.stringify(input) });
}

export function atualizarConcorrente(id: string, input: ConcorrenteInput): Promise<Concorrente> {
  return apiRequest<Concorrente>(`/bii/concorrentes/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export async function excluirConcorrente(id: string): Promise<void> {
  await apiRequest(`/bii/concorrentes/${encodeURIComponent(id)}`, { method: "DELETE" });
}
