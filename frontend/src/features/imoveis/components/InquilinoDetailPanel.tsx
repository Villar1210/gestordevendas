// src/features/imoveis/components/InquilinoDetailPanel.tsx
"use client";

import { useEffect, useRef, useState, FormEvent } from "react";
import { X, FileText, Trash2, Upload } from "lucide-react";
import { apiRequest, API_BASE_URL } from "@/core/api/client";
import { InquilinoDocumento, useImoveisStore } from "../store/useImoveisStore";
import { useImoveisIntegration } from "../hooks/useImoveisIntegration";
import { STATUS_ANALISE_CREDITO_OPTIONS, TIPO_DOCUMENTO_OPTIONS, getTipoDocumentoLabel } from "../constants";

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const dateFormatter = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export function InquilinoDetailPanel() {
  const inquilinoDetailPanel = useImoveisStore((state) => state.inquilinoDetailPanel);
  const closeInquilinoDetailPanel = useImoveisStore((state) => state.closeInquilinoDetailPanel);
  const {
    handleUpdateInquilinoComprador,
    handleListInquilinoDocumentos,
    handleUploadInquilinoDocumento,
    handleDeleteInquilinoDocumento,
  } = useImoveisIntegration();

  const inquilino = inquilinoDetailPanel.inquilino;

  const [role, setRole] = useState<string | null>(null);
  const hasCheckedRole = useRef(false);

  const [nome, setNome] = useState("");
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");

  const [profissao, setProfissao] = useState("");
  const [rendaDeclarada, setRendaDeclarada] = useState("");
  const [statusAnaliseCredito, setStatusAnaliseCredito] = useState("nao_iniciada");
  const [observacoesAnalise, setObservacoesAnalise] = useState("");

  const [documentos, setDocumentos] = useState<InquilinoDocumento[]>([]);
  const [uploadingTipo, setUploadingTipo] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tipoParaUploadRef = useRef<string>("outro");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hasCheckedRole.current) {
      hasCheckedRole.current = true;
      apiRequest<{ role: string }>("/auth/me")
        .then((me) => setRole(me.role))
        .catch(() => setRole(null));
    }
  }, []);

  useEffect(() => {
    if (!inquilinoDetailPanel.isOpen || !inquilino) return;

    setNome(inquilino.nome);
    setCpfCnpj(inquilino.cpfCnpj ?? "");
    setTelefone(inquilino.telefone);
    setEmail(inquilino.email ?? "");
    setProfissao(inquilino.profissao ?? "");
    setRendaDeclarada(inquilino.rendaDeclarada ? String(inquilino.rendaDeclarada) : "");
    setStatusAnaliseCredito(inquilino.statusAnaliseCredito);
    setObservacoesAnalise(inquilino.observacoesAnalise ?? "");
    setDocumentos([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquilinoDetailPanel.isOpen, inquilino?.id]);

  useEffect(() => {
    if (!inquilinoDetailPanel.isOpen || !inquilino || role !== "Administrador") return;
    handleListInquilinoDocumentos(inquilino.id).then(setDocumentos);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inquilinoDetailPanel.isOpen, inquilino?.id, role]);

  if (!inquilinoDetailPanel.isOpen || !inquilino) return null;

  const isAdministrador = role === "Administrador";

  function handleUploadClick(tipo: string) {
    tipoParaUploadRef.current = tipo;
    fileInputRef.current?.click();
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !inquilino) return;

    setUploadingTipo(tipoParaUploadRef.current);
    try {
      const documento = await handleUploadInquilinoDocumento(
        inquilino.id,
        tipoParaUploadRef.current,
        file,
      );
      if (documento) {
        setDocumentos((prev) => [documento, ...prev]);
      }
    } finally {
      setUploadingTipo(null);
    }
  }

  async function handleRemoveDocumento(documentoId: string) {
    if (!inquilino) return;
    if (!confirm("Remover este documento?")) return;
    const ok = await handleDeleteInquilinoDocumento(inquilino.id, documentoId);
    if (ok) {
      setDocumentos((prev) => prev.filter((d) => d.id !== documentoId));
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!inquilino) return;
    setSaving(true);
    try {
      await handleUpdateInquilinoComprador(inquilino.id, {
        nome,
        cpfCnpj: cpfCnpj.trim() || undefined,
        telefone,
        email: email.trim() || undefined,
        ...(isAdministrador
          ? {
              profissao: profissao.trim() || undefined,
              rendaDeclarada: rendaDeclarada ? Number(rendaDeclarada) : undefined,
              statusAnaliseCredito,
              observacoesAnalise: observacoesAnalise.trim() || undefined,
            }
          : {}),
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
      aria-label="Detalhes do Inquilino"
      onClick={closeInquilinoDetailPanel}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-2xl border border-slate-200 bg-white shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <h2 className="text-lg font-semibold text-slate-800">{inquilino.nome}</h2>
          <button
            onClick={closeInquilinoDetailPanel}
            className="text-slate-400 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6">
          <div className="space-y-8">
            {/* Dados Basicos */}
            <section>
              <h3 className="mb-3 text-sm font-semibold text-slate-700">Dados Basicos</h3>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm text-slate-500">Nome</label>
                  <input
                    type="text"
                    required
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">Telefone</label>
                    <input
                      type="text"
                      required
                      value={telefone}
                      onChange={(e) => setTelefone(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm text-slate-500">CPF/CNPJ</label>
                    <input
                      type="text"
                      value={cpfCnpj}
                      onChange={(e) => setCpfCnpj(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-sm text-slate-500">E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>
            </section>

            {isAdministrador && (
              <>
                {/* Analise de Credito */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">
                    Analise de Credito
                  </h3>
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">Profissao</label>
                        <input
                          type="text"
                          value={profissao}
                          onChange={(e) => setProfissao(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-sm text-slate-500">
                          Renda declarada (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={rendaDeclarada}
                          onChange={(e) => setRendaDeclarada(e.target.value)}
                          className={inputClass}
                        />
                        {inquilino.rendaDeclarada != null && (
                          <p className="mt-1 text-xs text-slate-400">
                            Atual: {currencyFormatter.format(inquilino.rendaDeclarada)}
                          </p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-500">
                        Status da analise
                      </label>
                      <select
                        value={statusAnaliseCredito}
                        onChange={(e) => setStatusAnaliseCredito(e.target.value)}
                        className={inputClass}
                      >
                        {STATUS_ANALISE_CREDITO_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-sm text-slate-500">Observacoes</label>
                      <textarea
                        rows={3}
                        value={observacoesAnalise}
                        onChange={(e) => setObservacoesAnalise(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </section>

                {/* Documentos */}
                <section>
                  <h3 className="mb-3 text-sm font-semibold text-slate-700">Documentos</h3>
                  <div className="mb-3 flex flex-wrap gap-2">
                    {TIPO_DOCUMENTO_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleUploadClick(opt.value)}
                        disabled={uploadingTipo !== null}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {uploadingTipo === opt.value ? "Enviando..." : `Enviar ${opt.label}`}
                      </button>
                    ))}
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={handleFileSelected}
                    />
                  </div>

                  <div className="space-y-2">
                    {documentos.map((documento) => (
                      <div
                        key={documento.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                      >
                        <a
                          href={`${API_BASE_URL}${documento.url}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-w-0 items-center gap-2 text-sm text-slate-700 hover:text-blue-700"
                        >
                          <FileText className="h-4 w-4 shrink-0 text-slate-400" />
                          <span className="truncate">{documento.nomeArquivo}</span>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500">
                            {getTipoDocumentoLabel(documento.tipo)}
                          </span>
                        </a>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="text-xs text-slate-400">
                            {dateFormatter.format(new Date(documento.createdAt))}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveDocumento(documento.id)}
                            className="text-slate-400 hover:text-red-600"
                            aria-label="Remover documento"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    {documentos.length === 0 && (
                      <p className="py-4 text-center text-xs text-slate-400">
                        Nenhum documento enviado ainda.
                      </p>
                    )}
                  </div>
                </section>
              </>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
