// src/features/pdf_tools/lib/buildOptions.ts
// Converte o estado do formulario (OptionValues) no JSON exato que cada rota
// do backend espera, e devolve erros de validacao amigaveis antes do envio.
import type { OptionValues, OrganizePage, SelectedFile } from "../types";
import { validateRangeSyntax, validateRangesAgainstTotal } from "./format";

export type BuildResult =
  | { ok: true; options: Record<string, unknown> | null }
  | { ok: false; error: string };

function str(values: OptionValues, key: string): string {
  const v = values[key];
  return typeof v === "string" ? v : v === undefined ? "" : String(v);
}

function num(values: OptionValues, key: string): number {
  const v = values[key];
  return typeof v === "number" ? v : Number(v);
}

function bool(values: OptionValues, key: string): boolean {
  return values[key] === true;
}

export function buildToolOptions(
  slug: string,
  values: OptionValues,
  files: SelectedFile[],
  organizePages: OrganizePage[],
): BuildResult {
  const totalPages = files[0]?.pages;
  const rangeCheck = (value: string, allowEmpty: boolean): string | null =>
    validateRangeSyntax(value, { allowEmpty }) ?? validateRangesAgainstTotal(value, totalPages);

  switch (slug) {
    case "dividir": {
      const mode = str(values, "mode");
      if (mode === "ranges") {
        const ranges = str(values, "ranges").replace(/\s+/g, "");
        const error = rangeCheck(ranges, false);
        return error ? { ok: false, error } : { ok: true, options: { mode, ranges } };
      }
      if (mode === "extract") {
        const pages = str(values, "pages").replace(/\s+/g, "");
        const error = rangeCheck(pages, false);
        return error ? { ok: false, error } : { ok: true, options: { mode, pages } };
      }
      return { ok: true, options: { mode: "every" } };
    }
    case "organizar": {
      if (organizePages.length === 0) {
        return { ok: false, error: "Mantenha ao menos uma página no documento." };
      }
      return {
        ok: true,
        options: { pages: organizePages.map((p) => ({ index: p.index, rotate: p.rotate })) },
      };
    }
    case "girar": {
      const pages = str(values, "pages").replace(/\s+/g, "");
      const error = rangeCheck(pages, true);
      if (error) return { ok: false, error };
      const options: Record<string, unknown> = { angle: num(values, "angle") };
      if (pages) options.pages = pages;
      return { ok: true, options };
    }
    case "comprimir":
      return { ok: true, options: { level: str(values, "level") } };
    case "imagens-para-pdf":
      return {
        ok: true,
        options: {
          pageSize: str(values, "pageSize"),
          orientation: str(values, "orientation"),
          margin: str(values, "margin"),
        },
      };
    case "pdf-para-imagem": {
      const pages = str(values, "pages").replace(/\s+/g, "");
      const error = rangeCheck(pages, true);
      if (error) return { ok: false, error };
      const options: Record<string, unknown> = { format: str(values, "format"), dpi: num(values, "dpi") };
      if (pages) options.pages = pages;
      return { ok: true, options };
    }
    case "numeros-de-pagina": {
      const startAt = num(values, "startAt");
      if (!Number.isInteger(startAt) || startAt < 1 || startAt > 9999) {
        return { ok: false, error: "O número inicial deve ser um inteiro entre 1 e 9999." };
      }
      return {
        ok: true,
        options: {
          position: str(values, "position"),
          format: str(values, "format"),
          startAt,
          skipFirst: bool(values, "skipFirst"),
        },
      };
    }
    case "marca-dagua": {
      const text = str(values, "text").trim();
      if (text.length < 1) return { ok: false, error: "Digite o texto da marca d'água." };
      if (text.length > 60) return { ok: false, error: "O texto pode ter no máximo 60 caracteres." };
      return {
        ok: true,
        options: {
          text,
          opacity: num(values, "opacity"),
          size: str(values, "size"),
          diagonal: bool(values, "diagonal"),
        },
      };
    }
    case "proteger": {
      const password = str(values, "password");
      if (password.length < 4 || password.length > 64) {
        return { ok: false, error: "A senha precisa ter entre 4 e 64 caracteres." };
      }
      if (password !== str(values, "confirm")) {
        return { ok: false, error: "As senhas não conferem. Digite a mesma senha nos dois campos." };
      }
      return {
        ok: true,
        options: { password, allowPrint: bool(values, "allowPrint"), allowCopy: bool(values, "allowCopy") },
      };
    }
    case "desbloquear": {
      // Senha vazia e valida: PDFs com so "senha de permissao" (abrem sem
      // senha, mas bloqueiam imprimir/copiar/editar) sao desbloqueados
      // sem senha de abertura - o backend ja aceita isso.
      return { ok: true, options: { password: str(values, "password") } };
    }
    default:
      return { ok: true, options: null };
  }
}
