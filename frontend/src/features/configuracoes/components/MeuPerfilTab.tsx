// src/features/configuracoes/components/MeuPerfilTab.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Save, CheckCircle2 } from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";

interface Me {
  id: string;
  name: string;
  email: string;
  role: string;
}

// Nome sempre editavel; troca de senha e opcional (so exige senha atual +
// nova senha se o Administrador realmente quiser trocar). E-mail nao e
// editavel aqui - trocar e-mail de login e um fluxo mais sensivel
// (verificacao, unicidade), fora do escopo desta aba.
export function MeuPerfilTab() {
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;

    apiRequest<Me>("/auth/me")
      .then((me) => {
        setName(me.name);
        setEmail(me.email);
      })
      .catch((err) => {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar seu perfil.");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (newPassword && newPassword !== confirmNewPassword) {
      alert("A confirmação da nova senha não confere.");
      return;
    }
    if (newPassword && !currentPassword) {
      alert("Informe sua senha atual para definir uma nova senha.");
      return;
    }

    setSaving(true);
    try {
      await apiRequest("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({
          name,
          ...(newPassword ? { currentPassword, newPassword } : {}),
        }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      setSavedAt(Date.now());
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel salvar seu perfil.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <p className="text-sm">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-sm font-semibold text-slate-800">Meu Perfil</h2>

      <div className="space-y-4">
        <Field label="Nome">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="perfil-name"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
          />
        </Field>

        <Field label="E-mail">
          <input
            type="email"
            value={email}
            disabled
            className="w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-400 outline-none"
          />
        </Field>

        <div className="border-t border-slate-100 pt-4">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            Trocar senha (opcional)
          </p>
          <div className="space-y-3">
            <Field label="Senha atual">
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                data-testid="perfil-current-password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
              />
            </Field>
            <Field label="Nova senha">
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                data-testid="perfil-new-password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
              />
            </Field>
            <Field label="Confirmar nova senha">
              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                data-testid="perfil-confirm-new-password"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600"
              />
            </Field>
          </div>
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving}
          data-testid="perfil-save-button"
          className="flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar
        </button>
        {savedAt && !isSaving && (
          <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5" /> Salvo com sucesso
          </span>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
