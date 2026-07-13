// src/features/atendimento/components/AtendimentoChatPanel.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import {
  Send,
  UserCheck,
  ArrowLeftRight,
  Undo2,
  CheckCircle2,
  StickyNote,
  Headset,
  Loader2,
  History,
  X,
  MessageCircle,
  Smile,
  Paperclip,
  Image as ImageIcon,
  FileText,
  Contact2,
  Mic,
} from "lucide-react";
import { Atendimento, AtendimentoEvento, AtendimentoMensagem, Fila } from "../store/useAtendimentoStore";
import { getStatusOption, EVENTO_TIPO_LABELS, filaChipStyle } from "../constants";
import { formatPhoneDisplay, initialsFromPhone, formatDayHeader } from "../format";

const timeFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

// Padrao sutil de fundo (losangos), estilo WhatsApp Web - SVG inline via
// data-uri, sem imagem externa. Aplicado numa camada propria com
// opacity-5 (Tailwind), nao no container das bolhas, para nao desbotar o
// texto das mensagens junto com o padrao.
const CHAT_BG_PATTERN =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='48' height='48'%3E%3Cpath d='M24 0 L48 24 L24 48 L0 24 Z' fill='none' stroke='%23334155' stroke-width='1.2'/%3E%3C/svg%3E";

// Grade estatica de emojis comuns (8 colunas) - sem dependencia nova
// (emoji-mart nao esta instalado no projeto, ver constatacao desta fatia).
const COMMON_EMOJIS = [
  "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😜",
  "🤔", "😅", "😢", "😭", "😡", "👍", "👎", "🙏",
  "👏", "🙌", "💪", "🔥", "❤️", "💙", "💚", "💛",
  "🎉", "✅", "❌", "⚠️", "📌", "⏰", "👋", "🙂",
];

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
  // Historico: atendimentos anteriores do mesmo numero, ja calculados pelo
  // componente pai a partir da lista completa ja carregada (sem endpoint
  // dedicado no backend - filtro client-side, ver page.tsx).
  historico: Atendimento[];
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
  historico,
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
  const [showHistory, setShowHistory] = useState(false);
  // Composer (Fatia 4): nota privada usa o MESMO endpoint /nota ja usado
  // pelo dialogo do header (POST /atendimentos/:id/nota) - so troca qual
  // handler o botao "enviar" do rodape chama. Emoji e um grid estatico
  // (sem lib nova). Anexos e audio NAO tem endpoint de midia no backend
  // hoje (confirmado por busca no codigo antes de implementar) - ficam
  // desabilitados com tooltip "em breve" em vez de inventar upload que
  // nao teria pra onde ir.
  const [noteMode, setNoteMode] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [mensagens.length]);

  useEffect(() => {
    setDialog(null);
    setTransferFilaId("");
    setTransferOwnerId("");
    setCloseMotivo("");
    setNotaTexto("");
    setShowHistory(false);
    setNoteMode(false);
    setShowEmoji(false);
    setShowAttach(false);
  }, [atendimento?.id]);

  // ESC fecha o painel de historico.
  useEffect(() => {
    if (!showHistory) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setShowHistory(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showHistory]);

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
  const isAguardando = atendimento.status === "aguardando";
  const statusOption = getStatusOption(atendimento.status);
  const displayName = formatPhoneDisplay(atendimento.phoneNumber);
  const initials = initialsFromPhone(atendimento.phoneNumber);

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
      if (noteMode) {
        await onAddNota(body);
      } else {
        await onSendMessage(body);
      }
      setMessageBody("");
      setShowEmoji(false);
    } finally {
      setSending(false);
      requestAnimationFrame(() => messageInputRef.current?.focus());
    }
  }

  // Insere o emoji na posicao do cursor (nao so no final do texto).
  function insertEmoji(emoji: string) {
    const input = messageInputRef.current;
    if (!input) {
      setMessageBody((prev) => prev + emoji);
      return;
    }
    const start = input.selectionStart ?? messageBody.length;
    const end = input.selectionEnd ?? messageBody.length;
    const next = messageBody.slice(0, start) + emoji + messageBody.slice(end);
    setMessageBody(next);
    requestAnimationFrame(() => {
      input.focus();
      const pos = start + emoji.length;
      input.setSelectionRange(pos, pos);
    });
  }

  // Agrupamento por dia das mensagens (separador central "Hoje"/"Ontem"/
  // data), calculado inline no proprio render - mesma tecnica usada no
  // wacalls-chat estudado como referencia (lastDay comparado a cada item).
  let lastDay = "";

  return (
    <div className="relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
        <div className="relative shrink-0">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
            {initials}
          </span>
          <span
            aria-label="WhatsApp"
            title="WhatsApp"
            className="absolute -bottom-0.5 -right-0.5 grid h-3.5 w-3.5 place-items-center rounded-full bg-[#25D366] text-white ring-2 ring-white"
          >
            <MessageCircle className="h-2 w-2" fill="currentColor" strokeWidth={0} />
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-slate-800">{displayName}</p>
            {atendimento.filaNome && (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={filaChipStyle(atendimento.filaNome)}
              >
                {atendimento.filaNome}
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${statusOption.badgeClassName}`}>
              {statusOption.label}
            </span>
            {atendimento.ownerName && (
              <span className="text-[11px] text-slate-400">com {atendimento.ownerName}</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {!isFechado && isAguardando && (
            <HeaderAction tone="success" label="Aceitar" disabled={actionBusy} onClick={() => runAction(onAssign)}>
              <UserCheck className="h-3.5 w-3.5" />
            </HeaderAction>
          )}
          {!isFechado && (
            <HeaderAction tone="indigo" label="Transferir" disabled={actionBusy} onClick={() => setDialog("transfer")}>
              <ArrowLeftRight className="h-3.5 w-3.5" />
            </HeaderAction>
          )}
          {atendimento.status === "em_atendimento" && (isOwner || isAdmin) && (
            <HeaderAction tone="muted" label="Devolver" disabled={actionBusy} onClick={() => runAction(onRequeue)}>
              <Undo2 className="h-3.5 w-3.5" />
            </HeaderAction>
          )}
          {!isFechado && (
            <HeaderAction tone="rose" label="Finalizar" disabled={actionBusy} onClick={() => setDialog("close")}>
              <CheckCircle2 className="h-3.5 w-3.5" />
            </HeaderAction>
          )}
          <HeaderAction tone="muted" label="Nota" disabled={actionBusy} onClick={() => setDialog("nota")}>
            <StickyNote className="h-3.5 w-3.5" />
          </HeaderAction>
          <HeaderAction
            tone="muted"
            label="Historico"
            active={showHistory}
            onClick={() => setShowHistory((v) => !v)}
          >
            <History className="h-3.5 w-3.5" />
          </HeaderAction>
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

      <div ref={scrollRef} className="relative flex-1 overflow-y-auto bg-slate-50">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-5"
          style={{ backgroundImage: `url("${CHAT_BG_PATTERN}")`, backgroundSize: "48px 48px" }}
        />
        <div className="relative z-10 space-y-2 p-4">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
            </div>
          ) : (
            <>
              {isAguardando && (
                <div className="mb-1 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2 text-center text-xs text-amber-700">
                  Aceite este atendimento para enviar mensagens.
                </div>
              )}

              {mensagens.map((mensagem) => {
                const day = formatDayHeader(mensagem.timestamp);
                const showDay = day !== lastDay;
                lastDay = day;
                return (
                  <div key={mensagem.id} className="flex flex-col">
                    {showDay && (
                      <div className="my-2 self-center rounded-full bg-white px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-400 shadow-sm">
                        {day}
                      </div>
                    )}
                    <div className={`flex ${mensagem.direction === "OUT" ? "justify-end" : "justify-start"}`}>
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
                  </div>
                );
              })}

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
      </div>

      <div className="border-t border-slate-100">
        {showEmoji && (
          <div className="border-b border-slate-100 p-2">
            <div className="grid grid-cols-8 gap-1">
              {COMMON_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => insertEmoji(emoji)}
                  className="rounded-md p-1.5 text-lg leading-none hover:bg-slate-100"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}

        {noteMode && (
          <div className="flex items-center gap-1.5 bg-amber-50 px-3 py-1.5 text-[11px] font-medium text-amber-700">
            <StickyNote className="h-3 w-3" /> Nota privada — nao sera enviada ao contato
          </div>
        )}

        <div className="flex items-center gap-1.5 p-3">
          <button
            type="button"
            title={noteMode ? "Nota privada ATIVA (clique para desativar)" : "Nota privada (nao enviada ao contato)"}
            onClick={() => setNoteMode((v) => !v)}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
              noteMode ? "bg-amber-100 text-amber-700" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            }`}
          >
            <StickyNote className="h-4 w-4" />
          </button>

          <button
            type="button"
            title="Emojis"
            onClick={() => {
              setShowAttach(false);
              setShowEmoji((v) => !v);
            }}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
              showEmoji ? "bg-blue-100 text-blue-700" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            }`}
          >
            <Smile className="h-4 w-4" />
          </button>

          <div className="relative shrink-0">
            <button
              type="button"
              title="Anexar"
              onClick={() => {
                setShowEmoji(false);
                setShowAttach((v) => !v);
              }}
              className={`flex h-9 w-9 items-center justify-center rounded-lg transition ${
                showAttach ? "bg-blue-100 text-blue-700" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              }`}
            >
              <Paperclip className="h-4 w-4" />
            </button>
            {showAttach && (
              <div className="absolute bottom-full left-0 z-20 mb-2 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                <AttachItem
                  icon={<ImageIcon className="h-4 w-4" />}
                  label="Imagem / Video"
                  tooltip="Em breve - upload de midia ainda nao suportado pelo backend"
                />
                <AttachItem
                  icon={<FileText className="h-4 w-4" />}
                  label="Documento"
                  tooltip="Em breve - upload de midia ainda nao suportado pelo backend"
                />
                <AttachItem
                  icon={<Contact2 className="h-4 w-4" />}
                  label="Contato"
                  tooltip="Em breve - envio de contato ainda nao suportado pelo backend"
                />
              </div>
            )}
          </div>

          <button
            type="button"
            title="Gravar audio (em breve - sem endpoint de midia no backend)"
            disabled
            aria-label="Gravar audio"
            className="flex h-9 w-9 shrink-0 cursor-not-allowed items-center justify-center rounded-lg text-slate-300"
          >
            <Mic className="h-4 w-4" />
          </button>

          <input
            ref={messageInputRef}
            type="text"
            placeholder={
              noteMode
                ? "Nota privada (visivel so para a equipe)"
                : isFechado
                  ? "Atendimento fechado"
                  : "Digite uma mensagem..."
            }
            value={messageBody}
            disabled={(!noteMode && isFechado) || sending}
            onChange={(e) => setMessageBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSend();
            }}
            className={`flex-1 rounded-lg border px-3 py-2 text-sm outline-none disabled:bg-slate-50 ${
              noteMode
                ? "border-amber-300 bg-amber-50 text-amber-900 focus:border-amber-500"
                : "border-slate-200 text-slate-800 focus:border-blue-600"
            }`}
          />
          <button
            onClick={handleSend}
            disabled={(!noteMode && isFechado) || sending || !messageBody.trim()}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white disabled:opacity-50 ${
              noteMode ? "bg-amber-600 hover:bg-amber-700" : "bg-blue-700 hover:bg-blue-800"
            }`}
            aria-label="Enviar"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {showHistory && (
        <>
          <div
            className="absolute inset-0 z-10 bg-slate-900/10"
            onClick={() => setShowHistory(false)}
            aria-hidden
          />
          <aside className="absolute right-0 top-0 z-20 flex h-full w-80 flex-col border-l border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                <History className="h-4 w-4" /> Historico do numero
              </div>
              <button
                onClick={() => setShowHistory(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              {historico.length === 0 ? (
                <p className="text-xs text-slate-400">Nenhum atendimento anterior deste numero.</p>
              ) : (
                <ul className="space-y-2">
                  {historico.map((h) => {
                    const hStatus = getStatusOption(h.status);
                    return (
                      <li key={h.id} className="rounded-lg border border-slate-200 p-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${hStatus.badgeClassName}`}>
                            {hStatus.label}
                          </span>
                          <span className="text-[10px] text-slate-400">
                            {timeFormatter.format(new Date(h.createdAt))}
                          </span>
                        </div>
                        {h.filaNome && (
                          <span
                            className="mt-1.5 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold"
                            style={filaChipStyle(h.filaNome)}
                          >
                            {h.filaNome}
                          </span>
                        )}
                        {h.motivoFechamento && (
                          <p className="mt-1.5 text-[11px] text-slate-500">Motivo: {h.motivoFechamento}</p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}

// HeaderAction: botao de acao do header com icone+label, cor semantica por
// "tone" - mesma familia de cores do RowAction (Fatia 2), adaptada ao
// formato maior (com texto) ja usado neste painel.
type HeaderTone = "success" | "indigo" | "rose" | "muted";
const HEADER_TONE_CLASSES: Record<HeaderTone, string> = {
  success: "bg-emerald-500 text-white border-transparent hover:bg-emerald-600",
  indigo: "bg-indigo-500/15 text-indigo-600 border-indigo-500/30 hover:bg-indigo-500/25",
  rose: "bg-rose-500 text-white border-transparent hover:bg-rose-600",
  muted: "border-slate-200 text-slate-600 hover:bg-slate-50",
};

function HeaderAction({
  tone,
  label,
  onClick,
  children,
  disabled,
  active,
}: {
  tone: HeaderTone;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
        active ? "border-blue-200 bg-blue-100 text-blue-700" : HEADER_TONE_CLASSES[tone]
      }`}
    >
      {children} {label}
    </button>
  );
}

// AttachItem: item do dropdown de anexos. Sempre desabilitado nesta fatia -
// nao existe endpoint de upload de midia no backend hoje (whatsappmarketing
// e atendimento so tem envio de TEXTO - ver SendWhatsAppMessageUseCase) -
// confirmado por busca no codigo antes de implementar, conforme pedido.
function AttachItem({ icon, label, tooltip }: { icon: React.ReactNode; label: string; tooltip: string }) {
  return (
    <button
      type="button"
      disabled
      title={tooltip}
      className="flex w-full cursor-not-allowed items-center gap-2 px-3 py-2 text-left text-sm text-slate-300"
    >
      <span className="text-slate-300">{icon}</span>
      {label}
      <span className="ml-auto rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">
        Em breve
      </span>
    </button>
  );
}
