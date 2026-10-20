// src/features/bii/hooks/useBiiPainelIntegration.ts
// Integracao do Painel de Vendas com GET /bii/painel (so Administrador).
import { useCallback, useRef } from "react";
import { apiRequest, ApiError } from "@/core/api/client";
import { useBiiPainelStore } from "../store/useBiiPainelStore";
import { periodoDoPreset } from "../constants";
import type { PainelFiltrosState, PainelVendasQuery, PainelVendasResponse } from "../types";

export function filtrosParaQuery(filtros: PainelFiltrosState): PainelVendasQuery {
  const periodo =
    filtros.preset === "personalizado"
      ? { de: filtros.de, ate: filtros.ate }
      : periodoDoPreset(Number(filtros.preset));
  const query: PainelVendasQuery = { ...periodo };
  if (filtros.pipelineId) query.pipelineId = filtros.pipelineId;
  if (filtros.corretorId) query.corretorId = filtros.corretorId;
  if (filtros.origem) query.origem = filtros.origem;
  return query;
}

function montarQueryString(query: PainelVendasQuery): string {
  const params = new URLSearchParams();
  for (const [chave, valor] of Object.entries(query)) {
    if (valor) params.set(chave, valor);
  }
  const texto = params.toString();
  return texto ? `?${texto}` : "";
}

export function useBiiPainelIntegration() {
  const setDados = useBiiPainelStore((s) => s.setDados);
  const setLoading = useBiiPainelStore((s) => s.setLoading);
  const setErro = useBiiPainelStore((s) => s.setErro);
  const setFiltrosAplicados = useBiiPainelStore((s) => s.setFiltrosAplicados);
  // Descarta respostas atrasadas quando o usuario aplica filtros em sequencia.
  const ultimaRequisicao = useRef(0);

  const loadPainel = useCallback(
    async (filtros: PainelFiltrosState) => {
      const id = ++ultimaRequisicao.current;
      setLoading(true);
      setErro(null);
      setFiltrosAplicados(filtros);
      try {
        const dados = await apiRequest<PainelVendasResponse>(
          `/bii/painel${montarQueryString(filtrosParaQuery(filtros))}`,
        );
        if (id === ultimaRequisicao.current) setDados(dados);
      } catch (err) {
        if (id !== ultimaRequisicao.current) return;
        setErro(
          err instanceof ApiError && err.status !== 500
            ? err.message
            : "Não foi possível carregar o painel agora. Verifique sua conexão e tente de novo.",
        );
      } finally {
        if (id === ultimaRequisicao.current) setLoading(false);
      }
    },
    [setDados, setLoading, setErro, setFiltrosAplicados],
  );

  return { loadPainel };
}
