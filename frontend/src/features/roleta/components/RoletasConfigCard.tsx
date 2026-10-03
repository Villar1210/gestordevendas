// src/features/roleta/components/RoletasConfigCard.tsx
// Fatia 2 (Sorteio da vez): cadastro das roletas (só Administrador).
// Cada roleta é de um Stand (participam os escalados do dia) ou de um
// Produto (participam os corretores vinculados e ela recebe os leads dos
// empreendimentos vinculados). Horários e modo de sorteio por roleta.
"use client";

import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2, Users, X } from "lucide-react";
import { apiRequest } from "@/core/api/client";
import { useRoletas } from "../hooks/useRoletas";
import type { Roleta, SalvarRoletaInput } from "../types";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

interface Opcao {
  id: string;
  nome: string;
}

const VAZIA: SalvarRoletaInput = {
  nome: "",
  tipo: "produto",
  standId: null,
  padrao: false,
  ativa: true,
  modoSorteio: "automatico",
  horariosSorteio: ["09:00", "14:00"],
  minutosSorteioSeguranca: 15,
  empreendimentoIds: [],
  corretorIds: [],
};

export function RoletasConfigCard({ algoritmoAtual }: { algoritmoAtual?: string }) {
  const { roletas, carregando, ocupado, carregar, salvar, excluir } = useRoletas();
  const [stands, setStands] = useState<Opcao[]>([]);
  const [empreendimentos, setEmpreendimentos] = useState<Opcao[]>([]);
  const [corretores, setCorretores] = useState<Opcao[]>([]);
  const [editando, setEditando] = useState<{ id?: string; dados: SalvarRoletaInput } | null>(null);

  useEffect(() => {
    carregar();
    apiRequest<Array<{ id: string; nome: string }>>("/stands").then(setStands).catch(() => {});
    apiRequest<Array<{ id: string; name: string }>>("/empreendimentos")
      .then((l) => setEmpreendimentos(l.map((e) => ({ id: e.id, nome: e.name }))))
      .catch(() => {});
    apiRequest<Array<{ id: string; name: string }>>("/rh/corretores")
      .then((l) => setCorretores(l.map((c) => ({ id: c.id, nome: c.name }))))
      .catch(() => {});
  }, [carregar]);

  function editar(r?: Roleta) {
    setEditando(
      r
        ? {
            id: r.id,
            dados: {
              nome: r.nome,
              tipo: r.tipo,
              standId: r.standId,
              padrao: r.padrao,
              ativa: r.ativa,
              modoSorteio: r.modoSorteio,
              horariosSorteio: r.horariosSorteio,
              minutosSorteioSeguranca: r.minutosSorteioSeguranca,
              empreendimentoIds: r.empreendimentoIds,
              corretorIds: r.corretorIds,
            },
          }
        : { dados: { ...VAZIA, padrao: roletas.length === 0 } },
    );
  }

  const nomeDe = (lista: Opcao[], id: string | null) => lista.find((o) => o.id === id)?.nome ?? "—";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold text-slate-800">Roletas (sorteio da vez)</h2>
        </div>
        <button
          onClick={() => editar()}
          className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Nova roleta
        </button>
      </div>
      <p className="mb-4 text-sm text-slate-500">
        Quem faz login entra na fila. Nos horários configurados, a ordem de atendimento é sorteada entre quem está
        online; quem chega depois entra no fim, e quem recebe um lead vai para o fim da fila.
        {algoritmoAtual !== "sorteio" && (
          <span className="mt-1 block font-medium text-amber-600">
            Para valer na distribuição, escolha &quot;Sorteio da vez&quot; no algoritmo da Roleta Online acima.
          </span>
        )}
      </p>

      {carregando ? (
        <p className="text-sm text-slate-400">Carregando roletas...</p>
      ) : roletas.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">
          Nenhuma roleta cadastrada.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {roletas.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800">
                  {r.nome}
                  {r.padrao && <span className="ml-2 rounded bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">padrão</span>}
                  {!r.ativa && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">desativada</span>}
                </p>
                <p className="text-xs text-slate-500">
                  {r.tipo === "stand"
                    ? `Stand: ${nomeDe(stands, r.standId)}`
                    : `Produto: ${r.empreendimentoIds.map((id) => nomeDe(empreendimentos, id)).join(", ") || "nenhum empreendimento"} · ${r.corretorIds.length} corretor(es)`}
                  {" · "}
                  {r.horariosSorteio.length ? `sorteio ${r.horariosSorteio.join(" e ")}` : "sem horário"} ·{" "}
                  {r.modoSorteio === "automatico" ? "automático" : `botão (sorteia sozinho após ${r.minutosSorteioSeguranca} min)`}
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => editar(r)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label="Editar">
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => confirm(`Excluir a roleta "${r.nome}"?`) && excluir(r.id)}
                  disabled={ocupado}
                  className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                  aria-label="Excluir"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {editando && (
        <RoletaForm
          inicial={editando.dados}
          stands={stands}
          empreendimentos={empreendimentos}
          corretores={corretores}
          ocupado={ocupado}
          onCancelar={() => setEditando(null)}
          onSalvar={async (dados) => {
            if (await salvar(dados, editando.id)) setEditando(null);
          }}
        />
      )}
    </div>
  );
}

function RoletaForm({
  inicial,
  stands,
  empreendimentos,
  corretores,
  ocupado,
  onCancelar,
  onSalvar,
}: {
  inicial: SalvarRoletaInput;
  stands: Opcao[];
  empreendimentos: Opcao[];
  corretores: Opcao[];
  ocupado: boolean;
  onCancelar: () => void;
  onSalvar: (dados: SalvarRoletaInput) => void;
}) {
  const [d, setD] = useState<SalvarRoletaInput>(inicial);
  const [novoHorario, setNovoHorario] = useState("");
  const set = (parcial: Partial<SalvarRoletaInput>) => setD((atual) => ({ ...atual, ...parcial }));
  const alternar = (lista: string[], id: string) => (lista.includes(id) ? lista.filter((x) => x !== id) : [...lista, id]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSalvar(d);
        }}
        className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-800">{inicial.nome ? "Editar roleta" : "Nova roleta"}</h3>
          <button type="button" onClick={onCancelar} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Nome</label>
            <input className={inputClass} value={d.nome} onChange={(e) => set({ nome: e.target.value })} placeholder="Ex.: Terrasse Vila Ema" required />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Tipo</label>
              <select className={inputClass} value={d.tipo} onChange={(e) => set({ tipo: e.target.value as SalvarRoletaInput["tipo"] })}>
                <option value="produto">Por produto (empreendimento)</option>
                <option value="stand">Por stand / loja</option>
              </select>
            </div>
            {d.tipo === "stand" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Stand</label>
                <select className={inputClass} value={d.standId ?? ""} onChange={(e) => set({ standId: e.target.value || null })} required>
                  <option value="">Escolha...</option>
                  {stands.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
          <p className="-mt-2 text-xs text-slate-400">
            {d.tipo === "stand"
              ? "Participam os corretores escalados no plantão deste stand no dia."
              : "Participam os corretores marcados abaixo, estejam onde estiverem. Recebe os leads dos empreendimentos marcados."}
          </p>

          {d.tipo === "produto" && (
            <>
              <Checklist
                titulo="Empreendimentos"
                opcoes={empreendimentos}
                marcados={d.empreendimentoIds}
                onAlternar={(id) => set({ empreendimentoIds: alternar(d.empreendimentoIds, id) })}
              />
              <Checklist
                titulo="Corretores"
                opcoes={corretores}
                marcados={d.corretorIds}
                onAlternar={(id) => set({ corretorIds: alternar(d.corretorIds, id) })}
              />
            </>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-600">Horários do sorteio</label>
            <div className="flex flex-wrap items-center gap-2">
              {d.horariosSorteio.map((h) => (
                <span key={h} className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-sm text-blue-700">
                  {h}
                  <button
                    type="button"
                    onClick={() => set({ horariosSorteio: d.horariosSorteio.filter((x) => x !== h) })}
                    aria-label={`Remover ${h}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ))}
              <input type="time" value={novoHorario} onChange={(e) => setNovoHorario(e.target.value)} className="rounded-lg border border-slate-200 px-2 py-1 text-sm" />
              <button
                type="button"
                onClick={() => {
                  if (novoHorario && !d.horariosSorteio.includes(novoHorario)) {
                    set({ horariosSorteio: [...d.horariosSorteio, novoHorario].sort() });
                  }
                  setNovoHorario("");
                }}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-sm text-slate-600 hover:bg-slate-50"
              >
                Adicionar
              </button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-600">Modo do sorteio</label>
              <select className={inputClass} value={d.modoSorteio} onChange={(e) => set({ modoSorteio: e.target.value as SalvarRoletaInput["modoSorteio"] })}>
                <option value="automatico">Automático no horário</option>
                <option value="botao">Gerente/coordenador aperta o botão</option>
              </select>
            </div>
            {d.modoSorteio === "botao" && (
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-600">Se ninguém sortear, sorteia sozinho após (min)</label>
                <input
                  type="number"
                  min={5}
                  max={45}
                  className={inputClass}
                  value={d.minutosSorteioSeguranca}
                  onChange={(e) => set({ minutosSorteioSeguranca: Number(e.target.value) })}
                />
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={d.padrao} onChange={(e) => set({ padrao: e.target.checked })} />
            Roleta padrão (recebe os leads sem produto definido)
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" checked={d.ativa} onChange={(e) => set({ ativa: e.target.checked })} />
            Ativa
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancelar} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <button type="submit" disabled={ocupado} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
            Salvar
          </button>
        </div>
      </form>
    </div>
  );
}

function Checklist({
  titulo,
  opcoes,
  marcados,
  onAlternar,
}: {
  titulo: string;
  opcoes: Opcao[];
  marcados: string[];
  onAlternar: (id: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-600">
        {titulo} <span className="font-normal text-slate-400">({marcados.length} marcados)</span>
      </label>
      <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
        {opcoes.length === 0 && <p className="text-xs text-slate-400">Nenhum cadastrado.</p>}
        {opcoes.map((o) => (
          <label key={o.id} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={marcados.includes(o.id)} onChange={() => onAlternar(o.id)} />
            {o.nome}
          </label>
        ))}
      </div>
    </div>
  );
}
