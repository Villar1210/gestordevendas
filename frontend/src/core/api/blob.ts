// src/core/api/blob.ts
// Requisicoes que devolvem ARQUIVO (PDF, ZIP, imagem) em vez de JSON.
// Complementa o client.ts (que sempre faz response.json()) sem altera-lo:
// mesmo token, mesma base URL e o mesmo ApiError nos erros.
import {
  API_BASE_URL,
  ApiError,
  IMPERSONANDO_TENANT_NOME_STORAGE_KEY,
  STATUS_DISPONIBILIDADE_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
} from "./client";

export type BlobMeta = Record<string, string | number | boolean | null>;

export interface BlobResponse {
  blob: Blob;
  filename: string;
  meta: BlobMeta;
}

// Le o nome do arquivo do Content-Disposition. Prefere filename* (UTF-8,
// RFC 5987) e cai para filename="..." quando nao houver.
export function parseContentDispositionFilename(header: string | null): string | null {
  if (!header) return null;
  const encoded = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // segue para o filename simples
    }
  }
  const plain = /filename\s*=\s*"([^"]*)"/.exec(header) ?? /filename\s*=\s*([^;]+)/.exec(header);
  return plain ? plain[1].trim() : null;
}

function parseMeta(header: string | null): BlobMeta {
  if (!header) return {};
  try {
    const parsed: unknown = JSON.parse(header);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as BlobMeta;
    }
  } catch {
    // meta e opcional: header invalido nao derruba o download
  }
  return {};
}

function messageFromBody(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const record = body as { message?: unknown; error?: unknown };
    const raw = record.message ?? record.error;
    if (Array.isArray(raw)) return raw.map(String).join(", ");
    if (typeof raw === "string" && raw.trim()) return raw;
  }
  return fallback;
}

export async function apiBlob(
  path: string,
  init: RequestInit = {},
  fallbackFilename = "arquivo",
): Promise<BlobResponse> {
  const token = typeof window !== "undefined" ? window.localStorage.getItem(TOKEN_STORAGE_KEY) : null;

  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError("Não foi possível conectar ao servidor. Verifique sua conexão.", 0);
  }

  // Mesmo comportamento do client.ts: sessao expirada com token → login.
  if (response.status === 401 && token) {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(STATUS_DISPONIBILIDADE_STORAGE_KEY);
    window.localStorage.removeItem(IMPERSONANDO_TENANT_NOME_STORAGE_KEY);
    window.location.href = "/login";
    throw new ApiError("Sessão expirada.", 401);
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const fallback =
      response.status === 413
        ? "O arquivo é grande demais para ser processado."
        : "Não foi possível processar o arquivo. Tente novamente.";
    throw new ApiError(messageFromBody(body, fallback), response.status, body);
  }

  const blob = await response.blob();
  const filename =
    parseContentDispositionFilename(response.headers.get("Content-Disposition")) ?? fallbackFilename;
  const meta = parseMeta(response.headers.get("X-Pdf-Tools-Meta"));
  return { blob, filename, meta };
}
