// src/features/imoveis/hooks/useConstrutoras.ts
// Construtoras (Fatia A): lista compartilhada (aba Construtoras, seletor do
// empreendimento, tela do book e detalhe do empreendimento) + chamadas a API.
// Ler: qualquer role do dashboard. Criar/editar/excluir/logo: so
// Administrador - o backend bloqueia de verdade, a tela so esconde botoes.
"use client";

import { useCallback } from "react";
import { create } from "zustand";
import { apiRequest } from "@/core/api/client";

export interface Construtora {
  id: string;
  nome: string;
  nomeNormalizado: string;
  site: string | null;
  sobre: string | null;
  diferenciais: string | null;
  logoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  quantidadeEmpreendimentos?: number;
}

export interface DadosConstrutora {
  nome?: string;
  site?: string | null;
  sobre?: string | null;
  diferenciais?: string | null;
}

// Mesma regra do backend (domain/services/construtora.ts): sem acento,
// minusculas, espacos colapsados. Usada so para casar o nome lido do book
// com uma construtora ja cadastrada.
export function normalizarNomeConstrutora(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[ \t\n\v\f\r ]+/g, " ")
    .replace(/^ | $/g, "");
}

interface ConstrutorasState {
  construtoras: Construtora[];
  carregado: boolean;
  setConstrutoras: (lista: Construtora[]) => void;
  upsert: (construtora: Construtora) => void;
  remover: (id: string) => void;
}

const useConstrutorasStore = create<ConstrutorasState>((set) => ({
  construtoras: [],
  carregado: false,
  setConstrutoras: (construtoras) => set({ construtoras, carregado: true }),
  upsert: (construtora) =>
    set((state) => {
      const existe = state.construtoras.some((c) => c.id === construtora.id);
      const lista = existe
        ? state.construtoras.map((c) => (c.id === construtora.id ? { ...c, ...construtora } : c))
        : [...state.construtoras, construtora];
      return { construtoras: lista.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")) };
    }),
  remover: (id) => set((state) => ({ construtoras: state.construtoras.filter((c) => c.id !== id) })),
}));

export function useConstrutoras() {
  const construtoras = useConstrutorasStore((s) => s.construtoras);
  const carregado = useConstrutorasStore((s) => s.carregado);
  const setConstrutoras = useConstrutorasStore((s) => s.setConstrutoras);
  const upsert = useConstrutorasStore((s) => s.upsert);
  const remover = useConstrutorasStore((s) => s.remover);

  const carregar = useCallback(async () => {
    const lista = await apiRequest<Construtora[]>("/construtoras");
    setConstrutoras(lista);
    return lista;
  }, [setConstrutoras]);

  // As funcoes abaixo LANCAM ApiError (409 nome repetido, 409 com vinculo,
  // 400 site/foto...) - a tela mostra a mensagem do backend.
  const criar = useCallback(
    async (dados: DadosConstrutora & { nome: string }) => {
      const criada = await apiRequest<Construtora>("/construtoras", { method: "POST", body: JSON.stringify(dados) });
      upsert(criada);
      return criada;
    },
    [upsert],
  );

  const atualizar = useCallback(
    async (id: string, dados: DadosConstrutora) => {
      const atualizada = await apiRequest<Construtora>(`/construtoras/${id}`, {
        method: "PATCH",
        body: JSON.stringify(dados),
      });
      upsert(atualizada);
      return atualizada;
    },
    [upsert],
  );

  const excluir = useCallback(
    async (id: string) => {
      await apiRequest(`/construtoras/${id}`, { method: "DELETE" });
      remover(id);
    },
    [remover],
  );

  const enviarLogo = useCallback(
    async (id: string, arquivo: File) => {
      const formData = new FormData();
      formData.append("file", arquivo);
      const atualizada = await apiRequest<Construtora>(`/construtoras/${id}/logo`, { method: "POST", body: formData });
      upsert(atualizada);
      return atualizada;
    },
    [upsert],
  );

  const removerLogo = useCallback(
    async (id: string) => {
      const atualizada = await apiRequest<Construtora>(`/construtoras/${id}/logo`, { method: "DELETE" });
      upsert(atualizada);
      return atualizada;
    },
    [upsert],
  );

  return { construtoras, carregado, carregar, criar, atualizar, excluir, enviarLogo, removerLogo };
}
