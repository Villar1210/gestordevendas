// src/features/atendimento/components/FilasManagementCard.tsx
// Gestao de Filas da Central de Atendimento - so Administrador (renderizado
// condicionalmente pela pagina de Equipe, mesmo padrao do RoletaConfigCard).
"use client";

import { useEffect, useRef, useState } from "react";
import { Headset, Plus, Pencil, Trash2 } from "lucide-react";
import { apiRequest } from "@/core/api/client";
import { useAtendimentoStore } from "../store/useAtendimentoStore";
import { useAtendimentoIntegration } from "../hooks/useAtendimentoIntegration";
import { colorForFilaNome } from "../constants";

interface Agente {
  id: string;
  name: string;
}

export function FilasManagementCard() {
  const filas = useAtendimentoStore((state) => state.filas);
  const {
    loadFilas,
    handleCreateFila,
    handleAddUsuarioToFila,
    handleRemoveUsuarioFromFila,
    handleDeleteFila,
  } = useAtendimentoIntegration();
  const hasInitialized = useRef(false);

  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [novoNome, setNovoNome] = useState("");
  const [creating, setCreating] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Card "editar" abre/fecha o vinculo de agentes logo abaixo do grid -
  // nao existe rota de renomear fila no backend (decisao desta fatia: sem
  // alterar schema), entao "editar" aqui significa gerenciar os agentes.
  const [expandedFilaId, setExpandedFilaId] = useState<string | null>(null);

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

  async function handleDelete(filaId: string, nome: string) {
    if (!confirm(`Excluir a fila "${nome}"? Atendimentos vinculados voltam para "Nao Classificados".`))
      return;
    setDeletingId(filaId);
    try {
      const ok = await handleDeleteFila(filaId);
      if (ok && expandedFilaId === filaId) setExpandedFilaId(null);
    } finally {
      setDeletingId(null);
    }
  }

  const expandedFila = filas.find((f) => f.id === expandedFilaId) ?? null;

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
        <>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {filas.map((fila) => {
              const color = colorForFilaNome(fila.nome);
              const isExpanded = expandedFilaId === fila.id;
              return (
                <div
                  key={fila.id}
                  className={`rounded-xl border p-4 transition ${
                    isExpanded ? "border-blue-300 ring-1 ring-blue-200" : "border-slate-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="h-8 w-8 shrink-0 rounded-lg"
                        style={{ backgroundColor: color }}
                        aria-hidden
                      />
                      <p className="truncate text-sm font-semibold text-slate-800">{fila.nome}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => setExpandedFilaId(isExpanded ? null : fila.id)}
                        title="Gerenciar agentes vinculados"
                        aria-label="Editar"
                        className={`grid h-7 w-7 place-items-center rounded-md transition ${
                          isExpanded ? "bg-blue-100 text-blue-700" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        }`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(fila.id, fila.nome)}
                        disabled={deletingId === fila.id}
                        title="Excluir fila"
                        aria-label="Excluir"
                        className="grid h-7 w-7 place-items-center rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-400">
                    {fila.usuarioIds.length} agente{fila.usuarioIds.length === 1 ? "" : "s"} vinculado
                    {fila.usuarioIds.length === 1 ? "" : "s"}
                  </p>
                </div>
              );
            })}
          </div>

          {expandedFila && (
            <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
              <p className="mb-2 text-sm font-medium text-slate-800">
                Agentes vinculados a &quot;{expandedFila.nome}&quot;
              </p>
              {agentes.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum corretor cadastrado ainda.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {agentes.map((agente) => {
                    const isMember = expandedFila.usuarioIds.includes(agente.id);
                    const key = `${expandedFila.id}:${agente.id}`;
                    return (
                      <label
                        key={agente.id}
                        className="flex items-center gap-1.5 text-sm text-slate-600"
                      >
                        <input
                          type="checkbox"
                          checked={isMember}
                          disabled={busyKey === key}
                          onChange={() => toggleUsuario(expandedFila.id, agente.id, isMember)}
                          className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                        />
                        {agente.name}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
