// src/features/atendimento/components/FilasManagementCard.tsx
// Gestao de Filas da Central de Atendimento - so Administrador (renderizado
// condicionalmente pela pagina de Equipe, mesmo padrao do RoletaConfigCard).
"use client";

import { useEffect, useRef, useState } from "react";
import { Headset, Plus } from "lucide-react";
import { apiRequest } from "@/core/api/client";
import { useAtendimentoStore } from "../store/useAtendimentoStore";
import { useAtendimentoIntegration } from "../hooks/useAtendimentoIntegration";

interface Agente {
  id: string;
  name: string;
}

export function FilasManagementCard() {
  const filas = useAtendimentoStore((state) => state.filas);
  const { loadFilas, handleCreateFila, handleAddUsuarioToFila, handleRemoveUsuarioFromFila } =
    useAtendimentoIntegration();
  const hasInitialized = useRef(false);

  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadFilas();
    apiRequest<Agente[]>("/rh/corretores")
      .then(setAgentes)
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    const nome = novoNome.trim();
    if (!nome) return;
    setCreating(true);
    try {
      const created = await handleCreateFila(nome);
      if (created) setNovoNome("");
    } finally {
      setCreating(false);
    }
  }

  async function toggleUsuario(filaId: string, userId: string, isMember: boolean) {
    setBusyKey(`${filaId}:${userId}`);
    try {
      if (isMember) {
        await handleRemoveUsuarioFromFila(filaId, userId);
      } else {
        await handleAddUsuarioToFila(filaId, userId);
      }
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center gap-2">
        <Headset className="h-5 w-5 text-blue-600" />
        <h2 className="text-lg font-semibold text-slate-800">Filas de Atendimento</h2>
      </div>

      <p className="mb-4 text-sm text-slate-500">
        Cada fila agrupa atendimentos por categoria (ex: Suporte, Financeiro). Vincule os agentes
        que podem assumir atendimentos de cada fila.
      </p>

      <div className="mb-4 flex gap-2">
        <input
          type="text"
          placeholder="Nome da nova fila"
          value={novoNome}
          onChange={(e) => setNovoNome(e.target.value)}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
        />
        <button
          onClick={handleCreate}
          disabled={creating || !novoNome.trim()}
          className="flex items-center gap-1 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
        >
          <Plus className="h-4 w-4" /> Criar
        </button>
      </div>

      {filas.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">
          Nenhuma fila ainda - sera criada automaticamente (Suporte, Financeiro, Duvidas Gerais)
          assim que o primeiro atendimento chegar.
        </p>
      ) : (
        <div className="space-y-4">
          {filas.map((fila) => (
            <div key={fila.id} className="rounded-lg border border-slate-200 p-4">
              <p className="mb-2 text-sm font-medium text-slate-800">{fila.nome}</p>
              {agentes.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum corretor cadastrado ainda.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {agentes.map((agente) => {
                    const isMember = fila.usuarioIds.includes(agente.id);
                    const key = `${fila.id}:${agente.id}`;
                    return (
                      <label
                        key={agente.id}
                        className="flex items-center gap-1.5 text-sm text-slate-600"
                      >
                        <input
                          type="checkbox"
                          checked={isMember}
                          disabled={busyKey === key}
                          onChange={() => toggleUsuario(fila.id, agente.id, isMember)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                        />
                        {agente.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
