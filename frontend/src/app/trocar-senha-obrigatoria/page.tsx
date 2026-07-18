// src/app/trocar-senha-obrigatoria/page.tsx
// Onboarding do Corretor: destino obrigatorio pos-login quando
// User.mustChangePassword = true (conta criada pelo Administrador com
// senha que o proprio corretor nunca escolheu - ver CreateCorretorUseCase).
// Fora do layout do dashboard (sem Sidebar/Topbar), mesmo padrao de
// /minha-conta. Login/`/` redirecionam pra ca antes de qualquer outra
// logica de role/cargo - ver login/page.tsx e app/page.tsx.
"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Loader2 } from "lucide-react";
import {
  apiRequest,
  ApiError,
  TOKEN_STORAGE_KEY,
  STATUS_DISPONIBILIDADE_STORAGE_KEY,
} from "@/core/api/client";
import { DASHBOARD_ROLES } from "@/core/constants/dashboardRoles";
import { ehCargoSupervisor } from "@/core/constants/cargoHierarquico";

interface Me {
  role: string;
  cargoHierarquico: string | null;
  mustChangePassword: boolean;
}

function destinoPosTroca(me: Me): string {
  if (!DASHBOARD_ROLES.includes(me.role)) return "/minha-conta";
  if (me.role !== "Administrador" && !ehCargoSupervisor(me.cargoHierarquico)) {
    return "/dashboard/inicio";
  }
  return "/dashboard/kanban";
}

export default function TrocarSenhaObrigatoriaPage() {
  const router = useRouter();
  const hasInitialized = useRef(false);

  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) {
      router.replace("/login");
      return;
    }

    apiRequest<Me>("/auth/me")
      .then((me) => {
        // Ja trocou (em outra aba, por exemplo) - nao ha mais nada pra fazer
        // aqui, manda direto pro destino certo.
        if (!me.mustChangePassword) {
          router.replace(destinoPosTroca(me));
          return;
        }
        setChecking(false);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  function handleLogout() {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    window.localStorage.removeItem(STATUS_DISPONIBILIDADE_STORAGE_KEY);
    router.push("/login");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (newPassword !== confirmNewPassword) {
      setError("A confirmação da nova senha não confere.");
      return;
    }
    if (newPassword.length < 6) {
      setError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setSaving(true);
    try {
      await apiRequest("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const me = await apiRequest<Me>("/auth/me");
      router.push(destinoPosTroca(me));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível trocar a senha.");
    } finally {
      setSaving(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <p className="text-sm">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-end border-b border-slate-200 bg-white px-6 py-4">
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-800"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </header>

      <div className="flex flex-1 items-center justify-center px-4">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Gestor de Vendas" className="mx-auto mb-4 w-[200px]" />
          <h1 className="mb-1 text-center text-base font-semibold text-slate-800">
            Defina sua nova senha
          </h1>
          <p className="mb-6 text-center text-sm text-slate-500">
            Por segurança, você precisa trocar a senha temporária antes de continuar.
          </p>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="mb-1 block text-sm text-slate-500">
                Senha temporária (recebida por e-mail)
              </label>
              <input
                id="currentPassword"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="newPassword" className="mb-1 block text-sm text-slate-500">
                Nova senha
              </label>
              <input
                id="newPassword"
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <div>
              <label htmlFor="confirmNewPassword" className="mb-1 block text-sm text-slate-500">
                Confirmar nova senha
              </label>
              <input
                id="confirmNewPassword"
                type="password"
                required
                minLength={6}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-blue-700 px-4 py-2 font-medium text-white transition hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Trocar senha e continuar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
