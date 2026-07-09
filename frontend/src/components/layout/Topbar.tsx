// src/components/layout/Topbar.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { apiRequest, TOKEN_STORAGE_KEY, STATUS_DISPONIBILIDADE_STORAGE_KEY } from "@/core/api/client";
import {
  STATUS_DISPONIBILIDADE_OPTIONS,
  getStatusDisponibilidadeOption,
} from "@/features/equipe/constants";

interface Me {
  id: string;
  name: string;
  email: string;
  role: string;
}

export function Topbar() {
  const router = useRouter();
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
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(STATUS_DISPONIBILIDADE_STORAGE_KEY);
    router.push("/login");
  }

  const statusOption = getStatusDisponibilidadeOption(status);

  return (
    <header className="flex h-16 items-center justify-end gap-4 border-b border-slate-200 bg-white px-6">
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
        <div className="text-right leading-tight">
          <p className="text-sm font-medium text-slate-800">{me.name}</p>
          <p className="text-xs text-slate-500">{me.email}</p>
        </div>
      )}

      <button
        onClick={handleLogout}
        className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800"
      >
        <LogOut className="h-4 w-4" />
        Sair
      </button>
    </header>
  );
}
