// src/features/pdf_tools/store/usePdfToolsStore.ts
// Estado da area de trabalho de uma ferramenta (arquivos, opcoes, status,
// resultado) + o arquivo entregue ao Leitor ("Abrir no leitor").
// Toda Object URL criada aqui e revogada quando o item e descartado.
import { create } from "zustand";
import type {
  OptionValue,
  OptionValues,
  OrganizePage,
  SelectedFile,
  ToolResult,
  ToolStatus,
} from "../types";

export interface ReaderSource {
  blob: Blob;
  name: string;
}

interface PdfToolsState {
  toolSlug: string | null;
  files: SelectedFile[];
  options: OptionValues;
  organizePages: OrganizePage[];
  status: ToolStatus;
  error: string | null;
  result: ToolResult | null;
  readerSource: ReaderSource | null;

  startTool: (slug: string, defaults: OptionValues) => void;
  addFiles: (files: File[]) => void;
  removeFile: (id: string) => void;
  reorderFiles: (from: number, to: number) => void;
  updateFileInfo: (id: string, info: Partial<Pick<SelectedFile, "pages" | "locked">>) => void;
  setOption: (key: string, value: OptionValue) => void;
  setOrganizePages: (pages: OrganizePage[]) => void;
  setStatus: (status: ToolStatus) => void;
  setError: (message: string | null) => void;
  setResult: (result: ToolResult) => void;
  // Volta para a etapa de arquivos (descarta resultado, mantem arquivos).
  clearResult: () => void;
  // Descarta tudo (arquivos + resultado) mantendo a ferramenta atual.
  resetWork: () => void;
  setReaderSource: (source: ReaderSource | null) => void;
}

let fileSeq = 0;

function isImage(file: File): boolean {
  return file.type === "image/jpeg" || file.type === "image/png" || /\.(jpe?g|png)$/i.test(file.name);
}

function revokeFile(file: SelectedFile): void {
  if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
}

function revokeResult(result: ToolResult | null): void {
  if (result?.type === "file") URL.revokeObjectURL(result.url);
}

export const usePdfToolsStore = create<PdfToolsState>((set, get) => ({
  toolSlug: null,
  files: [],
  options: {},
  organizePages: [],
  status: "idle",
  error: null,
  result: null,
  readerSource: null,

  startTool: (slug, defaults) => {
    const state = get();
    state.files.forEach(revokeFile);
    revokeResult(state.result);
    set({
      toolSlug: slug,
      files: [],
      options: { ...defaults },
      organizePages: [],
      status: "idle",
      error: null,
      result: null,
    });
  },

  addFiles: (incoming) =>
    set((state) => ({
      files: [
        ...state.files,
        ...incoming.map((file) => ({
          id: `f${Date.now().toString(36)}-${(fileSeq += 1)}`,
          file,
          previewUrl: isImage(file) ? URL.createObjectURL(file) : undefined,
        })),
      ],
      error: null,
    })),

  removeFile: (id) =>
    set((state) => {
      const target = state.files.find((f) => f.id === id);
      if (target) revokeFile(target);
      const files = state.files.filter((f) => f.id !== id);
      return { files, organizePages: files.length === 0 ? [] : state.organizePages, error: null };
    }),

  reorderFiles: (from, to) =>
    set((state) => {
      const files = [...state.files];
      const [moved] = files.splice(from, 1);
      files.splice(to, 0, moved);
      return { files };
    }),

  updateFileInfo: (id, info) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? { ...f, ...info } : f)),
    })),

  setOption: (key, value) => set((state) => ({ options: { ...state.options, [key]: value } })),

  setOrganizePages: (pages) => set({ organizePages: pages }),

  setStatus: (status) => set({ status }),

  setError: (message) => set({ error: message, status: message ? "error" : get().status }),

  setResult: (result) => {
    revokeResult(get().result);
    set({ result, status: "done", error: null });
  },

  clearResult: () => {
    revokeResult(get().result);
    set({ result: null, status: "idle", error: null });
  },

  resetWork: () => {
    const state = get();
    state.files.forEach(revokeFile);
    revokeResult(state.result);
    set({ files: [], organizePages: [], result: null, status: "idle", error: null });
  },

  setReaderSource: (source) => set({ readerSource: source }),
}));
