// src/app/forgot-password/page.tsx
"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { apiRequest, ApiError } from "@/core/api/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await apiRequest("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Nao foi possivel enviar o link. Tente novamente.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-800">gestordevendas</h1>
        <p className="mb-6 text-sm text-slate-500">Recupere o acesso a sua conta</p>

        {success ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              Se esse e-mail existir em nossa base, um link de redefinicao foi enviado.
            </div>
            <Link href="/login" className="block text-center text-sm text-indigo-600 hover:underline">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}

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

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? "Enviando..." : "Enviar link de redefinicao"}
            </button>

            <Link href="/login" className="block text-center text-sm text-indigo-600 hover:underline">
              Voltar para o login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
