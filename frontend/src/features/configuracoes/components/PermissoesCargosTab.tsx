// src/features/configuracoes/components/PermissoesCargosTab.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";
import { CARGO_HIERARQUICO_OPTIONS } from "@/core/constants/cargoHierarquico";

interface UsuarioComHierarquia {
  id: string;
  name: string;
  email: string;
  roleName: string;
  cargoHierarquico: string | null;
  superiorId: string | null;
  standId: string | null;
}

interface SuperiorCandidate {
  id: string;
  name: string;
  cargoHierarquico: string | null;
}

interface Stand {
  id: string;
  nome: string;
}

const selectClass =
  "w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-600";

export function PermissoesCargosTab() {
  const [isLoading, setIsLoading] = useState(true);
  const [usuarios, setUsuarios] = useState<UsuarioComHierarquia[]>([]);
  const [superiores, setSuperiores] = useState<SuperiorCandidate[]>([]);
  const [stands, setStands] = useState<Stand[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    const [usuariosResp, superioresResp, standsResp] = await Promise.all([
      apiRequest<UsuarioComHierarquia[]>("/rh/usuarios-hierarquia"),
      apiRequest<SuperiorCandidate[]>("/rh/possiveis-superiores"),
      apiRequest<Stand[]>("/stands"),
    ]);
    setUsuarios(usuariosResp);
    setSuperiores(superioresResp);
    setStands(standsResp);
  }, []);

  useEffect(() => {
    loadAll()
      .catch((err) => {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar a gestao de cargos.");
      })
      .finally(() => setIsLoading(false));
  }, [loadAll]);

  function updateLocal(userId: string, patch: Partial<UsuarioComHierarquia>) {
    setUsuarios((prev) => prev.map((u) => (u.id === userId ? { ...u, ...patch } : u)));
  }

  async function handleSave(usuario: UsuarioComHierarquia) {
    setSavingId(usuario.id);
    try {
      await apiRequest(`/rh/usuarios-hierarquia/${usuario.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          cargoHierarquico: usuario.cargoHierarquico,
          superiorId: usuario.superiorId,
          standId: usuario.cargoHierarquico === "coordenador" ? usuario.standId : null,
        }),
      });
      // Recarrega os dois (o proprio usuario editado pode ter passado a
      // ser candidato a superior de outra pessoa, ou deixado de ser).
      await loadAll();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel salvar o cargo.");
    } finally {
      setSavingId(null);
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

  if (usuarios.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-24 text-slate-400">
        <p className="text-sm">Nenhum corretor ou imobiliária parceira aprovado ainda.</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3 font-medium">Nome</th>
            <th className="px-4 py-3 font-medium">Perfil</th>
            <th className="px-4 py-3 font-medium">Cargo</th>
            <th className="px-4 py-3 font-medium">Superior</th>
            <th className="px-4 py-3 font-medium">Stand</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {usuarios.map((usuario) => (
            <tr key={usuario.id}>
              <td className="px-4 py-3">
                <p className="font-medium text-slate-800">{usuario.name}</p>
                <p className="text-xs text-slate-500">{usuario.email}</p>
              </td>
              <td className="px-4 py-3 text-slate-500">{usuario.roleName}</td>
              <td className="px-4 py-3">
                <select
                  value={usuario.cargoHierarquico ?? ""}
                  onChange={(e) => {
                    const novoCargo = e.target.value || null;
                    // Stand so se aplica a Coordenador - limpa ao trocar
                    // pra outro cargo, mesma regra que o backend exige.
                    updateLocal(usuario.id, {
                      cargoHierarquico: novoCargo,
                      standId: novoCargo === "coordenador" ? usuario.standId : null,
                    });
                  }}
                  className={selectClass}
                >
                  <option value="">Sem cargo</option>
                  {CARGO_HIERARQUICO_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3">
                <select
                  value={usuario.superiorId ?? ""}
                  onChange={(e) => updateLocal(usuario.id, { superiorId: e.target.value || null })}
                  className={selectClass}
                >
                  <option value="">Sem superior</option>
                  {superiores
                    .filter((s) => s.id !== usuario.id)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </td>
              <td className="px-4 py-3">
                {usuario.cargoHierarquico === "coordenador" ? (
                  <select
                    value={usuario.standId ?? ""}
                    onChange={(e) => updateLocal(usuario.id, { standId: e.target.value || null })}
                    data-testid="permissoes-stand-select"
                    className={selectClass}
                  >
                    <option value="">Sem stand</option>
                    {stands.map((stand) => (
                      <option key={stand.id} value={stand.id}>
                        {stand.nome}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => handleSave(usuario)}
                  disabled={savingId === usuario.id}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-800 disabled:opacity-50"
                >
                  {savingId === usuario.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Salvar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
