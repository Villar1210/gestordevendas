// src/core/api/client.ts
export const TOKEN_STORAGE_KEY = "@gestordevendas:token";
export const STATUS_DISPONIBILIDADE_STORAGE_KEY = "@gestordevendas:statusDisponibilidade";
export const IMPERSONANDO_TENANT_NOME_STORAGE_KEY = "@gestordevendas:impersonandoTenantNome";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3333";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Cache curto do GET /auth/me. Cada pagina do dashboard chamava /auth/me
// de 3 a 5 vezes ao abrir (Sidebar, Topbar, banner, a propria pagina...).
// Com o cache, chamadas simultaneas ou proximas reaproveitam a mesma resposta.
const ME_ENDPOINT = "/auth/me";
const ME_CACHE_TTL_MS = 30_000;
// Guarda tambem o token: login, troca de conta ou impersonacao geram outro
// token e, portanto, nunca reaproveitam o /auth/me do usuario anterior.
let meCache: { promise: Promise<unknown>; expiresAt: number; token: string | null } | null = null;

function invalidateMeCache(): void {
  meCache = null;
}

export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  if (endpoint === ME_ENDPOINT && typeof window !== "undefined") {
    if (method !== "GET") {
      // PATCH /auth/me (perfil/senha) altera os dados: descarta o cache
      // antes e depois, para nenhuma leitura concorrente guardar dado velho.
      invalidateMeCache();
      return rawApiRequest<T>(endpoint, options).finally(invalidateMeCache);
    } else {
      const currentToken = window.localStorage.getItem(TOKEN_STORAGE_KEY);
      if (meCache && meCache.expiresAt > Date.now() && meCache.token === currentToken) {
        return meCache.promise as Promise<T>;
      }
      const promise = rawApiRequest<T>(endpoint, options);
      meCache = { promise, expiresAt: Date.now() + ME_CACHE_TTL_MS, token: currentToken };
      // Falha nao fica em cache: a proxima chamada tenta de novo.
      promise.catch(() => invalidateMeCache());
      return promise;
    }
  }
  return rawApiRequest<T>(endpoint, options);
}

async function rawApiRequest<T>(endpoint: string, options: RequestInit): Promise<T> {
  const token =
    typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null;

  const headers = new Headers(options.headers);
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
  // expirada/invalida ou tokenVersion divergente apos logout/troca de senha).
  // Um 401 sem token (ex: login com senha errada) e tratado pelo proprio caller.
  if (response.status === 401 && token) {
    clearLocalSession();
    window.location.href = "/login";
    throw new ApiError("Sessao expirada.", 401);
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const rawMessage = body?.message ?? body?.error ?? "Erro inesperado. Tente novamente.";
    const message = Array.isArray(rawMessage) ? rawMessage.join(", ") : rawMessage;
    throw new ApiError(message, response.status, body);
  }

  return body as T;
}

// Remove todos os dados de sessao do localStorage.
function clearLocalSession(): void {
  invalidateMeCache();
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(STATUS_DISPONIBILIDADE_STORAGE_KEY);
  window.localStorage.removeItem(IMPERSONANDO_TENANT_NOME_STORAGE_KEY);
}

// Encerra a sessao do usuario: avisa o backend (invalida o tokenVersion),
// limpa o localStorage e redireciona para /login.
// Use esta funcao em todos os botoes de "Sair" da aplicacao.
export async function logout(): Promise<void> {
  try {
    await apiRequest("/auth/logout", { method: "POST" });
  } catch {
    // Ignora erros de rede — a limpeza local sempre acontece.
    // Se o token ja estiver invalido (401), apiRequest ja limpou e redirecionou.
  } finally {
    clearLocalSession();
    window.location.href = "/login";
  }
}
