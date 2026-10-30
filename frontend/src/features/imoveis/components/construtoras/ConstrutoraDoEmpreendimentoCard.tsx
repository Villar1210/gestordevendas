// src/features/imoveis/components/construtoras/ConstrutoraDoEmpreendimentoCard.tsx
// Construtoras (Fatia A): construtora do empreendimento na tela de detalhe.
// Todos veem; so Administrador troca (PATCH /empreendimentos/:id - e o
// caminho que a mensagem de "excluir com vinculo" pede: trocar a
// construtora dos empreendimentos antes de excluir).
"use client";

import { useEffect, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";
import type { Empreendimento } from "../../store/useImoveisStore";
import { useConstrutoras } from "../../hooks/useConstrutoras";
import { ConstrutoraSelect } from "./ConstrutoraSelect";

interface Props {
  empreendimento: Empreendimento;
  podeEditar: boolean;
  onAtualizado: (empreendimento: Empreendimento) => void;
}

export function ConstrutoraDoEmpreendimentoCard({ empreendimento, podeEditar, onAtualizado }: Props) {
  const { construtoras, carregado, carregar } = useConstrutoras();
  const atualId = empreendimento.construtoraId ?? "";
  const [escolhida, setEscolhida] = useState(atualId);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => setEscolhida(atualId), [atualId]);
  useEffect(() => {
    if (!carregado) carregar().catch(() => undefined);
  }, [carregado, carregar]);

  const vinculada = construtoras.find((c) => c.id === atualId);
  const nomeAtual = vinculada?.nome ?? empreendimento.construtora ?? null;

  async function salvar() {
    setSalvando(true);
    setErro(null);
    try {
      const atualizado = await apiRequest<Empreendimento>(`/empreendimentos/${empreendimento.id}`, {
        method: "PATCH",
        body: JSON.stringify({ construtoraId: escolhida || null }),
      });
      onAtualizado({ ...empreendimento, construtoraId: atualizado.construtoraId ?? null, construtora: atualizado.construtora ?? null });
      // Contagem de empreendimentos por construtora mudou: recarrega a lista.
      carregar().catch(() => undefined);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível trocar a construtora.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <Building2 className="h-4 w-4 text-slate-500" aria-hidden />
        <h2 className="text-sm font-semibold text-slate-800">Construtora</h2>
      </div>
      {podeEditar ? (
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-[220px] flex-1">
            <ConstrutoraSelect id="detalhe-construtora" value={escolhida} onChange={setEscolhida} />
          </div>
          {escolhida !== atualId && (
            <button
              type="button"
              onClick={salvar}
              disabled={salvando}
              className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Salvar
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-700">{nomeAtual ?? "Sem construtora definida."}</p>
      )}
      {podeEditar && !atualId && empreendimento.construtora && (
        <p className="mt-2 text-xs text-slate-500">
          Texto antigo do cadastro: &quot;{empreendimento.construtora}&quot;. Escolha a construtora correspondente.
        </p>
      )}
      {erro && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {erro}
        </p>
      )}
    </div>
  );
}
