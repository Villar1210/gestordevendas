// Analise salva aberta do Historico (GET /bii/analises/:id), com a mesma
// visualizacao do resultado de uma nova analise.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { carregarAnalise, mensagemErroAnalise } from "../../hooks/useBiiAnaliseIntegration";
import type { AnaliseEnderecoResponse } from "../../types-endereco";
import { EmptyState } from "../EmptyState";
import { AnaliseResultado } from "./AnaliseResultado";

export function AnaliseSalva({ id }: { id: string }) {
  const [analise, setAnalise] = useState<AnaliseEnderecoResponse | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    carregarAnalise(id)
      .then(setAnalise)
      .catch((err) => setErro(mensagemErroAnalise(err)))
      .finally(() => setCarregando(false));
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <div className="space-y-4">
      <Link
        href="/dashboard/bii/historico"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Voltar ao histórico
      </Link>
      {carregando ? (
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden="true" />
          <p className="text-sm">Carregando análise...</p>
        </div>
      ) : erro || !analise ? (
        <section className="rounded-2xl border border-slate-200 bg-white">
          <EmptyState
            icon={AlertCircle}
            titulo="Não foi possível abrir a análise"
            texto={erro ?? undefined}
            acao={{ label: "Tentar de novo", onClick: carregar }}
          />
        </section>
      ) : (
        <AnaliseResultado analise={analise} salvaEm={analise.criadoEm} />
      )}
    </div>
  );
}
