// src/features/pdf_tools/hooks/usePdfTool.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest, ApiError } from "@/core/api/client";
import { apiBlob } from "@/core/api/blob";
import type { PdfTool } from "../catalog";
import { MAX_FILE_SIZE_BYTES, MAX_TOTAL_SIZE_BYTES } from "../catalog";
import { usePdfToolsStore } from "../store/usePdfToolsStore";
import { buildToolOptions } from "../lib/buildOptions";
import { fileExtension, formatBytes } from "../lib/format";
import type { PdfToolsCapabilities, ResultKind } from "../types";

interface ExtractTextResponse {
  pages: number;
  text: string;
  byPage: { page: number; text: string }[];
}

function resultKind(blob: Blob, filename: string): ResultKind {
  const ext = fileExtension(filename);
  if (blob.type === "application/pdf" || ext === ".pdf") return "pdf";
  if (blob.type === "application/zip" || ext === ".zip") return "zip";
  if (blob.type.startsWith("image/") || [".jpg", ".jpeg", ".png"].includes(ext)) return "image";
  return "other";
}

function errorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 503 && !error.message) return "Esta ferramenta está indisponível no servidor.";
    return error.message;
  }
  return "Não foi possível processar. Verifique sua conexão e tente novamente.";
}

// Valida tipo/tamanho/quantidade no cliente antes de aceitar arquivos.
export function validateIncomingFiles(
  tool: PdfTool,
  current: File[],
  incoming: File[],
): { accepted: File[]; error: string | null } {
  const accepted: File[] = [];
  const problems: string[] = [];
  for (const file of incoming) {
    if (!tool.extensions.includes(fileExtension(file.name))) {
      problems.push(`"${file.name}" não é ${tool.acceptLabel}.`);
      continue;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      problems.push(`"${file.name}" tem ${formatBytes(file.size)}; o limite é 50 MB por arquivo.`);
      continue;
    }
    accepted.push(file);
  }
  const room = tool.multiple ? tool.maxFiles - current.length : 1;
  if (accepted.length > room) {
    problems.push(
      tool.multiple
        ? `Esta ferramenta aceita até ${tool.maxFiles} arquivos.`
        : "Esta ferramenta trabalha com um arquivo por vez.",
    );
    accepted.splice(Math.max(room, 0));
  }
  const total = [...current, ...accepted].reduce((sum, f) => sum + f.size, 0);
  if (total > MAX_TOTAL_SIZE_BYTES) {
    return { accepted: [], error: "Os arquivos somam mais de 80 MB. Envie menos arquivos por vez." };
  }
  return { accepted, error: problems.length ? problems.join(" ") : null };
}

export function usePdfTool(tool: PdfTool | undefined) {
  const run = useCallback(async () => {
    if (!tool) return;
    const store = usePdfToolsStore.getState();
    const { files, options, organizePages } = store;

    if (tool.kind === "upload" && files.length < tool.minFiles) {
      store.setError(
        tool.minFiles > 1 ? `Selecione ao menos ${tool.minFiles} arquivos.` : "Selecione um arquivo.",
      );
      return;
    }
    if (files.some((f) => f.locked) && tool.slug !== "desbloquear") {
      store.setError("Este PDF está protegido por senha. Use a ferramenta Desbloquear PDF primeiro.");
      return;
    }

    let body: BodyInit;
    let originalSize = files.reduce((sum, f) => sum + f.file.size, 0);

    if (tool.kind === "create") {
      const content = String(options.content ?? "");
      if (!content.trim()) {
        store.setError("Escreva o conteúdo do documento antes de gerar o PDF.");
        return;
      }
      if (content.length > 50_000) {
        store.setError("O conteúdo pode ter no máximo 50.000 caracteres.");
        return;
      }
      const title = String(options.title ?? "").trim();
      // Multipart (campo "options"), nao JSON: o parser JSON do backend
      // limita o corpo a 100 KB e 50.000 caracteres acentuados passam disso.
      const form = new FormData();
      form.append(
        "options",
        JSON.stringify({
          ...(title ? { title } : {}),
          content,
          pageSize: options.pageSize,
          fontSize: Number(options.fontSize),
        }),
      );
      body = form;
      originalSize = 0;
    } else {
      const built = buildToolOptions(tool.slug, options, files, organizePages);
      if (!built.ok) {
        store.setError(built.error);
        return;
      }
      const form = new FormData();
      files.forEach((f) => form.append(tool.fileField, f.file, f.file.name));
      if (built.options) form.append("options", JSON.stringify(built.options));
      body = form;
    }

    store.setError(null);
    store.setStatus("processing");
    try {
      if (tool.slug === "extrair-texto") {
        const data = await apiRequest<ExtractTextResponse>(tool.endpoint, { method: "POST", body });
        usePdfToolsStore.getState().setResult({
          type: "text",
          pages: data.pages,
          text: data.text,
          byPage: data.byPage ?? [],
          sourceName: files[0]?.file.name ?? "documento.pdf",
        });
        return;
      }
      const { blob, filename, meta } = await apiBlob(
        tool.endpoint,
        { method: "POST", body },
        tool.kind === "create" ? "documento.pdf" : "resultado.pdf",
      );
      usePdfToolsStore.getState().setResult({
        type: "file",
        blob,
        filename,
        url: URL.createObjectURL(blob),
        kind: resultKind(blob, filename),
        meta,
        originalSize,
      });
    } catch (error) {
      const s = usePdfToolsStore.getState();
      s.setStatus("idle");
      s.setError(errorMessage(error));
    }
  }, [tool]);

  return { run };
}

// Capacidades do servidor (LibreOffice, Ghostscript, qpdf, rasterizacao).
// null = ainda carregando ou indisponivel; nesse caso nao bloqueamos nada
// (o backend responde 503 com mensagem clara se faltar algo).
let capabilitiesCache: Promise<PdfToolsCapabilities> | null = null;

export function usePdfCapabilities(): PdfToolsCapabilities | null {
  const [caps, setCaps] = useState<PdfToolsCapabilities | null>(null);
  useEffect(() => {
    let active = true;
    if (!capabilitiesCache) {
      capabilitiesCache = apiRequest<PdfToolsCapabilities>("/pdf-tools/capabilities");
      capabilitiesCache.catch(() => {
        capabilitiesCache = null;
      });
    }
    capabilitiesCache.then((c) => active && setCaps(c)).catch(() => active && setCaps(null));
    return () => {
      active = false;
    };
  }, []);
  return caps;
}
