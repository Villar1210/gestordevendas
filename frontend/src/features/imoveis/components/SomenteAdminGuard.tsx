// src/features/imoveis/components/SomenteAdminGuard.tsx
// Telas de gestao so do Administrador (importar book, cadastro em lote):
// quem nao e admin e mandado de volta para a consulta (destino, com
// ?aviso=somente-admin para a tela mostrar um aviso discreto). E so
// conveniencia - o backend ja devolve 403 nessas rotas.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useMe } from "@/core/hooks/useMe";

export function SomenteAdminGuard({ destino, children }: { destino: string; children: React.ReactNode }) {
  const { carregado, isAdmin } = useMe();
  const router = useRouter();

  useEffect(() => {
    if (carregado && !isAdmin) router.replace(destino);
  }, [carregado, isAdmin, destino, router]);

  if (!carregado || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-400">
        <Loader2 className="h-6 w-6 animate-spin" aria-label="Carregando" />
      </div>
    );
  }
  return <>{children}</>;
}

export function destinoComAviso(caminho: string): string {
  return `${caminho}${caminho.includes("?") ? "&" : "?"}aviso=somente-admin`;
}
