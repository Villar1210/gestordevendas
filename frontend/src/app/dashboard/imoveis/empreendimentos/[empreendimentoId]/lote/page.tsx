// src/app/dashboard/imoveis/empreendimentos/[empreendimentoId]/lote/page.tsx
// Cadastro em Lote de Unidades (Fatia 2b) - consome os 2 endpoints da
// Fatia 2a: POST .../imoveis/gerar-lote (gera em memoria) e
// POST .../imoveis/lote (persiste o que o usuario revisou/editou).
"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertTriangle, Building2, Wand2, FileSpreadsheet } from "lucide-react";
import { ApiError } from "@/core/api/client";
import { useImoveisStore } from "@/features/imoveis/store/useImoveisStore";
import {
  useImoveisIntegration,
  CriarImovelLoteItemInput,
  PadraoLoteInput,
  UnidadeGeradaLote,
  LinhaPlanilhaErro,
} from "@/features/imoveis/hooks/useImoveisIntegration";
import { PadraoLoteForm } from "@/features/imoveis/components/lote/PadraoLoteForm";
import { ImportarPlanilhaForm } from "@/features/imoveis/components/lote/ImportarPlanilhaForm";
import { UnidadesLoteGrid, UnidadeLoteRow } from "@/features/imoveis/components/lote/UnidadesLoteGrid";

function novaLinhaEmBranco(): UnidadeLoteRow {
  return {
    key: crypto.randomUUID(),
    identificadorExterno: "",
    tipoItem: "unidade",
    bloco: "",
    andar: "",
    numeroNoAndar: "",
    tipologia: "",
    area: "",
    dormitorios: "",
    enquadramento: "nenhum",
    pcd: false,
    valorTabela: "",
    valorComDesconto: "",
    status: "disponivel",
    identificadorJaExiste: false,
  };
}

// Compartilhada pelo gerar-lote manual (padrao estrutural) e pela
// importacao de planilha - os dois endpoints devolvem o mesmo formato de
// unidade (ver UnidadeGeradaLote), so a origem dos dados muda.
function unidadeParaRow(unidade: UnidadeGeradaLote): UnidadeLoteRow {
  const tipologia = (unidade.customFields as { tipologia?: string }).tipologia ?? "";
  return {
    key: crypto.randomUUID(),
    identificadorExterno: unidade.identificadorExterno,
    tipoItem: unidade.tipoItem,
    bloco: unidade.bloco ?? "",
    andar: unidade.andar !== null ? String(unidade.andar) : "",
    numeroNoAndar: unidade.numeroNoAndar !== null ? String(unidade.numeroNoAndar) : "",
    tipologia,
    area: unidade.area !== null ? String(unidade.area) : "",
    dormitorios: unidade.bedrooms !== null ? String(unidade.bedrooms) : "",
    enquadramento: unidade.enquadramento,
    pcd: unidade.pcd,
    valorTabela: unidade.valorTabela != null ? String(unidade.valorTabela) : "",
    valorComDesconto: unidade.valorComDesconto != null ? String(unidade.valorComDesconto) : "",
    status: unidade.status,
    identificadorJaExiste: unidade.identificadorJaExiste,
  };
}

function numeroOuUndefined(valor: string): number | undefined {
  return valor.trim() ? Number(valor) : undefined;
}

function derivarTitle(row: UnidadeLoteRow): string {
  const tipologia = row.tipologia.trim();
  const identificador = row.identificadorExterno.trim();
  if (tipologia && identificador) return `${tipologia} - ${identificador}`;
  if (tipologia) return tipologia;
  if (identificador) return identificador;
  return "Unidade sem nome";
}

function rowParaPayload(row: UnidadeLoteRow): CriarImovelLoteItemInput {
  return {
    title: derivarTitle(row),
    tipo: "apartamento",
    finalidade: "venda",
    status: row.status,
    tipoItem: row.tipoItem,
    identificadorExterno: row.identificadorExterno.trim() || undefined,
    bloco: row.bloco.trim() || undefined,
    andar: numeroOuUndefined(row.andar),
    numeroNoAndar: numeroOuUndefined(row.numeroNoAndar),
    enquadramento: row.enquadramento,
    pcd: row.pcd,
    valorTabela: numeroOuUndefined(row.valorTabela),
    valorComDesconto: numeroOuUndefined(row.valorComDesconto),
    area: numeroOuUndefined(row.area),
    bedrooms: numeroOuUndefined(row.dormitorios),
    customFields: row.tipologia.trim() ? { tipologia: row.tipologia.trim() } : undefined,
  };
}

interface SaveError {
  message: string;
  identificadoresColidindo: string[];
}

export default function CadastroEmLotePage({
  params,
}: {
  params: Promise<{ empreendimentoId: string }>;
}) {
  const { empreendimentoId } = usePromise(params);
  const router = useRouter();

  const empreendimentos = useImoveisStore((state) => state.empreendimentos);
  const {
    loadEmpreendimentos,
    handleGerarLoteImoveis,
    handleCriarImoveisLote,
    handleListarProdutosPlanilha,
    handleImportarPlanilhaImoveis,
  } = useImoveisIntegration();

  const [isLoadingEmpreendimento, setIsLoadingEmpreendimento] = useState(true);
  const [origemForm, setOrigemForm] = useState<"padrao" | "planilha">("padrao");
  const [rows, setRows] = useState<UnidadeLoteRow[]>([]);
  // De onde vieram as unidades ATUALMENTE no grid - usado so na hora de
  // salvar, para decidir se envia origemImportacao ao backend (marca o
  // Empreendimento como publicado=false + origemImportacao="planilha").
  // null ate a 1a geracao/importacao.
  const [origemAtual, setOrigemAtual] = useState<"padrao" | "planilha" | null>(null);
  const [errosParsing, setErrosParsing] = useState<LinhaPlanilhaErro[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<SaveError | null>(null);
  const hasInitialized = useRef(false);

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    loadEmpreendimentos().finally(() => setIsLoadingEmpreendimento(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const empreendimento = empreendimentos.find((emp) => emp.id === empreendimentoId) ?? null;

  function updateRow(key: string, patch: Partial<UnidadeLoteRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function removeRow(key: string) {
    setRows((current) => current.filter((row) => row.key !== key));
  }

  function addRow() {
    setRows((current) => [...current, novaLinhaEmBranco()]);
  }

  async function handleGerar(padrao: PadraoLoteInput) {
    if (rows.length > 0) {
      const confirmado = window.confirm(
        "Isso vai substituir as unidades ja geradas no grid abaixo. Continuar?",
      );
      if (!confirmado) return;
    }

    setIsGenerating(true);
    setSaveError(null);
    setErrosParsing([]);
    try {
      const result = await handleGerarLoteImoveis(empreendimentoId, padrao);
      if (!result) return;
      setRows(result.unidades.map(unidadeParaRow));
      setOrigemAtual("padrao");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleImportar(file: File, produto: string) {
    if (rows.length > 0) {
      const confirmado = window.confirm(
        "Isso vai substituir as unidades ja geradas no grid abaixo. Continuar?",
      );
      if (!confirmado) return;
    }

    setIsImporting(true);
    setSaveError(null);
    try {
      const result = await handleImportarPlanilhaImoveis(empreendimentoId, file, produto);
      if (!result) return;
      setRows(result.unidades.map(unidadeParaRow));
      setErrosParsing(result.erros);
      setOrigemAtual("planilha");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleSalvar() {
    setSaveError(null);

    const identificadoresPreenchidos = rows
      .map((row) => row.identificadorExterno.trim())
      .filter((id) => id !== "");
    const duplicadosNoGrid = Array.from(
      new Set(
        identificadoresPreenchidos.filter(
          (id, index) => identificadoresPreenchidos.indexOf(id) !== index,
        ),
      ),
    );

    if (duplicadosNoGrid.length > 0) {
      setSaveError({
        message: "Ha identificadores duplicados dentro do proprio grid. Corrija antes de salvar.",
        identificadoresColidindo: duplicadosNoGrid,
      });
      setRows((current) =>
        current.map((row) =>
          duplicadosNoGrid.includes(row.identificadorExterno.trim())
            ? { ...row, identificadorJaExiste: true }
            : row,
        ),
      );
      return;
    }

    if (rows.length === 0) {
      setSaveError({ message: "Adicione ao menos uma unidade antes de salvar.", identificadoresColidindo: [] });
      return;
    }

    setIsSaving(true);
    try {
      const criados = await handleCriarImoveisLote(
        empreendimentoId,
        rows.map(rowParaPayload),
        origemAtual === "planilha" ? "planilha" : undefined,
      );
      alert(`${criados.length} unidade(s) criada(s) com sucesso!`);
      router.push(`/dashboard/imoveis?empreendimentoId=${empreendimentoId}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as { identificadoresColidindo?: string[] } | undefined;
        const identificadoresColidindo = body?.identificadoresColidindo ?? [];
        setSaveError({ message: err.message, identificadoresColidindo });
        setRows((current) =>
          current.map((row) =>
            identificadoresColidindo.includes(row.identificadorExterno.trim())
              ? { ...row, identificadorJaExiste: true }
              : row,
          ),
        );
      } else {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel salvar o lote.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoadingEmpreendimento) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <p className="text-sm">Carregando empreendimento...</p>
      </div>
    );
  }

  if (!empreendimento) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50 text-slate-400">
        <Building2 className="h-8 w-8" />
        <p className="text-sm">Empreendimento nao encontrado.</p>
        <Link href="/dashboard/imoveis" className="text-sm text-blue-700 hover:text-blue-800">
          Voltar para Imoveis
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <Link
          href="/dashboard/imoveis"
          className="text-slate-400 hover:text-slate-600"
          aria-label="Voltar"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-lg font-semibold text-slate-800">Cadastro em Lote</h1>
          <p className="text-sm text-slate-500">{empreendimento.name}</p>
        </div>
      </header>

      <div className="space-y-6 p-6">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 sm:w-fit">
          <button
            type="button"
            onClick={() => setOrigemForm("padrao")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              origemForm === "padrao"
                ? "bg-blue-700 text-white"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Wand2 className="h-4 w-4" /> Gerar por padrao
          </button>
          <button
            type="button"
            onClick={() => setOrigemForm("planilha")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              origemForm === "planilha"
                ? "bg-blue-700 text-white"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <FileSpreadsheet className="h-4 w-4" /> Importar de planilha
          </button>
        </div>

        {origemForm === "padrao" ? (
          <PadraoLoteForm onGerar={handleGerar} isGenerating={isGenerating} />
        ) : (
          <ImportarPlanilhaForm
            onListarProdutos={(file) => handleListarProdutosPlanilha(empreendimentoId, file)}
            onImportar={handleImportar}
            isImporting={isImporting}
          />
        )}

        {saveError && (
          <div className="flex items-start gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">{saveError.message}</p>
              {saveError.identificadoresColidindo.length > 0 && (
                <p className="mt-1">
                  Identificadores: {saveError.identificadoresColidindo.join(", ")}
                </p>
              )}
            </div>
          </div>
        )}

        {errosParsing.length > 0 && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {errosParsing.length} linha(s) nao puderam ser importadas
            </p>
            <ul className="mt-2 space-y-1 pl-6">
              {errosParsing.map((erro) => (
                <li key={erro.linha} className="list-disc">
                  Linha {erro.linha} ({erro.identificador || "sem identificador"}): {erro.motivo}
                </li>
              ))}
            </ul>
          </div>
        )}

        <UnidadesLoteGrid
          rows={rows}
          onUpdateRow={updateRow}
          onRemoveRow={removeRow}
          onAddRow={addRow}
        />
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center justify-end gap-3">
          <Link
            href="/dashboard/imoveis"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancelar
          </Link>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={isSaving || rows.length === 0}
            className="rounded-lg bg-blue-700 px-5 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
          >
            {isSaving ? "Salvando..." : "Salvar lote"}
          </button>
        </div>
      </div>
    </div>
  );
}
