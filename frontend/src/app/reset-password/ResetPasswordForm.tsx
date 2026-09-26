// src/app/reset-password/ResetPasswordForm.tsx
"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";

// Mesmas regras do backend (ResetPasswordDto).
const MIN = 8;
const MAX = 72;
const TOKEN_VALIDO = /^[a-f0-9]{64}$/;

interface Props {
  token: string | null;
}

function mensagemDeErro(err: unknown): string {
  if (err instanceof ApiError) {
    return err.status === 429 ? "Muitas tentativas seguidas. Aguarde alguns minutos." : err.message;
  }
  if (err instanceof TypeError) {
    return "Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.";
  }
  return "Não foi possível redefinir a senha.";
}

export function ResetPasswordForm({ token }: Props) {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const linkValido = token !== null && TOKEN_VALIDO.test(token);
  const curta = newPassword.length > 0 && newPassword.length < MIN;
  const diferentes = confirmPassword.length > 0 && confirmPassword !== newPassword;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (newPassword.length < MIN) return setError(`A senha deve ter pelo menos ${MIN} caracteres.`);
    if (newPassword !== confirmPassword) return setError("As senhas não coincidem.");

    setLoading(true);
    try {
      await apiRequest("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, newPassword }),
      });
      setSuccess(true);
    } catch (err) {
      setError(mensagemDeErro(err));
    } finally {
      setLoading(false);
    }
  }

  const campo =
    "w-full rounded-lg border border-slate-200 px-3 py-2 pr-10 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Gestor de Vendas" className="mx-auto mb-4 w-[200px]" />
        <h1 className="mb-6 text-center text-lg font-semibold text-slate-800">Criar nova senha</h1>

        {!linkValido ? (
          <div className="space-y-4">
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
              Este link é inválido ou está incompleto. Peça um novo e-mail de redefinição.
            </div>
            <Link href="/forgot-password" className="block text-center text-sm text-blue-700 hover:underline">
              Pedir novo link
            </Link>
          </div>
        ) : success ? (
          <div className="space-y-4">
            <div role="status" className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
              <CheckCircle2 className="mb-2 h-6 w-6 text-green-600" aria-hidden />
              <p className="font-medium">Senha alterada!</p>
              <p className="mt-1">Por segurança, você foi desconectado dos outros aparelhos. Entre com a nova senha.</p>
            </div>
            <button
              onClick={() => router.push("/login")}
              className="w-full rounded-lg bg-blue-700 px-4 py-2 font-medium text-white transition hover:bg-blue-800"
            >
              Ir para o login
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {error && (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
                {error.includes("inválido") && (
                  <Link href="/forgot-password" className="mt-1 block font-medium underline">
                    Pedir novo link
                  </Link>
                )}
              </div>
            )}

            <div>
              <label htmlFor="newPassword" className="mb-1 block text-sm text-slate-600">
                Nova senha
              </label>
              <div className="relative">
                <input
                  id="newPassword"
                  type={mostrar ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  autoFocus
                  minLength={MIN}
                  maxLength={MAX}
                  aria-describedby="regra-senha"
                  aria-invalid={curta || undefined}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={campo}
                />
                <button
                  type="button"
                  onClick={() => setMostrar((v) => !v)}
                  aria-label={mostrar ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p id="regra-senha" className={`mt-1 text-xs ${curta ? "text-red-600" : "text-slate-500"}`}>
                Mínimo de {MIN} caracteres{curta ? ` (faltam ${MIN - newPassword.length})` : ""}.
              </p>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="mb-1 block text-sm text-slate-600">
                Confirme a nova senha
              </label>
              <input
                id="confirmPassword"
                type={mostrar ? "text" : "password"}
                required
                autoComplete="new-password"
                maxLength={MAX}
                aria-invalid={diferentes || undefined}
                aria-describedby={diferentes ? "senhas-diferentes" : undefined}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={campo}
              />
              {diferentes && (
                <p id="senhas-diferentes" className="mt-1 text-xs text-red-600">
                  As senhas não coincidem.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-700 px-4 py-2 font-medium text-white transition hover:bg-blue-800 disabled:opacity-60"
            >
              {loading ? "Salvando..." : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
