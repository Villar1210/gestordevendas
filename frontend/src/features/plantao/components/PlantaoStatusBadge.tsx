// src/features/plantao/components/PlantaoStatusBadge.tsx
"use client";

import { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { apiRequest } from "@/core/api/client";

interface Me {
  cargoHierarquico: string | null;
}

interface MeuStatusHoje {
  standId: string | null;
  standNome: string | null;
  corretoresHojeCount: number;
}

// So renderiza algo para o cargo "coordenador" (busca /auth/me primeiro pra
// decidir isso, sem exigir que a pagina que usa este componente ja saiba o
// cargo do usuario logado - reaproveitavel em qualquer tela do dashboard,
// hoje usado em Kanban e Central de Atendimento). Nenhum dado de
// visibilidade real depende deste componente - e so um indicador visual;
// o filtro de verdade ja acontece no backend (GetBoardUseCase/
// ListAtendimentosUseCase, escopo "plantao").
export function PlantaoStatusBadge() {
  const [isCoordenador, setIsCoordenador] = useState(false);
  const [status, setStatus] = useState<MeuStatusHoje | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiRequest<Me>("/auth/me")
      .then((me) => {
        if (cancelled || me.cargoHierarquico !== "coordenador") return;
        setIsCoordenador(true);
        return apiRequest<MeuStatusHoje>("/stands/meu-status-hoje").then((resp) => {
          if (!cancelled) setStatus(resp);
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isCoordenador || !status) return null;

  if (!status.standId) {
    return (
      <span
        data-testid="plantao-status-badge"
        className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700"
      >
        <MapPin className="h-3.5 w-3.5" />
        Nenhum stand atribuído
      </span>
    );
  }

  return (
    <span
      data-testid="plantao-status-badge"
      className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700"
    >
      <MapPin className="h-3.5 w-3.5" />
      Stand: {status.standNome} — {status.corretoresHojeCount}{" "}
      {status.corretoresHojeCount === 1 ? "corretor" : "corretores"} hoje
    </span>
  );
}
