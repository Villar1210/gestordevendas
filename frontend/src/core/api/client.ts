// src/core/api/client.ts
export const TOKEN_STORAGE_KEY = "@gestordevendas:token";
// Espelha localmente o ultimo status de disponibilidade enviado ao backend
// (PATCH /rh/me/status), so para a Topbar nao "esquecer" a selecao entre
// reloads sem precisar de outra chamada a API so para ler o proprio status.
export const STATUS_DISPONIBILIDADE_STORAGE_KEY = "@gestordevendas:statusDisponibilidade";
// Modulo Super Usuario: nome do tenant sendo impersonado no momento,
// guardado so pra exibir na barra de "modo simulacao"
// (ImpersonationBanner) sem precisar de uma chamada extra a API - o
// valor real de verdade (se a sessao e uma impersonacao) sempre vem do
// backend (/auth/me -> impersonadoPor).
export const IMPERSONANDO_TENANT_NOME_STORAGE_KEY = "@gestordevendas:impersonandoTenantNome";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null;

  const headers = new Headers(options.headers);
  // FormData (upload de arquivo) define seu proprio Content-Type com boundary -
  // forcar application/json aqui quebraria o multipart.
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // So redireciona automaticamente quando havia um token anexado (sessao
  // expirada/invalida). Um 401 sem token (ex: login com senha errada)
  // e um erro comum que o proprio caller deve tratar, nao um redirect.
  if (response.status === 401 && token) {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.location.href = "/login";
    throw new ApiError("Sessao expirada.", 401);
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const rawMessage = body?.message ?? body?.error ?? "Erro inesperado. Tente novamente.";
    const message = Array.isArray(rawMessage) ? rawMessage.join(", ") : rawMessage;
    throw new ApiError(message, response.status);
  }

  return body as T;
}
