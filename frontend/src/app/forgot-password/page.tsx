// src/app/forgot-password/page.tsx
"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";

function mensagemDeErro(err: unknown): string {
  if (err instanceof ApiError) {
    return err.status === 429
      ? "Muitos pedidos seguidos. Aguarde alguns minutos e tente de novo."
      : err.message;
  }
  if (err instanceof TypeError) {
    return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
  }
  return "Não foi possível enviar o link. Tente novamente.";
}

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
        body: JSON.stringify({ email: email.trim() }),
      });
      setSuccess(true);
    } catch (err) {
      setError(mensagemDeErro(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Gestor de Vendas" className="mx-auto mb-4 w-[200px]" />
        <h1 className="text-center text-lg font-semibold text-slate-800">Esqueci minha senha</h1>

        {success ? (
          <div className="mt-6 space-y-4">
            <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <MailCheck className="mb-2 h-6 w-6 text-green-600" aria-hidden />
              <p className="font-medium">Verifique seu e-mail.</p>
              <p className="mt-1">
                Se <strong>{email.trim()}</strong> tiver cadastro, você vai receber um link para criar uma nova senha.
                Ele vale por 15 minutos.
              </p>
              <p className="mt-2 text-green-700">Não chegou? Confira a caixa de spam ou lixo eletrônico.</p>
            </div>
            <Link href="/login" className="block text-center text-sm text-blue-700 hover:underline">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-2 space-y-4">
            <p className="text-center text-sm text-slate-500">
              Informe o e-mail da sua conta e enviaremos um link para você criar uma nova senha.
            </p>
            {error && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}
            <div>
              <label htmlFor="email" className="mb-1 block text-sm text-slate-600">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                maxLength={150}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-700 px-4 py-2 font-medium text-white transition hover:bg-blue-800 disabled:opacity-60"
            >
              {loading ? "Enviando..." : "Enviar link"}
            </button>
            <Link href="/login" className="block text-center text-sm text-blue-700 hover:underline">
              Voltar para o login
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
