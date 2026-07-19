// src/features/roleta/hooks/useRoletaIntegration.ts
import { useCallback } from "react";
import { apiRequest, ApiError } from "@/core/api/client";
import { useRoletaStore, RoletaConfig } from "../store/useRoletaStore";

export interface UpdateRoletaConfigInput {
  algoritmo?: string;
  modo?: string;
  ativa?: boolean;
  timeoutAceiteMinutos?: number;
}

export function useRoletaIntegration() {
  const setConfig = useRoletaStore((state) => state.setConfig);
  const setLoading = useRoletaStore((state) => state.setLoading);
  const setSaving = useRoletaStore((state) => state.setSaving);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const config = await apiRequest<RoletaConfig>("/roleta/config");
      setConfig(config);
    } finally {
      setLoading(false);
    }
  }, [setConfig, setLoading]);

  const handleUpdateConfig = useCallback(
    async (input: UpdateRoletaConfigInput) => {
      setSaving(true);
      try {
        const config = await apiRequest<RoletaConfig>("/roleta/config", {
          method: "PATCH",
          body: JSON.stringify(input),
        });
        setConfig(config);
        return config;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel salvar a configuracao.");
        return null;
      } finally {
        setSaving(false);
      }
    },
    [setConfig, setSaving],
  );

  return { loadConfig, handleUpdateConfig };
}
