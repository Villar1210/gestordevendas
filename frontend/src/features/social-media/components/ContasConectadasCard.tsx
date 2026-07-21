// src/features/social-media/components/ContasConectadasCard.tsx
"use client";

import { useEffect, useRef } from "react";
import { Share2, Plug, Trash2 } from "lucide-react";
import { useSocialMediaStore } from "../store/useSocialMediaStore";
import { useSocialMediaIntegration } from "../hooks/useSocialMediaIntegration";
import { getCanalOption, getStatusOption } from "../constants";

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function ContasConectadasCard() {
  const contas = useSocialMediaStore((state) => state.contas);
  const isLoading = useSocialMediaStore((state) => state.isLoading);
  const isConectando = useSocialMediaStore((state) => state.isConectando);
  const { loadContas, handleConectar, handleDesconectar } = useSocialMediaIntegration();
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadContas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-800">Contas conectadas</h2>
        </div>

        <button
          onClick={handleConectar}
          disabled={isConectando}
          className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        >
          <Plug className="h-3.5 w-3.5" />
          {isConectando ? "Redirecionando..." : "Conectar Instagram/Facebook"}
        </button>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-400">Carregando contas conectadas...</p>
      ) : contas.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nenhuma conta conectada ainda. Clique em &quot;Conectar Instagram/Facebook&quot; para vincular
          uma Pagina do Facebook (e a conta do Instagram Business ligada a ela, se houver).
        </p>
      ) : (
        <div className="divide-y divide-slate-100">
          {contas.map((conta) => {
            const canalOption = getCanalOption(conta.canal);
            const statusOption = getStatusOption(conta.status);
            const desconectada = conta.status === "DISCONNECTED";

            return (
              <div key={conta.id} className="flex items-center justify-between py-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800">{conta.accountName}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${canalOption.badgeClassName}`}>
                      {canalOption.label}
                    </span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusOption.badgeClassName}`}>
                      {statusOption.label}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Conectada em {dateFormatter.format(new Date(conta.createdAt))}
                  </p>
                </div>

                {!desconectada && (
                  <button
                    onClick={() => handleDesconectar(conta.id)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Desconectar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
