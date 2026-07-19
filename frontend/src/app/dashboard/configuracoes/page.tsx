// src/app/dashboard/configuracoes/page.tsx
// Reestruturacao de menu: "Painel Administrativo" foi renomeado para
// "Painel de Configuracao" e movido pra dentro do modulo RH (3a aba de
// /dashboard/rh/aprovacoes) - ver PainelConfiguracaoTab.tsx. Esta rota
// continua existindo so como redirecionamento (nao quebra favoritos/
// links antigos de quem ja tinha essa URL salva) - ninguem mais navega
// pra ca a partir do Sidebar.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ConfiguracoesRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/rh/aprovacoes?aba=painel-configuracao");
  }, [router]);

  return null;
}
