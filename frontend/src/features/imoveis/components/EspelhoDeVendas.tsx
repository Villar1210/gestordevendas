// src/features/imoveis/components/EspelhoDeVendas.tsx
"use client";

import { useEffect, useState } from "react";
import { useImoveisStore, Imovel } from "../store/useImoveisStore";
import { useImoveisIntegration } from "../hooks/useImoveisIntegration";
import { STATUS_OPTIONS, getStatusOption } from "../constants";
import { StatusPopover } from "./StatusPopover";

export function EspelhoDeVendas() {
  const empreendimentos = useImoveisStore((state) => state.empreendimentos);
  const espelhoEmpreendimentoId = useImoveisStore((state) => state.espelhoEmpreendimentoId);
  const setEspelhoEmpreendimentoId = useImoveisStore((state) => state.setEspelhoEmpreendimentoId);
  const { handleListImoveisByEmpreendimento, handleUpdateImovel } = useImoveisIntegration();

  const [unidades, setUnidades] = useState<Imovel[]>([]);
  const [loading, setLoading] = useState(false);
  const [openPopoverFor, setOpenPopoverFor] = useState<string | null>(null);

  useEffect(() => {
    if (empreendimentos.length > 0 && !espelhoEmpreendimentoId) {
      setEspelhoEmpreendimentoId(empreendimentos[0].id);
    }
  }, [empreendimentos, espelhoEmpreendimentoId, setEspelhoEmpreendimentoId]);

  useEffect(() => {
    if (!espelhoEmpreendimentoId) {
      setUnidades([]);
      return;
    }
    setLoading(true);
    handleListImoveisByEmpreendimento(espelhoEmpreendimentoId)
      .then(setUnidades)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [espelhoEmpreendimentoId]);

  async function handleChangeStatus(imovelId: string, status: string) {
    setOpenPopoverFor(null);
    const updated = await handleUpdateImovel(imovelId, { status });
    if (updated) {
      setUnidades((prev) => prev.map((u) => (u.id === imovelId ? { ...u, status } : u)));
    }
  }

  return (
    <div className="px-6 py-4">
      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-slate-500">Empreendimento</label>
        <select
          value={espelhoEmpreendimentoId ?? ""}
          onChange={(e) => setEspelhoEmpreendimentoId(e.target.value || null)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
        >
          {empreendimentos.length === 0 && (
            <option value="">Nenhum empreendimento cadastrado</option>
          )}
          {empreendimentos.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6 flex flex-wrap gap-3">
        {STATUS_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className={`h-3 w-3 rounded ${opt.solidClassName}`} />
            {opt.label}
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400">Carregando unidades...</p>
      ) : unidades.length === 0 ? (
        <p className="text-sm text-slate-400">
          Nenhuma unidade cadastrada neste empreendimento.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {unidades.map((unidade) => {
            const statusOption = getStatusOption(unidade.status);
            return (
              <div key={unidade.id} className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenPopoverFor(openPopoverFor === unidade.id ? null : unidade.id)
                  }
                  className={`flex aspect-square w-full flex-col items-center justify-center rounded-lg p-2 text-center text-xs font-medium leading-tight text-white shadow-sm transition hover:opacity-90 ${statusOption.solidClassName}`}
                  title={statusOption.label}
                >
                  <span className="line-clamp-2">{unidade.codigoInterno || unidade.title}</span>
                </button>

                {openPopoverFor === unidade.id && (
                  <StatusPopover
                    onSelect={(status) => handleChangeStatus(unidade.id, status)}
                    onClose={() => setOpenPopoverFor(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
