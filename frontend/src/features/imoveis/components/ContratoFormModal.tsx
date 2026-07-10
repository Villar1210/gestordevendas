// src/features/imoveis/components/ContratoFormModal.tsx
"use client";

import { useEffect, useState, FormEvent } from "react";
import { X } from "lucide-react";
import { useImoveisStore } from "../store/useImoveisStore";
import { useImoveisIntegration } from "../hooks/useImoveisIntegration";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-amber-600 focus:ring-1 focus:ring-amber-600";

const IMOVEL_STATUS_DISPONIVEIS = ["disponivel", "vago"];

export function ContratoFormModal() {
  const isOpen = useImoveisStore((state) => state.contratoFormModalOpen);
  const closeContratoFormModal = useImoveisStore((state) => state.closeContratoFormModal);
  const imoveis = useImoveisStore((state) => state.imoveis);
  const proprietarios = useImoveisStore((state) => state.proprietarios);
  const inquilinosCompradores = useImoveisStore((state) => state.inquilinosCompradores);
  const { handleCreateContrato } = useImoveisIntegration();

  const imoveisDisponiveis = imoveis.filter((imovel) =>
    IMOVEL_STATUS_DISPONIVEIS.includes(imovel.status),
  );

  const [imovelId, setImovelId] = useState("");

  const [proprietarioId, setProprietarioId] = useState("");
  const [novoProprietario, setNovoProprietario] = useState(false);
  const [proprietarioNome, setProprietarioNome] = useState("");
  const [proprietarioTelefone, setProprietarioTelefone] = useState("");
  const [proprietarioCpfCnpj, setProprietarioCpfCnpj] = useState("");

  const [inquilinoCompradorId, setInquilinoCompradorId] = useState("");
  const [novoInquilinoComprador, setNovoInquilinoComprador] = useState(false);
  const [inquilinoNome, setInquilinoNome] = useState("");
  const [inquilinoTelefone, setInquilinoTelefone] = useState("");
  const [inquilinoCpfCnpj, setInquilinoCpfCnpj] = useState("");

  const [tipo, setTipo] = useState("locacao");
  const [valor, setValor] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [diaVencimento, setDiaVencimento] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setImovelId("");
    setProprietarioId("");
    setNovoProprietario(false);
    setProprietarioNome("");
    setProprietarioTelefone("");
    setProprietarioCpfCnpj("");
    setInquilinoCompradorId("");
    setNovoInquilinoComprador(false);
    setInquilinoNome("");
    setInquilinoTelefone("");
    setInquilinoCpfCnpj("");
    setTipo("locacao");
    setValor("");
    setDataInicio("");
    setDataFim("");
    setDiaVencimento("");
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await handleCreateContrato({
        imovelId,
        proprietarioId: novoProprietario ? undefined : proprietarioId,
        proprietario: novoProprietario
          ? {
              nome: proprietarioNome,
              telefone: proprietarioTelefone,
              cpfCnpj: proprietarioCpfCnpj || undefined,
            }
          : undefined,
        inquilinoCompradorId: novoInquilinoComprador ? undefined : inquilinoCompradorId,
        inquilinoComprador: novoInquilinoComprador
          ? {
              nome: inquilinoNome,
              telefone: inquilinoTelefone,
              cpfCnpj: inquilinoCpfCnpj || undefined,
            }
          : undefined,
        tipo,
        valor: Number(valor),
        dataInicio,
        dataFim: dataFim || undefined,
        diaVencimento:
          tipo === "locacao" && diaVencimento ? Number(diaVencimento) : undefined,
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
      aria-label="Novo Contrato"
      onClick={closeContratoFormModal}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">Novo Contrato</h2>
          <button
            onClick={closeContratoFormModal}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-slate-500">Imovel</label>
            <select
              required
              value={imovelId}
              onChange={(e) => setImovelId(e.target.value)}
              className={inputClass}
            >
              <option value="">Selecione um imovel disponivel/vago</option>
              {imoveisDisponiveis.map((imovel) => (
                <option key={imovel.id} value={imovel.id}>
                  {imovel.title}
                </option>
              ))}
            </select>
            {imoveisDisponiveis.length === 0 && (
              <p className="mt-1 text-xs text-amber-600">
                Nenhum imovel disponivel/vago no momento.
              </p>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm text-slate-500">Proprietario</label>
              <button
                type="button"
                onClick={() => setNovoProprietario((v) => !v)}
                className="text-xs font-medium text-amber-600 hover:text-amber-700"
              >
                {novoProprietario ? "Selecionar existente" : "+ Criar novo"}
              </button>
            </div>
            {novoProprietario ? (
              <div className="space-y-2">
                <input
                  type="text"
                  required
                  placeholder="Nome do proprietario"
                  value={proprietarioNome}
                  onChange={(e) => setProprietarioNome(e.target.value)}
                  className={inputClass}
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Telefone"
                    value={proprietarioTelefone}
                    onChange={(e) => setProprietarioTelefone(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="text"
                    placeholder="CPF/CNPJ"
                    value={proprietarioCpfCnpj}
                    onChange={(e) => setProprietarioCpfCnpj(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            ) : (
              <select
                required
                value={proprietarioId}
                onChange={(e) => setProprietarioId(e.target.value)}
                className={inputClass}
              >
                <option value="">Selecione um proprietario</option>
                {proprietarios.map((proprietario) => (
                  <option key={proprietario.id} value={proprietario.id}>
                    {proprietario.nome}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-sm text-slate-500">Inquilino/Comprador</label>
              <button
                type="button"
                onClick={() => setNovoInquilinoComprador((v) => !v)}
                className="text-xs font-medium text-amber-600 hover:text-amber-700"
              >
                {novoInquilinoComprador ? "Selecionar existente" : "+ Criar novo"}
              </button>
            </div>
            {novoInquilinoComprador ? (
              <div className="space-y-2">
                <input
                  type="text"
                  required
                  placeholder="Nome"
                  value={inquilinoNome}
                  onChange={(e) => setInquilinoNome(e.target.value)}
                  className={inputClass}
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    placeholder="Telefone"
                    value={inquilinoTelefone}
                    onChange={(e) => setInquilinoTelefone(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="text"
                    placeholder="CPF/CNPJ"
                    value={inquilinoCpfCnpj}
                    onChange={(e) => setInquilinoCpfCnpj(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            ) : (
              <select
                required
                value={inquilinoCompradorId}
                onChange={(e) => setInquilinoCompradorId(e.target.value)}
                className={inputClass}
              >
                <option value="">Selecione um inquilino/comprador</option>
                {inquilinosCompradores.map((inquilinoComprador) => (
                  <option key={inquilinoComprador.id} value={inquilinoComprador.id}>
                    {inquilinoComprador.nome}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-slate-500">Tipo</label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
                className={inputClass}
              >
                <option value="locacao">Locacao</option>
                <option value="venda">Venda</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm text-slate-500">Valor</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-sm text-slate-500">Data de inicio</label>
              <input
                type="date"
                required
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm text-slate-500">Data de fim</label>
              <input
                type="date"
                value={dataFim}
                onChange={(e) => setDataFim(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          {tipo === "locacao" && (
            <div>
              <label className="mb-1 block text-sm text-slate-500">
                Dia de vencimento do aluguel
              </label>
              <input
                type="number"
                min="1"
                max="31"
                placeholder="Ex: 10"
                value={diaVencimento}
                onChange={(e) => setDiaVencimento(e.target.value)}
                className={inputClass}
              />
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={closeContratoFormModal}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !imovelId}
              className="flex-1 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Criar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
