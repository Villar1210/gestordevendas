// src/features/equipe/hooks/useEquipeIntegration.ts
import { useCallback } from "react";
import { apiRequest, ApiError } from "@/core/api/client";
import { useEquipeStore, Corretor } from "../store/useEquipeStore";

export interface CreateCorretorInput {
  name: string;
  email: string;
  password?: string;
}

export function useEquipeIntegration() {
  const setCorretores = useEquipeStore((state) => state.setCorretores);
  const setLoading = useEquipeStore((state) => state.setLoading);
  const addCorretor = useEquipeStore((state) => state.addCorretor);
  const closeCorretorFormModal = useEquipeStore((state) => state.closeCorretorFormModal);

  const loadCorretores = useCallback(async () => {
    setLoading(true);
    try {
      const corretores = await apiRequest<Corretor[]>("/rh/corretores");
      setCorretores(corretores);
    } finally {
      setLoading(false);
    }
  }, [setCorretores, setLoading]);

  const handleCreateCorretor = useCallback(
    async (input: CreateCorretorInput) => {
      try {
        const corretor = await apiRequest<Corretor>("/rh/corretores", {
          method: "POST",
          body: JSON.stringify(input),
        });
        addCorretor(corretor);
        closeCorretorFormModal();
        return corretor;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel criar o corretor.");
        return null;
      }
    },
    [addCorretor, closeCorretorFormModal],
  );

  return { loadCorretores, handleCreateCorretor };
}
