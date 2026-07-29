// frontend/src/features/kanban/hooks/useRotatingConfig.ts
// Hook para buscar a configuração de rotting do tenant (diasParaRotting, ativaRotatingIndicador)
import { useEffect, useState } from "react";

interface RotatingConfig {
  diasParaRotting: number;
  ativaRotatingIndicador: boolean;
}

const DEFAULT_CONFIG: RotatingConfig = {
  diasParaRotting: 30,
  ativaRotatingIndicador: true,
};

let cachedConfig: RotatingConfig | null = null;

export function useRotatingConfig() {
  const [config, setConfig] = useState<RotatingConfig>(cachedConfig || DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(!cachedConfig);

  useEffect(() => {
    if (cachedConfig) {
      setConfig(cachedConfig);
      return;
    }

    const fetchConfig = async () => {
      try {
        const response = await fetch("/api/vivi/config", {
          credentials: "include",
        });
        if (response.ok) {
          const data = await response.json();
          const rotatingConfig: RotatingConfig = {
            diasParaRotting: data.diasParaRotting ?? DEFAULT_CONFIG.diasParaRotting,
            ativaRotatingIndicador: data.ativaRotatingIndicador ?? DEFAULT_CONFIG.ativaRotatingIndicador,
          };
          cachedConfig = rotatingConfig;
          setConfig(rotatingConfig);
        }
      } catch (error) {
        // Em caso de erro, usar config padrão (não quebra a funcionalidade)
        console.warn("Failed to fetch rotating config:", error);
        setConfig(DEFAULT_CONFIG);
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, []);

  return { config, isLoading };
}
