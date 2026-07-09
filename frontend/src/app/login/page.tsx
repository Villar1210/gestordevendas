// src/app/login/page.tsx
"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  apiRequest,
  ApiError,
  TOKEN_STORAGE_KEY,
  STATUS_DISPONIBILIDADE_STORAGE_KEY,
} from "@/core/api/client";
import { DASHBOARD_ROLES } from "@/core/constants/dashboardRoles";

interface LoginResponse {
  twoFactorRequired?: boolean;
  challengeId?: string;
  token?: string;
  user?: { id: string; name: string; email: string; role: string };
}

interface VerifyTwoFactorResponse {
  token: string;
  user: { id: string; name: string; email: string; role: string };
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [code, setCode] = useState("");

  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function goToDashboard(token: string, role: string) {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);

    // Roles sem acesso ao dashboard (Cliente, Imobiliaria Parceira) nunca
    // chegam a chamar rotas do dashboard - o backend so retornaria 403 -
    // vao direto para a area propria delas.
    if (!DASHBOARD_ROLES.includes(role)) {
      router.push("/minha-conta");
      return;
    }

    try {
      await apiRequest("/rh/me/status", {
        method: "PATCH",
        body: JSON.stringify({ status: "online" }),
      });
      window.localStorage.setItem(STATUS_DISPONIBILIDADE_STORAGE_KEY, "online");
    } catch {
      // Login ja foi bem-sucedido; falha aqui nao deve bloquear o acesso ao
      // dashboard - o corretor so aparecera como "offline" ate ajustar manualmente.
    }
    router.push("/dashboard/kanban");
  }

  async function handleLoginSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await apiRequest<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, rememberMe }),
      });

      if (result.twoFactorRequired && result.challengeId) {
        setChallengeId(result.challengeId);
      } else if (result.token && result.user) {
        goToDashboard(result.token, result.user.role);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Nao foi possivel fazer login.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyCodeSubmit(event: FormEvent) {
    event.preventDefault();
    if (!challengeId) return;

    setError(null);
    setLoading(true);

    try {
      const result = await apiRequest<VerifyTwoFactorResponse>("/auth/2fa/verify", {
        method: "POST",
        body: JSON.stringify({ challengeId, code }),
      });
      goToDashboard(result.token, result.user.role);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Codigo invalido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-800">gestordevendas</h1>
        <p className="mb-6 text-sm text-slate-500">
          {challengeId ? "Confirme o codigo enviado por e-mail" : "Entre na sua conta"}
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        {!challengeId ? (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm text-slate-500">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm text-slate-500">
                Senha
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-500">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-600"
              />
              Lembre-se de mim
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>

            <Link
              href="/forgot-password"
              className="block text-center text-sm text-indigo-600 hover:underline"
            >
              Esqueci minha senha
            </Link>

            <Link
              href="/cadastro"
              className="block text-center text-sm text-indigo-600 hover:underline"
            >
              Criar cadastro
            </Link>
          </form>
        ) : (
          <form onSubmit={handleVerifyCodeSubmit} className="space-y-4">
            <div>
              <label htmlFor="code" className="mb-1 block text-sm text-slate-500">
                Codigo de 6 digitos
              </label>
              <input
                id="code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-center text-lg tracking-widest text-slate-800 outline-none focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? "Verificando..." : "Confirmar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
