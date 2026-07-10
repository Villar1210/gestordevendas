// src/features/cadastro-publico/components/ClienteSignupForm.tsx
"use client";

import { useState, FormEvent } from "react";
import Link from "next/link";
import { usePublicSignupIntegration } from "../hooks/usePublicSignupIntegration";
import { CadastroRecebidoScreen } from "./CadastroRecebidoScreen";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600";

export function ClienteSignupForm() {
  const { submitSignup } = usePublicSignupIntegration();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cpf, setCpf] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [tipoCliente, setTipoCliente] = useState("comprador");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (submitted) return <CadastroRecebidoScreen />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("As senhas nao coincidem.");
      return;
    }

    setLoading(true);
    try {
      const result = await submitSignup({
        tipoPerfil: "comprador",
        name,
        email,
        password,
        telefone: telefone || undefined,
        cpf: cpf || undefined,
        cep: cep || undefined,
        endereco: endereco || undefined,
        tipoCliente,
      });
      if (result.ok) {
        setSubmitted(true);
      } else {
        setError(result.message);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-800">Cadastro de Cliente</h1>
        <p className="mb-6 text-sm text-slate-500">
          Crie sua conta para acompanhar imoveis de interesse.
        </p>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-500">Nome</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-500">E-mail</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-slate-500">Telefone</label>
              <input
                type="text"
                placeholder="(11) 99999-9999"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm text-slate-500">CPF</label>
              <input
                type="text"
                value={cpf}
                onChange={(e) => setCpf(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="w-1/3">
              <label className="mb-1 block text-sm text-slate-500">CEP</label>
              <input
                type="text"
                value={cep}
                onChange={(e) => setCep(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm text-slate-500">Endereco</label>
              <input
                type="text"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm text-slate-500">Voce e</label>
            <select
              value={tipoCliente}
              onChange={(e) => setTipoCliente(e.target.value)}
              className={inputClass}
            >
              <option value="comprador">Comprador - estou buscando um imovel</option>
              <option value="proprietario">Proprietario - quero anunciar meu imovel</option>
              <option value="ambos">Ambos</option>
            </select>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-slate-500">Senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm text-slate-500">Confirmar senha</label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-amber-700 px-4 py-2 font-medium text-white transition hover:bg-amber-800 disabled:opacity-60"
          >
            {loading ? "Enviando..." : "Criar cadastro"}
          </button>

          <Link href="/cadastro" className="block text-center text-sm text-amber-600 hover:underline">
            Voltar
          </Link>
        </form>
      </div>
    </div>
  );
}
