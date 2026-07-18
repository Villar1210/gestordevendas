// src/components/layout/ImpersonationBanner.tsx
// Modulo Super Usuario: barra de "modo simulacao", visivel em qualquer
// pagina do dashboard normal enquanto a sessao atual for uma
// impersonacao (ver ImpersonarTenantUseCase, backend). A cor amber aqui
// e SEMANTICA de estado (like "Aguardando Assinaturas"/badges de status
// ja existentes no projeto), nao um elemento de marca - avisa uma
// condicao temporaria e sensivel, nao e so destaque visual.
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import {
  apiRequest,
  TOKEN_STORAGE_KEY,
  STATUS_DISPONIBILIDADE_STORAGE_KEY,
  IMPERSONANDO_TENANT_NOME_STORAGE_KEY,
} from "@/core/api/client";

interface Me {
  impersonadoPor: string | null;
}

export function ImpersonationBanner() {
  const router = useRouter();
  const [impersonando, setImpersonando] = useState(false);
  const [tenantNome, setTenantNome] = useState<string | null>(null);

  useEffect(() => {
    apiRequest<Me>("/auth/me")
      .then((me) => setImpersonando(!!me.impersonadoPor))
      .catch(() => setImpersonando(false));
    setTenantNome(window.localStorage.getItem(IMPERSONANDO_TENANT_NOME_STORAGE_KEY));
  }, []);

  function handleSairDaSimulacao() {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(STATUS_DISPONIBILIDADE_STORAGE_KEY);
    window.localStorage.removeItem(IMPERSONANDO_TENANT_NOME_STORAGE_KEY);
    router.push("/login");
  }

  if (!impersonando) return null;

  return (
    <div className="flex items-center justify-between border-b border-amber-300 bg-amber-100 px-6 py-2 text-sm text-amber-800">
      <span>
        Modo simulacao: voce esta atuando como Administrador de{" "}
        <strong>{tenantNome ?? "um tenant"}</strong>.
      </span>
      <button
        onClick={handleSairDaSimulacao}
        className="flex items-center gap-1.5 rounded-lg px-3 py-1 text-sm font-medium text-amber-800 transition hover:bg-amber-200"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sair da simulacao
      </button>
    </div>
  );
}
