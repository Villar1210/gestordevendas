// src/components/layout/NotificationBell.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { apiRequest } from "@/core/api/client";

interface Notification {
  id: string;
  tipo: string;
  mensagem: string;
  link: string | null;
  lida: boolean;
  createdAt: string;
}

const POLL_INTERVAL_MS = 5000; // mesmo padrao ja usado em /dashboard/atendimento

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export function NotificationBell() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function loadNotifications() {
    apiRequest<Notification[]>("/notificacoes")
      .then(setNotifications)
      .catch(() => {});
  }

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const naoLidas = notifications.filter((n) => !n.lida).length;

  async function handleClickNotification(notification: Notification) {
    if (!notification.lida) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, lida: true } : n)),
      );
      apiRequest(`/notificacoes/${notification.id}/marcar-lida`, { method: "PATCH" }).catch(() => {});
    }
    setIsOpen(false);
    if (notification.link) {
      router.push(notification.link);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        data-testid="notification-bell"
        className="relative flex items-center justify-center rounded-lg p-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
        aria-label="Notificações"
      >
        <Bell className="h-5 w-5" />
        {naoLidas > 0 && (
          <span
            data-testid="notification-count"
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white"
          >
            {naoLidas > 9 ? "9+" : naoLidas}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          data-testid="notification-dropdown"
          className="absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-lg"
        >
          <div className="border-b border-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800">
            Notificações
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-400">Nenhuma notificação ainda.</p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleClickNotification(notification)}
                  data-testid="notification-item"
                  className={`flex w-full flex-col gap-0.5 border-b border-slate-50 px-4 py-3 text-left text-sm transition hover:bg-slate-50 ${
                    notification.lida ? "text-slate-500" : "font-medium text-slate-800"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {!notification.lida && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />}
                    {notification.mensagem}
                  </span>
                  <span className="text-xs text-slate-400">
                    {dateFormatter.format(new Date(notification.createdAt))}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
