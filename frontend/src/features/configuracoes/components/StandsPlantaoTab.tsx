// src/features/configuracoes/components/StandsPlantaoTab.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";

interface Stand {
  id: string;
  nome: string;
  endereco: string | null;
  ativo: boolean;
}

interface Corretor {
  id: string;
  name: string;
}

interface Escala {
  id: string;
  userId: string;
  userName: string;
  diaSemana: number;
}

const DIAS_SEMANA = [
  { valor: 0, label: "Domingo" },
  { valor: 1, label: "Segunda" },
  { valor: 2, label: "Terça" },
  { valor: 3, label: "Quarta" },
  { valor: 4, label: "Quinta" },
  { valor: 5, label: "Sexta" },
  { valor: 6, label: "Sábado" },
];

export function StandsPlantaoTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [stands, setStands] = useState<Stand[]>([]);
  const [corretores, setCorretores] = useState<Corretor[]>([]);
  const [selectedStandId, setSelectedStandId] = useState<string | null>(null);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [isLoadingEscalas, setIsLoadingEscalas] = useState(false);

  const [novoNome, setNovoNome] = useState("");
  const [novoEndereco, setNovoEndereco] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const [novoCorretorPorDia, setNovoCorretorPorDia] = useState<Record<number, string>>({});

  const loadStands = useCallback(async () => {
    const [standsResp, corretoresResp] = await Promise.all([
      apiRequest<Stand[]>("/stands"),
      apiRequest<Corretor[]>("/rh/corretores"),
    ]);
    setStands(standsResp);
    setCorretores(corretoresResp);
  }, []);

  useEffect(() => {
    loadStands()
      .catch((err) => {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar os stands.");
      })
      .finally(() => setIsLoading(false));
  }, [loadStands]);

  const loadEscalas = useCallback(async (standId: string) => {
    setIsLoadingEscalas(true);
    try {
      const resp = await apiRequest<Escala[]>(`/stands/${standId}/escalas`);
      setEscalas(resp);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar a escala.");
    } finally {
      setIsLoadingEscalas(false);
    }
  }, []);

  function handleSelectStand(standId: string) {
    setSelectedStandId(standId);
    loadEscalas(standId);
  }

  async function handleCreateStand() {
    if (!novoNome.trim()) {
      alert("Informe o nome do stand.");
      return;
    }
    setIsCreating(true);
    try {
      await apiRequest("/stands", {
        method: "POST",
        body: JSON.stringify({ nome: novoNome.trim(), endereco: novoEndereco.trim() || undefined }),
      });
      setNovoNome("");
      setNovoEndereco("");
      await loadStands();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel criar o stand.");
    } finally {
      setIsCreating(false);
    }
  }

  async function handleDeleteStand(stand: Stand) {
    if (!window.confirm(`Excluir o stand "${stand.nome}"? Essa ação não pode ser desfeita.`)) return;
    try {
      await apiRequest(`/stands/${stand.id}`, { method: "DELETE" });
      if (selectedStandId === stand.id) {
        setSelectedStandId(null);
        setEscalas([]);
      }
      await loadStands();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel excluir o stand.");
    }
  }

  async function handleAddEscala(diaSemana: number) {
    const userId = novoCorretorPorDia[diaSemana];
    if (!userId || !selectedStandId) return;
    try {
      await apiRequest(`/stands/${selectedStandId}/escalas`, {
        method: "POST",
        body: JSON.stringify({ userId, diaSemana }),
      });
      setNovoCorretorPorDia((prev) => ({ ...prev, [diaSemana]: "" }));
      await loadEscalas(selectedStandId);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel adicionar a escala.");
    }
  }

  async function handleRemoveEscala(escalaId: string) {
    if (!selectedStandId) return;
    try {
      await apiRequest(`/escalas/${escalaId}`, { method: "DELETE" });
      await loadEscalas(selectedStandId);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel remover a escala.");
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <p className="text-sm">Carregando...</p>
      </div>
    );
  }

  const selectedStand = stands.find((s) => s.id === selectedStandId) ?? null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-800">Novo Stand</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Nome</span>
            <input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              data-testid="stand-nome-input"
              placeholder="Ex: Stand Centro"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-500">Endereço (opcional)</span>
            <input
              value={novoEndereco}
              onChange={(e) => setNovoEndereco(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
            />
          </label>
          <button
            onClick={handleCreateStand}
            disabled={isCreating}
            data-testid="stand-create-button"
            className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> Criar Stand
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className="h-fit rounded-2xl border border-slate-200 bg-white p-2">
          {stands.length === 0 ? (
            <p className="p-3 text-sm text-slate-400">Nenhum stand cadastrado ainda.</p>
          ) : (
            stands.map((stand) => (
              <div
                key={stand.id}
                data-testid={`stand-row-${stand.nome}`}
                className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  selectedStandId === stand.id ? "bg-blue-50" : "hover:bg-slate-50"
                }`}
              >
                <button
                  onClick={() => handleSelectStand(stand.id)}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate font-medium text-slate-800">{stand.nome}</p>
                  {stand.endereco && <p className="truncate text-xs text-slate-500">{stand.endereco}</p>}
                </button>
                <button
                  onClick={() => handleDeleteStand(stand)}
                  data-testid={`stand-delete-${stand.nome}`}
                  className="shrink-0 rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                  title="Excluir stand"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          {!selectedStand ? (
            <p className="py-16 text-center text-sm text-slate-400">
              Selecione um stand à esquerda para gerenciar a escala semanal.
            </p>
          ) : isLoadingEscalas ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              <h3 className="mb-3 text-sm font-semibold text-slate-800">
                Escala semanal — {selectedStand.nome}
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                {DIAS_SEMANA.map((dia) => {
                  const escalasDoDia = escalas.filter((e) => e.diaSemana === dia.valor);
                  return (
                    <div
                      key={dia.valor}
                      data-testid={`escala-dia-${dia.valor}`}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-2"
                    >
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {dia.label}
                      </p>
                      <div className="space-y-1">
                        {escalasDoDia.map((escala) => (
                          <div
                            key={escala.id}
                            className="flex items-center justify-between gap-1 rounded-lg bg-white px-2 py-1 text-xs text-slate-700 shadow-sm"
                          >
                            <span className="truncate">{escala.userName}</span>
                            <button
                              onClick={() => handleRemoveEscala(escala.id)}
                              className="shrink-0 text-slate-400 hover:text-red-600"
                              title="Remover"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 flex gap-1">
                        <select
                          value={novoCorretorPorDia[dia.valor] ?? ""}
                          onChange={(e) =>
                            setNovoCorretorPorDia((prev) => ({ ...prev, [dia.valor]: e.target.value }))
                          }
                          data-testid={`escala-select-${dia.valor}`}
                          className="w-full rounded border border-slate-200 px-1 py-1 text-xs text-slate-700 outline-none focus:border-blue-600"
                        >
                          <option value="">+ corretor</option>
                          {corretores
                            .filter((c) => !escalasDoDia.some((e) => e.userId === c.id))
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={() => handleAddEscala(dia.valor)}
                          data-testid={`escala-add-${dia.valor}`}
                          className="shrink-0 rounded bg-blue-700 px-1.5 text-white hover:bg-blue-800"
                          title="Adicionar"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
