// src/app/dashboard/whatsapp/page.tsx
// Tela de gerenciamento da CONEXAO com o WhatsApp (QR/status/desconectar) -
// deliberadamente sem nenhuma UI de chat/mensagens (isso e escopo da
// Central de Atendimento, /dashboard/atendimento). Identidade visual verde
// (inspirada no WhatsApp) e uma excecao ISOLADA a esta tela - o resto do
// projeto continua azul (ver CLAUDE.md, "Diretriz de design: identidade
// visual"). #25D366 e o mesmo verde ja usado como "selo de canal WhatsApp"
// em AtendimentoChatPanel.tsx/AtendimentoList.tsx.
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Loader2,
  MessageCircle,
  AlertTriangle,
  Inbox,
  Headset,
  ArrowRight,
} from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";

interface WhatsAppSession {
  id: string;
  tenantId: string;
  ownerUserId: string | null;
  label: string;
  status: string;
  phoneNumber: string | null;
  isAiEnabled: boolean;
}

const QR_POLL_INTERVAL_MS = 3000;
// Poll mais espacado para o estado ja conectado (so confirma que continua
// conectado + atualiza as metricas) - mesmo padrao de 5s ja usado em
// /dashboard/atendimento e no NotificationBell.
const CONNECTED_POLL_INTERVAL_MS = 5000;

export default function WhatsAppPage() {
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viviLoading, setViviLoading] = useState(false);
  const [atendendoCount, setAtendendoCount] = useState<number | null>(null);
  const [aguardandoCount, setAguardandoCount] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  // Metricas "conversas ativas/aguardando" (Fatia WhatsApp verde) -
  // reaproveita GET /atendimentos, o MESMO endpoint que a Central de
  // Atendimento ja usa para montar suas proprias abas (AtendimentoList.tsx
  // calcula a contagem no client de forma identica). Sem endpoint novo.
  // Os numeros refletem o escopo RBAC do usuario logado (decisao
  // confirmada) - um Corretor ve a propria carga, nao o total do tenant.
  async function loadAtendimentoCounts() {
    try {
      const atendimentos = await apiRequest<{ status: string }[]>("/atendimentos");
      setAtendendoCount(atendimentos.filter((a) => a.status === "em_atendimento").length);
      setAguardandoCount(atendimentos.filter((a) => a.status === "aguardando").length);
    } catch {
      // Metricas sao um extra informativo - falha aqui nao deve quebrar a
      // tela de conexao.
    }
  }

  function startQrPolling(sessionId: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const status = await apiRequest<WhatsAppSession>(
          `/whatsapp/sessions/${sessionId}/status`,
        );
        setSession(status);

        if (status.status === "CONNECTED") {
          stopPolling();
          setQr(null);
          startConnectedPolling(sessionId);
          loadAtendimentoCounts();
          return;
        }

        const qrResult = await apiRequest<{ qr: string | null }>(
          `/whatsapp/sessions/${sessionId}/qr`,
        );
        setQr(qrResult.qr);
      } catch {
        stopPolling();
      }
    }, QR_POLL_INTERVAL_MS);
  }

  // Poll leve do estado ja conectado - so para detectar RECONNECTING/queda
  // em tempo real (ex: processo reiniciou, Baileys caiu) e manter as
  // metricas atualizadas. Continua rodando indefinidamente enquanto a
  // pagina estiver aberta (nao para sozinho, ao contrario do poll de QR).
  function startConnectedPolling(sessionId: string) {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const status = await apiRequest<WhatsAppSession>(
          `/whatsapp/sessions/${sessionId}/status`,
        );
        setSession(status);
        if (status.status === "DISCONNECTED") {
          stopPolling();
          return;
        }
        loadAtendimentoCounts();
      } catch {
        // Falha de rede pontual - o proximo tick tenta de novo, nao para o poll.
      }
    }, CONNECTED_POLL_INTERVAL_MS);
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const current = await apiRequest<WhatsAppSession | null>("/whatsapp/sessions/me");
        setSession(current);

        if (current?.status === "CONNECTED") {
          startConnectedPolling(current.id);
          loadAtendimentoCounts();
        } else if (current && current.status !== "DISCONNECTED") {
          startQrPolling(current.id);
        }
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Nao foi possivel carregar a conexao.");
      } finally {
        setLoading(false);
      }
    }

    init();
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConnect() {
    setError(null);
    setConnecting(true);
    try {
      const newSession = await apiRequest<WhatsAppSession>("/whatsapp/sessions", {
        method: "POST",
        body: JSON.stringify({ label: "WhatsApp Principal" }),
      });
      setSession(newSession);
      startQrPolling(newSession.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel conectar.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!session) return;
    const confirmado = window.confirm(
      session.phoneNumber
        ? `Desconectar o WhatsApp (${session.phoneNumber})? Voce vai precisar escanear o QR Code de novo para reconectar (ou trocar de numero).`
        : "Desconectar o WhatsApp? Voce vai precisar escanear o QR Code de novo para reconectar.",
    );
    if (!confirmado) return;

    setError(null);
    setDisconnecting(true);
    try {
      stopPolling();
      await apiRequest(`/whatsapp/sessions/${session.id}`, { method: "DELETE" });
      setSession({ ...session, status: "DISCONNECTED", phoneNumber: null });
      setQr(null);
      setAtendendoCount(null);
      setAguardandoCount(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel desconectar.");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleToggleVivi() {
    if (!session) return;
    setError(null);
    setViviLoading(true);
    const nextEnabled = !session.isAiEnabled;
    try {
      await apiRequest(
        `/whatsapp/sessions/${session.id}/vivi/${nextEnabled ? "enable" : "disable"}`,
        { method: "POST" },
      );
      setSession({ ...session, isAiEnabled: nextEnabled });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel atualizar a VIVI.");
    } finally {
      setViviLoading(false);
    }
  }

  const isConnected = session?.status === "CONNECTED";
  // "RECONNECTING" e um valor so-de-resposta do backend (nunca gravado no
  // banco): o banco ainda diz CONNECTED, mas o socket Baileys em memoria
  // nao esta aberto agora (ex: logo apos um restart do processo, antes da
  // reconexao automatica terminar) - ver GetMyWhatsAppSessionUseCase.
  const isReconnecting = session?.status === "RECONNECTING";
  const isConnecting =
    Boolean(session) && !isConnected && !isReconnecting && session?.status !== "DISCONNECTED";

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-emerald-100 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#25D366]/10">
          <MessageCircle className="h-6 w-6 text-[#25D366]" />
        </div>
        <h1 className="mb-1 text-lg font-semibold text-slate-800">WhatsApp</h1>

        {loading ? (
          <div className="flex flex-col items-center gap-2 py-8 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-[#25D366]" />
            <p className="text-sm">Carregando...</p>
          </div>
        ) : error ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-600">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        ) : isConnected ? (
          <>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#25D366]/10 px-4 py-1.5 text-sm font-medium text-[#0F7A3D]">
              <CheckCircle2 className="h-4 w-4" />
              Conectado{session?.phoneNumber ? ` - ${session.phoneNumber}` : ""}
            </div>

            {/* Metricas resumidas - reaproveita GET /atendimentos, escopo
                RBAC do usuario logado (decisao confirmada). */}
            <div className="mb-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="mb-1 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500">
                  <Headset className="h-3.5 w-3.5" /> Em atendimento
                </div>
                <p className="text-2xl font-semibold text-slate-800">{atendendoCount ?? "-"}</p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="mb-1 flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500">
                  <Inbox className="h-3.5 w-3.5" /> Aguardando
                </div>
                <p className="text-2xl font-semibold text-slate-800">{aguardandoCount ?? "-"}</p>
              </div>
            </div>

            <Link
              href="/dashboard/atendimento"
              className="mb-5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1FB959]"
            >
              Ver conversas <ArrowRight className="h-4 w-4" />
            </Link>

            <div className="mb-5 flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left">
              <div>
                <p className="text-sm font-medium text-slate-700">VIVI (Assistente de IA)</p>
                <p className="text-xs text-slate-400">Responde automaticamente novos leads</p>
              </div>
              <button
                onClick={handleToggleVivi}
                disabled={viviLoading}
                role="switch"
                aria-checked={session?.isAiEnabled}
                className={`relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 ${
                  session?.isAiEnabled ? "bg-[#25D366]" : "bg-slate-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    session?.isAiEnabled ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {disconnecting ? "Desconectando..." : "Desconectar / Trocar numero"}
            </button>
          </>
        ) : isReconnecting ? (
          <>
            <p className="mb-4 text-sm text-slate-500">
              O servidor reiniciou e esta restabelecendo a conexao com o WhatsApp
              automaticamente. Nao e necessario escanear o QR Code de novo.
            </p>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-1.5 text-sm font-medium text-amber-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              Reconectando...
            </div>
          </>
        ) : isConnecting ? (
          <>
            <p className="mb-4 text-sm text-slate-500">
              Escaneie o QR Code no seu WhatsApp para conectar
            </p>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="QR Code do WhatsApp"
                className="mx-auto mb-4 h-56 w-56 rounded-lg border-2 border-[#25D366]/30 p-1"
              />
            ) : (
              <div className="mx-auto mb-4 flex h-56 w-56 items-center justify-center rounded-lg border border-slate-200 text-slate-400">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            )}
          </>
        ) : (
          <>
            <p className="mb-6 text-sm text-slate-500">
              Conecte o WhatsApp da imobiliaria para comecar a atender pelo CRM
            </p>
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="w-full rounded-lg bg-[#25D366] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#1FB959] disabled:opacity-60"
            >
              {connecting ? "Conectando..." : "Conectar WhatsApp"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
