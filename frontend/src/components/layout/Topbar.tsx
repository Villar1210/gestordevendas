// src/components/layout/Topbar.tsx
"use client";

import { useEffect, useState } from "react";
import { LogOut, Menu } from "lucide-react";
import { apiRequest, logout, STATUS_DISPONIBILIDADE_STORAGE_KEY } from "@/core/api/client";
import {
  STATUS_DISPONIBILIDADE_OPTIONS,
  getStatusDisponibilidadeOption,
} from "@/features/equipe/constants";
import { NotificationBell } from "./NotificationBell";

interface Me {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface TopbarProps {
  // Abre o menu lateral no celular (botao so aparece abaixo de md).
  onOpenMenu?: () => void;
}

export function Topbar({ onOpenMenu }: TopbarProps) {
  const [me, setMe] = useState<Me | null>(null);
  const [status, setStatus] = useState("offline");

  useEffect(() => {
    apiRequest<Me>("/auth/me")
      .then(setMe)
      .catch(() => setMe(null));

    const savedStatus = window.localStorage.getItem(STATUS_DISPONIBILIDADE_STORAGE_KEY);
    if (savedStatus) setStatus(savedStatus);
  }, []);

  async function handleStatusChange(newStatus: string) {
    const previousStatus = status;
    setStatus(newStatus);
    try {
      await apiRequest("/rh/me/status", {
        method: "PATCH",
        body: JSON.stringify({ status: newStatus }),
      });
      window.localStorage.setItem(STATUS_DISPONIBILIDADE_STORAGE_KEY, newStatus);
    } catch {
      setStatus(previousStatus);
    }
  }

  function handleLogout() {
    logout();
  }

  const statusOption = getStatusDisponibilidadeOption(status);

  return (
    <header className="flex h-16 items-center justify-end gap-2 border-b border-slate-200 bg-white px-3 sm:gap-4 sm:px-6">
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Abrir menu"
        aria-controls="menu-principal"
        className="mr-auto rounded-lg p-2 text-slate-600 hover:bg-slate-100 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <NotificationBell />

      <div className="relative flex items-center gap-2 rounded-lg border border-slate-200 pl-3 pr-1 py-1.5">
        <span className={`h-2.5 w-2.5 rounded-full ${statusOption.dotClassName}`} />
        <select
          value={status}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="cursor-pointer appearance-none bg-transparent pr-4 text-sm font-medium text-slate-600 outline-none"
          aria-label="Meu status de disponibilidade"
        >
          {STATUS_DISPONIBILIDADE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {me && (
        <div className="hidden text-right leading-tight sm:block">
          <p className="text-sm font-medium text-slate-800">{me.name}</p>
          <p className="text-xs text-slate-500">{me.email}</p>
        </div>
      )}

      <button
        onClick={handleLogout}
        aria-label="Sair"
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
      >
        <LogOut className="h-4 w-4" />
        <span className="hidden sm:inline">Sair</span>
      </button>
    </header>
  );
}
