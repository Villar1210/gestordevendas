// src/features/atendimento/components/AtendimentoList.tsx
"use client";

import { useMemo, useState } from "react";
import { Search, Inbox, Check, ArrowLeftRight, X, RotateCcw, MessageCircle, AlertTriangle } from "lucide-react";
import { Atendimento, Fila } from "../store/useAtendimentoStore";
import { ATENDIMENTO_TABS, AtendimentoTab, filaChipStyle } from "../constants";
import { formatRelativeTime, formatPhoneDisplay, initialsFromPhone } from "../format";

const FILA_FILTER_TODAS = "todas";
const FILA_FILTER_NAO_CLASSIFICADO = "nao_classificado";

interface Agente {
  id: string;
  name: string;
}

interface AtendimentoListProps {
  atendimentos: (Atendimento & { lastMessageBody?: string | null; lastMessageAt?: string | null })[];
  filas: Fila[];
  agentes: Agente[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  activeTab: AtendimentoTab;
  onTabChange: (tab: AtendimentoTab) => void;
  filaFilter: string;
  onFilaFilterChange: (filaFilter: string) => void;
  onQuickAssign: (id: string) => Promise<unknown>;
  onQuickTransfer: (id: string, input: { filaId?: string; ownerId?: string }) => Promise<unknown>;
  onQuickRequeue: (id: string) => Promise<unknown>;
  onQuickClose: (id: string) => Promise<unknown>;
}

export function AtendimentoList({
  atendimentos,
  filas,
  agentes,
  selectedId,
  onSelect,
  activeTab,
  onTabChange,
  filaFilter,
  onFilaFilterChange,
  onQuickAssign,
  onQuickTransfer,
  onQuickRequeue,
  onQuickClose,
}: AtendimentoListProps) {
  const [search, setSearch] = useState("");

  // Filtro de fila (dropdown) e independente das abas de status - as duas
  // coisas coexistem e se combinam (AND).
  const filaFiltered = useMemo(() => {
    if (filaFilter === FILA_FILTER_TODAS) return atendimentos;
    if (filaFilter === FILA_FILTER_NAO_CLASSIFICADO) return atendimentos.filter((a) => !a.filaId);
    return atendimentos.filter((a) => a.filaId === filaFilter);
  }, [atendimentos, filaFilter]);

  // Contagem por aba reflete o filtro de fila atual (mas nao o texto de
  // busca, nem a propria aba selecionada) - mesmo padrao do tabCounts do
  // wacalls-chat estudado como referencia.
  const tabCounts = useMemo(() => {
    const counts: Record<AtendimentoTab, number> = { atendendo: 0, aguardando: 0, todos: filaFiltered.length };
    for (const a of filaFiltered) {
      if (a.status === "em_atendimento") counts.atendendo += 1;
      else if (a.status === "aguardando") counts.aguardando += 1;
    }
    return counts;
  }, [filaFiltered]);

  const filtered = useMemo(() => {
    let list = filaFiltered;
    if (activeTab === "atendendo") list = list.filter((a) => a.status === "em_atendimento");
    else if (activeTab === "aguardando") list = list.filter((a) => a.status === "aguardando");
    if (search.trim()) {
      const term = search.trim().toLowerCase();
      list = list.filter((a) => a.phoneNumber.toLowerCase().includes(term));
    }
    return list;
  }, [filaFiltered, activeTab, search]);

  return (
    <div className="flex w-96 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-2 border-b border-slate-100 p-3">
        <Search className="h-4 w-4 shrink-0 text-slate-400" />
        <input
          type="text"
          placeholder="Buscar por numero..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
      </div>

      <div className="flex items-stretch border-b border-slate-100 text-xs font-medium">
        {ATENDIMENTO_TABS.map((tab) => {
          const count = tabCounts[tab.id];
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`flex flex-1 items-center justify-center gap-1.5 px-2 py-2 transition ${
                active ? "border-b-2 border-blue-700 text-slate-800" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span>{tab.label}</span>
              {count > 0 && (
                <span className="grid h-4 min-w-[1rem] place-items-center rounded-full bg-blue-700 px-1 text-[10px] font-semibold leading-none text-white">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="border-b border-slate-100 p-2">
        <select
          value={filaFilter}
          onChange={(e) => onFilaFilterChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-700 outline-none focus:border-blue-600"
        >
          <option value={FILA_FILTER_TODAS}>Todas as filas</option>
          <option value={FILA_FILTER_NAO_CLASSIFICADO}>Nao Classificados</option>
          {filas.map((fila) => (
            <option key={fila.id} value={fila.id}>
              {fila.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-slate-400">
            <Inbox className="h-6 w-6" />
            <p className="text-sm">Nenhum atendimento aqui.</p>
          </div>
        ) : (
          filtered.map((atendimento) => (
            <AtendimentoRow
              key={atendimento.id}
              atendimento={atendimento}
              isSelected={atendimento.id === selectedId}
              tab={activeTab}
              filas={filas}
              agentes={agentes}
              onClick={() => onSelect(atendimento.id)}
              onQuickAssign={onQuickAssign}
              onQuickTransfer={onQuickTransfer}
              onQuickRequeue={onQuickRequeue}
              onQuickClose={onQuickClose}
            />
          ))
        )}
      </div>
    </div>
  );
}

interface RowProps {
  atendimento: Atendimento & { lastMessageBody?: string | null; lastMessageAt?: string | null };
  isSelected: boolean;
  tab: AtendimentoTab;
  filas: Fila[];
  agentes: Agente[];
  onClick: () => void;
  onQuickAssign: (id: string) => Promise<unknown>;
  onQuickTransfer: (id: string, input: { filaId?: string; ownerId?: string }) => Promise<unknown>;
  onQuickRequeue: (id: string) => Promise<unknown>;
  onQuickClose: (id: string) => Promise<unknown>;
}

// AtendimentoRow: linha completa da lista, com avatar/canal/fila/preview e
// os botoes de acao rapida contextuais por ABA (nao por status do proprio
// item - dentro da aba "Aguardando" todo item ja tem status=aguardando, e
// assim por diante; a aba "Todos" mistura status, entao mostra so
// Finalizar, desabilitado se o item ja estiver fechado).
function AtendimentoRow({
  atendimento,
  isSelected,
  tab,
  filas,
  agentes,
  onClick,
  onQuickAssign,
  onQuickTransfer,
  onQuickRequeue,
  onQuickClose,
}: RowProps) {
  const [busy, setBusy] = useState<null | "assign" | "close" | "requeue" | "transfer">(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferFilaId, setTransferFilaId] = useState("");
  const [transferOwnerId, setTransferOwnerId] = useState("");

  const displayName = formatPhoneDisplay(atendimento.phoneNumber);
  const initials = initialsFromPhone(atendimento.phoneNumber);
  const isFechado = atendimento.status === "fechado";

  async function run(kind: typeof busy, fn: () => Promise<unknown>) {
    if (busy) return;
    setBusy(kind);
    try {
      await fn();
    } finally {
      setBusy(null);
    }
  }

  function handleAssign(e: React.MouseEvent) {
    e.stopPropagation();
    void run("assign", async () => {
      await onQuickAssign(atendimento.id);
      onClick();
    });
  }
  function handleClose(e: React.MouseEvent) {
    e.stopPropagation();
    void run("close", () => onQuickClose(atendimento.id));
  }
  function handleRequeue(e: React.MouseEvent) {
    e.stopPropagation();
    void run("requeue", () => onQuickRequeue(atendimento.id));
  }
  function handleTransferToggle(e: React.MouseEvent) {
    e.stopPropagation();
    setTransferOpen((v) => !v);
  }
  function confirmTransfer(e: React.MouseEvent) {
    e.stopPropagation();
    if (!transferFilaId && !transferOwnerId) return;
    void run("transfer", async () => {
      await onQuickTransfer(atendimento.id, {
        filaId: transferFilaId || undefined,
        ownerId: transferOwnerId || undefined,
      });
      setTransferOpen(false);
      setTransferFilaId("");
      setTransferOwnerId("");
    });
  }

  return (
    <div
      className={`border-b border-slate-50 transition ${isSelected ? "bg-blue-50" : "hover:bg-slate-50"} ${
        atendimento.urgente ? "border-l-4 border-l-rose-500" : ""
      }`}
    >
      <button
        onClick={onClick}
        data-testid="atendimento-row"
        className="flex w-full items-start gap-3 px-3 pt-3 text-left"
      >
        <div className="relative shrink-0">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
            {initials}
          </span>
          <span
            aria-label="WhatsApp"
            title="WhatsApp"
            className="absolute -bottom-0.5 -right-0.5 grid h-4 w-4 place-items-center rounded-full bg-[#25D366] text-white ring-2 ring-white"
          >
            <MessageCircle className="h-2.5 w-2.5" fill="currentColor" strokeWidth={0} />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-sm font-medium text-slate-800">{displayName}</span>
            <span className="shrink-0 text-[11px] text-slate-400">
              {formatRelativeTime(atendimento.lastMessageAt ?? atendimento.updatedAt)}
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {atendimento.lastMessageBody || "Sem mensagens ainda"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {atendimento.urgente && (
              <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                <AlertTriangle className="h-2.5 w-2.5" /> Urgente
              </span>
            )}
            {atendimento.filaNome && (
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={filaChipStyle(atendimento.filaNome)}
              >
                {atendimento.filaNome}
              </span>
            )}
          </div>
        </div>
      </button>

      <div className="flex items-center justify-end gap-1 px-3 pb-2 pt-1.5">
        {tab === "aguardando" && (
          <>
            <RowAction tone="success" label="Aceitar" busy={busy === "assign"} disabled={!!busy} onClick={handleAssign}>
              <Check className="h-3 w-3" strokeWidth={3} />
            </RowAction>
            <RowAction tone="indigo" label="Transferir" disabled={!!busy} onClick={handleTransferToggle}>
              <ArrowLeftRight className="h-3 w-3" />
            </RowAction>
            <RowAction tone="rose" label="Finalizar" busy={busy === "close"} disabled={!!busy} onClick={handleClose}>
              <X className="h-3 w-3" strokeWidth={3} />
            </RowAction>
          </>
        )}
        {tab === "atendendo" && (
          <>
            <RowAction tone="indigo" label="Transferir" disabled={!!busy} onClick={handleTransferToggle}>
              <ArrowLeftRight className="h-3 w-3" />
            </RowAction>
            <RowAction tone="rose" label="Finalizar" busy={busy === "close"} disabled={!!busy} onClick={handleClose}>
              <X className="h-3 w-3" strokeWidth={3} />
            </RowAction>
            <RowAction tone="muted" label="Devolver para fila" busy={busy === "requeue"} disabled={!!busy} onClick={handleRequeue}>
              <RotateCcw className="h-3 w-3" />
            </RowAction>
          </>
        )}
        {tab === "todos" && (
          <RowAction
            tone="rose"
            label="Finalizar"
            busy={busy === "close"}
            disabled={!!busy || isFechado}
            onClick={handleClose}
          >
            <X className="h-3 w-3" strokeWidth={3} />
          </RowAction>
        )}
      </div>

      {transferOpen && (
        <div
          className="mx-3 mb-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-wrap gap-1.5">
            <select
              value={transferFilaId}
              onChange={(e) => setTransferFilaId(e.target.value)}
              className="rounded-md border border-slate-200 px-1.5 py-1 text-[11px] text-slate-700 outline-none focus:border-blue-600"
            >
              <option value="">Manter fila atual</option>
              {filas.map((fila) => (
                <option key={fila.id} value={fila.id}>
                  {fila.nome}
                </option>
              ))}
            </select>
            <select
              value={transferOwnerId}
              onChange={(e) => setTransferOwnerId(e.target.value)}
              className="rounded-md border border-slate-200 px-1.5 py-1 text-[11px] text-slate-700 outline-none focus:border-blue-600"
            >
              <option value="">Sem repassar a um agente</option>
              {agentes.map((agente) => (
                <option key={agente.id} value={agente.id}>
                  {agente.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setTransferOpen(false);
              }}
              className="rounded-md px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-white"
            >
              Cancelar
            </button>
            <button
              onClick={confirmTransfer}
              disabled={busy === "transfer" || (!transferFilaId && !transferOwnerId)}
              className="rounded-md bg-blue-700 px-2 py-1 text-[11px] font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              Confirmar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// RowAction: botao de acao quadrado 24x24 com cor semantica por "tone" -
// mesma ideia do RowAction do wacalls-chat estudado como referencia,
// simplificado para sempre usar o formato quadrado (nao alterna
// pill/quadrado por aba).
type Tone = "success" | "indigo" | "rose" | "muted";
const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-emerald-500 text-white border-transparent hover:bg-emerald-600 active:bg-emerald-700",
  indigo: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30 hover:bg-indigo-500/25",
  rose: "bg-rose-500 text-white border-transparent hover:bg-rose-600 active:bg-rose-700",
  muted: "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200",
};

function RowAction({
  tone,
  label,
  onClick,
  children,
  disabled,
  busy,
}: {
  tone: Tone;
  label: string;
  onClick: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-busy={busy || undefined}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${TONE_CLASSES[tone]}`}
    >
      {busy ? <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> : children}
    </button>
  );
}
