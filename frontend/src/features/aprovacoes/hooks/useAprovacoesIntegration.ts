// src/features/aprovacoes/hooks/useAprovacoesIntegration.ts
import { useCallback } from "react";
import { apiRequest, ApiError } from "@/core/api/client";
import {
  useAprovacoesStore,
  CadastroPendente,
  SuperiorCandidate,
  CadastroAprovadoComContrato,
} from "../store/useAprovacoesStore";

export interface AprovarInput {
  cargoHierarquico?: string;
  superiorId?: string;
}

export function useAprovacoesIntegration() {
  const setPendentes = useAprovacoesStore((state) => state.setPendentes);
  const setAprovados = useAprovacoesStore((state) => state.setAprovados);
  const setSuperiores = useAprovacoesStore((state) => state.setSuperiores);
  const setLoading = useAprovacoesStore((state) => state.setLoading);
  const setLoadingAprovados = useAprovacoesStore((state) => state.setLoadingAprovados);
  const setSaving = useAprovacoesStore((state) => state.setSaving);
  const removePendente = useAprovacoesStore((state) => state.removePendente);

  const loadPendentes = useCallback(async () => {
    setLoading(true);
    try {
      const pendentes = await apiRequest<CadastroPendente[]>("/rh/cadastros-pendentes");
      setPendentes(pendentes);
    } finally {
      setLoading(false);
    }
  }, [setPendentes, setLoading]);

  const loadAprovados = useCallback(async () => {
    setLoadingAprovados(true);
    try {
      const aprovados = await apiRequest<CadastroAprovadoComContrato[]>("/rh/cadastros-aprovados");
      setAprovados(aprovados);
    } finally {
      setLoadingAprovados(false);
    }
  }, [setAprovados, setLoadingAprovados]);

  const loadPossiveisSuperiores = useCallback(async () => {
    const superiores = await apiRequest<SuperiorCandidate[]>("/rh/possiveis-superiores");
    setSuperiores(superiores);
  }, [setSuperiores]);

  const handleAprovar = useCallback(
    async (id: string, input: AprovarInput) => {
      setSaving(true);
      try {
        await apiRequest(`/rh/cadastros/${id}/aprovar`, {
          method: "POST",
          body: JSON.stringify(input),
        });
        removePendente(id);
        return true;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel aprovar o cadastro.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [removePendente, setSaving],
  );

  const handleRejeitar = useCallback(
    async (id: string) => {
      setSaving(true);
      try {
        await apiRequest(`/rh/cadastros/${id}/rejeitar`, { method: "POST" });
        removePendente(id);
        return true;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel rejeitar o cadastro.");
        return false;
      } finally {
        setSaving(false);
      }
    },
    [removePendente, setSaving],
  );

  return { loadPendentes, loadAprovados, loadPossiveisSuperiores, handleAprovar, handleRejeitar };
}
