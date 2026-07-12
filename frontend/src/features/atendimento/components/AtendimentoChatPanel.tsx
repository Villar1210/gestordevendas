// src/features/atendimento/components/AtendimentoChatPanel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  UserCheck,
  ArrowRightLeft,
  Undo2,
  CheckCircle2,
  StickyNote,
  Headset,
  Loader2,
} from "lucide-react";
import { Atendimento, AtendimentoEvento, AtendimentoMensagem, Fila } from "../store/useAtendimentoStore";
import { getStatusOption, EVENTO_TIPO_LABELS } from "../constants";

const timeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

interface Agente {
  id: string;
  name: string;
}

interface AtendimentoChatPanelProps {
  atendimento: Atendimento | null;
  eventos: AtendimentoEvento[];
  mensagens: AtendimentoMensagem[];
  filas: Fila[];
  agentes: Agente[];
  currentUserId: string | null;
  currentUserRole: string | null;
  isLoading: boolean;
  onAssign: () => Promise<void>;
  onTransfer: (input: { filaId?: string; ownerId?: string }) => Promise<void>;
  onRequeue: () => Promise<void>;
  onClose: (motivo?: string) => Promise<void>;
  onAddNota: (texto: string) => Promise<void>;
  onSendMessage: (body: string) => Promise<void>;
}

type DialogKind = "transfer" | "close" | "nota" | null;

export function AtendimentoChatPanel({
  atendimento,
  eventos,
  mensagens,
  filas,
  agentes,
  currentUserId,
  currentUserRole,
  isLoading,
  onAssign,
  onTransfer,
  onRequeue,
  onClose,
  onAddNota,
  onSendMessage,
}: AtendimentoChatPanelProps) {
  const [messageBody, setMessageBody] = useState("");
  const [sending, setSending] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [transferFilaId, setTransferFilaId] = useState("");
  const [transferOwnerId, setTransferOwnerId] = useState("");
  const [closeMotivo, setCloseMotivo] = useState("");
  const [notaTexto, setNotaTexto] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [mensagens.length]);

  useEffect(() => {
    setDialog(null);
    setTransferFilaId("");
    setTransferOwnerId("");
    setCloseMotivo("");
    setNotaTexto("");
  }, [atendimento?.id]);

  if (!atendimento) {
    return (
      <div className="flex flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 shadow-sm">
        <div className="flex flex-col items-center gap-2">
          <Headset className="h-8 w-8" />
          <p className="text-sm">Selecione um atendimento para comecar.</p>
        </div>
      </div>
    );
  }

  const isOwner = atendimento.ownerId === currentUserId;
  const isAdmin = currentUserRole === "Administrador";
  const isFechado = atendimento.status === "fechado";
  const statusOption = getStatusOption(atendimento.status);

  async function runAction(fn: () => Promise<void>) {
    setActionBusy(true);
    try {
      await fn();
    } finally {
      setActionBusy(false);
    }
  }

  async function handleSend() {
    const body = messageBody.trim();
    if (!body) return;
    setSending(true);
    try {
      await onSendMessage(body);
      setMessageBody("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">{atendimento.phoneNumber}</p>
          <div className="mt-1 flex items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusOption.badgeClassName}`}>
              {statusOption.label}
            </span>
            {atendimento.filaNome && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                {atendimento.filaNome}
              </span>
            )}
            {atendimento.ownerName && (
              <span className="text-[11px] text-slate-400">com {atendimento.ownerName}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {!isFechado && !isOwner && (
            <button
              onClick={() => runAction(onAssign)}
              disabled={actionBusy}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <UserCheck className="h-3.5 w-3.5" /> Assumir
            </button>
          )}
          {!isFechado && (
            <button
              onClick={() => setDialog("transfer")}
              disabled={actionBusy}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" /> Transferir
            </button>
          )}
          {atendimento.status === "em_atendimento" && (isOwner || isAdmin) && (
            <button
              onClick={() => runAction(onRequeue)}
              disabled={actionBusy}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <Undo2 className="h-3.5 w-3.5" /> Devolver
            </button>
          )}
          {!isFechado && (
            <button
              onClick={() => setDialog("close")}
              disabled={actionBusy}
              className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              <CheckCircle2 className="h-3.5 w-3.5" /> Fechar
            </button>
          )}
          <button
            onClick={() => setDialog("nota")}
            disabled={actionBusy}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <StickyNote className="h-3.5 w-3.5" /> Nota
          </button>
        </div>
      </div>

      {dialog && (
        <div className="border-b border-slate-100 bg-slate-50 p-4">
          {dialog === "transfer" && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Transferir atendimento</p>
              <div className="flex flex-wrap gap-2">
                <select
                  value={transferFilaId}
                  onChange={(e) => setTransferFilaId(e.target.value)}
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-600"
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
                  className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-blue-600"
                >
                  <option value="">Sem repassar a um agente</option>
                  {agentes.map((agente) => (
                    <option key={agente.id} value={agente.id}>
                      {agente.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setDialog(null)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={() =>
                    runAction(async () => {
                      await onTransfer({
                        filaId: transferFilaId || undefined,
                        ownerId: transferOwnerId || undefined,
                      });
                      setDialog(null);
                    })
                  }
                  disabled={actionBusy || (!transferFilaId && !transferOwnerId)}
                  className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </div>
          )}

          {dialog === "close" && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Fechar atendimento</p>
              <input
                type="text"
                placeholder="Motivo (opcional)"
                value={closeMotivo}
                onChange={(e) => setCloseMotivo(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
              />
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setDialog(null)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={() =>
                    runAction(async () => {
                      await onClose(closeMotivo || undefined);
                      setDialog(null);
                    })
                  }
                  disabled={actionBusy}
                  className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  Confirmar fechamento
                </button>
              </div>
            </div>
          )}

          {dialog === "nota" && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-slate-700">Adicionar nota interna</p>
              <textarea
                rows={3}
                placeholder="Nota visivel so para a equipe"
                value={notaTexto}
                onChange={(e) => setNotaTexto(e.target.value)}
                className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
              />
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setDialog(null)}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-white"
                >
                  Cancelar
                </button>
                <button
                  onClick={() =>
                    runAction(async () => {
                      if (!notaTexto.trim()) return;
                      await onAddNota(notaTexto.trim());
                      setNotaTexto("");
                      setDialog(null);
                    })
                  }
                  disabled={actionBusy || !notaTexto.trim()}
                  className="rounded-lg bg-blue-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-50"
                >
                  Salvar nota
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto bg-slate-50 p-4">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
          </div>
        ) : (
          <>
            {mensagens.map((mensagem) => (
              <div
                key={mensagem.id}
                className={`flex ${mensagem.direction === "OUT" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    mensagem.direction === "OUT"
                      ? "bg-blue-700 text-white"
                      : "border border-slate-200 bg-white text-slate-800"
                  }`}
                >
                  <p className="whitespace-pre-wrap">{mensagem.body}</p>
                  <p
                    className={`mt-1 text-right text-[10px] ${
                      mensagem.direction === "OUT" ? "text-blue-100" : "text-slate-400"
                    }`}
                  >
                    {timeFormatter.format(new Date(mensagem.timestamp))}
                  </p>
                </div>
              </div>
            ))}

            {eventos.length > 0 && (
              <div className="space-y-1 pt-2">
                {eventos.map((evento) => (
                  <p key={evento.id} className="text-center text-[11px] text-slate-400">
                    {EVENTO_TIPO_LABELS[evento.tipo] ?? evento.tipo}
                    {evento.userName ? ` por ${evento.userName}` : ""}
                    {evento.detalhe ? ` - ${evento.detalhe}` : ""} ·{" "}
                    {timeFormatter.format(new Date(evento.createdAt))}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 p-3">
        <input
          type="text"
          placeholder={isFechado ? "Atendimento fechado" : "Digite uma mensagem..."}
          value={messageBody}
          disabled={isFechado || sending}
          onChange={(e) => setMessageBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSend();
          }}
          className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 disabled:bg-slate-50"
        />
        <button
          onClick={handleSend}
          disabled={isFechado || sending || !messageBody.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50"
          aria-label="Enviar"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
