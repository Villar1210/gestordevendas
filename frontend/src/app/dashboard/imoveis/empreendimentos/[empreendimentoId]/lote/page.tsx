// src/app/dashboard/imoveis/empreendimentos/[empreendimentoId]/lote/page.tsx
// Cadastro em Lote de Unidades (Fatia 2b) - consome os 2 endpoints da
// Fatia 2a: POST .../imoveis/gerar-lote (gera em memoria) e
// POST .../imoveis/lote (persiste o que o usuario revisou/editou).
"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, AlertTriangle, Building2 } from "lucide-react";
import { ApiError } from "@/core/api/client";
import { useImoveisStore } from "@/features/imoveis/store/useImoveisStore";
import {
  useImoveisIntegration,
  CriarImovelLoteItemInput,
  PadraoLoteInput,
} from "@/features/imoveis/hooks/useImoveisIntegration";
import { PadraoLoteForm } from "@/features/imoveis/components/lote/PadraoLoteForm";
import { UnidadesLoteGrid, UnidadeLoteRow } from "@/features/imoveis/components/lote/UnidadesLoteGrid";

function novaLinhaEmBranco(): UnidadeLoteRow {
  return {
    key: crypto.randomUUID(),
    identificadorExterno: "",
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
    tipoItem: "unidade",
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
  const { loadEmpreendimentos, handleGerarLoteImoveis, handleCriarImoveisLote } =
    useImoveisIntegration();

  const [isLoadingEmpreendimento, setIsLoadingEmpreendimento] = useState(true);
  const [rows, setRows] = useState<UnidadeLoteRow[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
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
    try {
      const result = await handleGerarLoteImoveis(empreendimentoId, padrao);
      if (!result) return;
      setRows(
        result.unidades.map((unidade) => ({
          key: crypto.randomUUID(),
          identificadorExterno: unidade.identificadorExterno,
          bloco: unidade.bloco,
          andar: String(unidade.andar),
          numeroNoAndar: String(unidade.numeroNoAndar),
          tipologia: unidade.customFields.tipologia,
          area: unidade.area !== null ? String(unidade.area) : "",
          dormitorios: unidade.bedrooms !== null ? String(unidade.bedrooms) : "",
          enquadramento: unidade.enquadramento,
          pcd: unidade.pcd,
          valorTabela: "",
          valorComDesconto: "",
          status: unidade.status,
          identificadorJaExiste: unidade.identificadorJaExiste,
        })),
      );
    } finally {
      setIsGenerating(false);
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
      const criados = await handleCriarImoveisLote(empreendimentoId, rows.map(rowParaPayload));
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
        <PadraoLoteForm onGerar={handleGerar} isGenerating={isGenerating} />

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
