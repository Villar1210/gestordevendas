// src/core/hooks/useMe.ts
// Usuario logado (GET /auth/me) com cache Zustand: UMA chamada por sessao
// (token). Login, troca de conta ou impersonacao geram outro token e a
// proxima leitura busca de novo. Expoe role/cargo e os atalhos de permissao
// usados para esconder botoes - o bloqueio real e sempre no backend.
"use client";

import { useEffect } from "react";
import { create } from "zustand";
import { apiRequest, TOKEN_STORAGE_KEY } from "@/core/api/client";
import { podeAlterarStatusUnidade } from "@/core/constants/permissoesImoveis";

export interface Me {
  id: string;
  name: string;
  email: string;
  role: string;
  cargoHierarquico: string | null;
  standId: string | null;
  impersonadoPor: string | null;
}

interface MeState {
  me: Me | null;
  // undefined = ainda nao buscou nesta aba.
  token: string | null | undefined;
  carregando: Promise<void> | null;
  carregar: () => void;
}

function tokenAtual(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

const useMeStore = create<MeState>((set, get) => ({
  me: null,
  token: undefined,
  carregando: null,
  carregar: () => {
    const token = tokenAtual();
    const estado = get();
    if (estado.token === token && (estado.me || estado.carregando)) return;
    const carregando = apiRequest<Me>("/auth/me")
      .then((me) => {
        if (get().token === token) set({ me, carregando: null });
      })
      .catch(() => {
        // Falha nao fica em cache: a proxima tela tenta de novo.
        if (get().token === token) set({ carregando: null });
      });
    set({ token, me: estado.token === token ? estado.me : null, carregando });
  },
}));

export function useMe() {
  const me = useMeStore((s) => s.me);
  const carregar = useMeStore((s) => s.carregar);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const role = me?.role ?? null;
  const cargo = me?.cargoHierarquico ?? null;
  return {
    me,
    id: me?.id ?? null,
    role,
    cargo,
    // false ate /auth/me responder: telas escondem acoes enquanto isso.
    carregado: me !== null,
    isAdmin: role === "Administrador",
    podeAlterarStatus: podeAlterarStatusUnidade(role, cargo),
  };
}
