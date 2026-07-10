// src/app/dashboard/whatsapp/page.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, MessageCircle } from "lucide-react";
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

const POLL_INTERVAL_MS = 3000;

export default function WhatsAppPage() {
  const [session, setSession] = useState<WhatsAppSession | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viviLoading, setViviLoading] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling(sessionId: string) {
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
          return;
        }

        const qrResult = await apiRequest<{ qr: string | null }>(
          `/whatsapp/sessions/${sessionId}/qr`,
        );
        setQr(qrResult.qr);
      } catch {
        stopPolling();
      }
    }, POLL_INTERVAL_MS);
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        const current = await apiRequest<WhatsAppSession | null>("/whatsapp/sessions/me");
        setSession(current);

        if (current && current.status !== "DISCONNECTED" && current.status !== "CONNECTED") {
          startPolling(current.id);
        }
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
      startPolling(newSession.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel conectar.");
    } finally {
      setConnecting(false);
    }
  }

  async function handleDisconnect() {
    if (!session) return;
    setError(null);
    try {
      await apiRequest(`/whatsapp/sessions/${session.id}`, { method: "DELETE" });
      setSession({ ...session, status: "DISCONNECTED", phoneNumber: null });
      setQr(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel desconectar.");
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
  const isConnecting = Boolean(session) && !isConnected && session?.status !== "DISCONNECTED";

  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50">
          <MessageCircle className="h-6 w-6 text-amber-600" />
        </div>
        <h1 className="mb-1 text-lg font-semibold text-slate-800">WhatsApp</h1>

        {loading ? (
          <div className="flex flex-col items-center gap-2 py-8 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
            <p className="text-sm">Carregando...</p>
          </div>
        ) : error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        ) : isConnected ? (
          <>
            <p className="mb-4 text-sm text-slate-500">Sua conexao esta ativa</p>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-green-50 px-4 py-1.5 text-sm font-medium text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              Conectado{session?.phoneNumber ? ` - ${session.phoneNumber}` : ""}
            </div>

            <div className="mb-6 flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-left">
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
                  session?.isAiEnabled ? "bg-amber-600" : "bg-slate-200"
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
              className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Desconectar
            </button>
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
                className="mx-auto mb-4 h-56 w-56 rounded-lg border border-slate-200"
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
              className="w-full rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-800 disabled:opacity-60"
            >
              {connecting ? "Conectando..." : "Conectar WhatsApp"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
