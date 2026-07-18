// src/app/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, TOKEN_STORAGE_KEY } from "@/core/api/client";
import { DASHBOARD_ROLES } from "@/core/constants/dashboardRoles";
import { ehCargoSupervisor } from "@/core/constants/cargoHierarquico";
import { SUPER_USUARIO_ROLE_NAME } from "@/core/constants/superUsuario";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      router.replace("/login");
      return;
    }

    // Mesma regra de landing page do login/page.tsx (goToDashboard) -
    // repetida aqui porque `/` e alcancada em sessoes ja existentes (reload,
    // link direto), sem passar pelo formulario de login.
    apiRequest<{ role: string; cargoHierarquico: string | null; mustChangePassword: boolean }>(
      "/auth/me",
    )
      .then((me) => {
        if (me.mustChangePassword) {
          router.replace("/trocar-senha-obrigatoria");
        } else if (me.role === SUPER_USUARIO_ROLE_NAME) {
          router.replace("/super-usuario");
        } else if (!DASHBOARD_ROLES.includes(me.role)) {
          router.replace("/minha-conta");
        } else if (me.role !== "Administrador" && !ehCargoSupervisor(me.cargoHierarquico)) {
          router.replace("/dashboard/inicio");
        } else {
          router.replace("/dashboard/kanban");
        }
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  return null;
}
