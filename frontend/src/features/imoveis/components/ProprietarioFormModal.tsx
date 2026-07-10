// src/features/imoveis/components/ProprietarioFormModal.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { X } from "lucide-react";
import { useImoveisStore } from "../store/useImoveisStore";
import { useImoveisIntegration } from "../hooks/useImoveisIntegration";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

export function ProprietarioFormModal() {
  const isOpen = useImoveisStore((state) => state.proprietarioFormModalOpen);
  const closeProprietarioFormModal = useImoveisStore(
    (state) => state.closeProprietarioFormModal,
  );
  const { handleCreateProprietario } = useImoveisIntegration();

  const [nome, setNome] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [cep, setCep] = useState("");
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [pix, setPix] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setNome("");
    setCpfCnpj("");
    setTelefone("");
    setEmail("");
    setRua("");
    setNumero("");
    setComplemento("");
    setBairro("");
    setCidade("");
    setUf("");
    setCep("");
    setBanco("");
    setAgencia("");
    setConta("");
    setPix("");
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await handleCreateProprietario({
        nome,
        cpfCnpj: cpfCnpj || undefined,
        telefone,
        email: email || undefined,
        rua: rua || undefined,
        numero: numero || undefined,
        complemento: complemento || undefined,
        bairro: bairro || undefined,
        cidade: cidade || undefined,
        uf: uf ? uf.toUpperCase() : undefined,
        cep: cep || undefined,
        banco: banco || undefined,
        agencia: agencia || undefined,
        conta: conta || undefined,
        pix: pix || undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Novo Proprietario"
      onClick={closeProprietarioFormModal}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Novo Proprietario</h2>
          <button
            onClick={closeProprietarioFormModal}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-slate-500">Nome</label>
              <input
                type="text"
                required
                placeholder="Nome do proprietario"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="w-1/3">
              <label className="mb-1 block text-sm text-slate-500">CPF/CNPJ</label>
              <input
                type="text"
                value={cpfCnpj}
                onChange={(e) => setCpfCnpj(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-slate-500">Telefone</label>
              <input
                type="text"
                required
                placeholder="(11) 99999-9999"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm text-slate-500">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-600">Endereco (opcional)</p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Rua"
                  value={rua}
                  onChange={(e) => setRua(e.target.value)}
                  className={`w-2/3 ${inputClass}`}
                />
                <input
                  type="text"
                  placeholder="Numero"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  className={`w-1/3 ${inputClass}`}
                />
              </div>
              <input
                type="text"
                placeholder="Complemento"
                value={complemento}
                onChange={(e) => setComplemento(e.target.value)}
                className={inputClass}
              />
              <input
                type="text"
                placeholder="Bairro"
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                className={inputClass}
              />
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Cidade"
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  className={`w-1/2 ${inputClass}`}
                />
                <input
                  type="text"
                  maxLength={2}
                  placeholder="UF"
                  value={uf}
                  onChange={(e) => setUf(e.target.value)}
                  className={`w-1/4 ${inputClass}`}
                />
                <input
                  type="text"
                  placeholder="CEP"
                  value={cep}
                  onChange={(e) => setCep(e.target.value)}
                  className={`w-1/4 ${inputClass}`}
                />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-600">
              Dados bancarios (opcional, para repasse)
            </p>
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Banco"
                  value={banco}
                  onChange={(e) => setBanco(e.target.value)}
                  className={`w-1/2 ${inputClass}`}
                />
                <input
                  type="text"
                  placeholder="Agencia"
                  value={agencia}
                  onChange={(e) => setAgencia(e.target.value)}
                  className={`w-1/2 ${inputClass}`}
                />
              </div>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Conta"
                  value={conta}
                  onChange={(e) => setConta(e.target.value)}
                  className={`w-1/2 ${inputClass}`}
                />
                <input
                  type="text"
                  placeholder="Chave Pix"
                  value={pix}
                  onChange={(e) => setPix(e.target.value)}
                  className={`w-1/2 ${inputClass}`}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={closeProprietarioFormModal}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
