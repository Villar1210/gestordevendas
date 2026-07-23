// src/features/imoveis/components/lote/PadraoLoteForm.tsx
// Formulario de "padrao estrutural" (Cadastro em Lote, Fatia 2b) - mesmo
// formato do payload que POST .../imoveis/gerar-lote espera no backend
// (ver gerar-lote-imoveis.dto.ts). So gera a lista em memoria (via
// onGerar) - nao persiste nada sozinho.
"use client";

import { useState } from "react";
import { Plus, Trash2, Wand2 } from "lucide-react";
import { PadraoLoteInput, UnidadePadraoInput } from "../../hooks/useImoveisIntegration";

interface PosicaoFormRow {
  key: string;
  posicao: string;
  tipologia: string;
  area: string;
  dormitorios: string;
}

function novaPosicaoRow(posicao: string): PosicaoFormRow {
  return {
    key: crypto.randomUUID(),
    posicao,
    tipologia: "",
    area: "",
    dormitorios: "",
  };
}

interface PadraoLoteFormProps {
  onGerar: (padrao: PadraoLoteInput) => void;
  isGenerating: boolean;
}

export function PadraoLoteForm({ onGerar, isGenerating }: PadraoLoteFormProps) {
  const [bloco, setBloco] = useState("");
  const [andarInicial, setAndarInicial] = useState("");
  const [andarFinal, setAndarFinal] = useState("");
  const [posicoes, setPosicoes] = useState<PosicaoFormRow[]>([novaPosicaoRow("1")]);
  const [validationError, setValidationError] = useState<string | null>(null);

  function updatePosicao(key: string, patch: Partial<PosicaoFormRow>) {
    setPosicoes((current) => current.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }

  function addPosicao() {
    setPosicoes((current) => [...current, novaPosicaoRow(String(current.length + 1))]);
  }

  function removePosicao(key: string) {
    setPosicoes((current) => current.filter((p) => p.key !== key));
  }

  function handleSubmit() {
    setValidationError(null);

    if (!bloco.trim()) {
      setValidationError("Informe o bloco.");
      return;
    }
    const inicial = Number(andarInicial);
    const final = Number(andarFinal);
    if (!andarInicial || !andarFinal || Number.isNaN(inicial) || Number.isNaN(final)) {
      setValidationError("Informe o andar inicial e o andar final.");
      return;
    }
    if (inicial > final) {
      setValidationError("O andar inicial nao pode ser maior que o andar final.");
      return;
    }
    if (posicoes.length === 0) {
      setValidationError("Informe ao menos uma posicao por andar.");
      return;
    }
    const unidadesPorAndar: UnidadePadraoInput[] = [];
    for (const p of posicoes) {
      const posicaoNum = Number(p.posicao);
      if (!p.posicao || Number.isNaN(posicaoNum) || posicaoNum <= 0) {
        setValidationError("Cada posicao precisa de um numero valido (maior que zero).");
        return;
      }
      if (!p.tipologia.trim()) {
        setValidationError("Cada posicao precisa de uma tipologia.");
        return;
      }
      unidadesPorAndar.push({
        posicao: posicaoNum,
        tipologia: p.tipologia.trim(),
        area: p.area ? Number(p.area) : undefined,
        dormitorios: p.dormitorios ? Number(p.dormitorios) : undefined,
      });
    }

    onGerar({
      bloco: bloco.trim(),
      andarInicial: inicial,
      andarFinal: final,
      unidadesPorAndar,
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-sm font-semibold text-slate-800">Padrao estrutural</h2>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-sm text-slate-500">Bloco</label>
          <input
            type="text"
            placeholder="ex: BL02"
            value={bloco}
            onChange={(e) => setBloco(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-500">Andar inicial</label>
          <input
            type="number"
            placeholder="ex: 1"
            value={andarInicial}
            onChange={(e) => setAndarInicial(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-500">Andar final</label>
          <input
            type="number"
            placeholder="ex: 24"
            value={andarFinal}
            onChange={(e) => setAndarFinal(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
          />
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-slate-600">Posicoes por andar</p>
          <button
            type="button"
            onClick={addPosicao}
            className="flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800"
          >
            <Plus className="h-4 w-4" /> Adicionar posicao
          </button>
        </div>

        <div className="space-y-2">
          {posicoes.map((p) => (
            <div key={p.key} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <input
                type="number"
                placeholder="Posicao"
                value={p.posicao}
                onChange={(e) => updatePosicao(p.key, { posicao: e.target.value })}
                className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
              <input
                type="text"
                placeholder="Tipologia (ex: Tipo Ponta)"
                value={p.tipologia}
                onChange={(e) => updatePosicao(p.key, { tipologia: e.target.value })}
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
              <input
                type="number"
                step="0.01"
                placeholder="Area (m2)"
                value={p.area}
                onChange={(e) => updatePosicao(p.key, { area: e.target.value })}
                className="w-32 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
              <input
                type="number"
                placeholder="Dormitorios"
                value={p.dormitorios}
                onChange={(e) => updatePosicao(p.key, { dormitorios: e.target.value })}
                className="w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
              <button
                type="button"
                onClick={() => removePosicao(p.key)}
                disabled={posicoes.length === 1}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-red-600 disabled:pointer-events-none disabled:opacity-30"
                aria-label="Remover posicao"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {validationError && <p className="mt-3 text-sm text-red-600">{validationError}</p>}

      <div className="mt-5">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isGenerating}
          className="flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        >
          <Wand2 className="h-4 w-4" />
          {isGenerating ? "Gerando..." : "Gerar unidades"}
        </button>
      </div>
    </div>
  );
}
