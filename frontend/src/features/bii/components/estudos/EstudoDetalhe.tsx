// Estudo salvo no dashboard (BII Fatia 5): relatorio + acoes (editar nome e
// conclusao, versao para impressao, excluir). O snapshot nunca e recalculado.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2, Pencil, Printer, Save, Trash2, X } from "lucide-react";
import { atualizarEstudo, carregarEstudo, excluirEstudo, mensagemErroEstudo } from "../../hooks/useBiiEstudosIntegration";
import type { Estudo } from "../../types-estudo";
import { EmptyState } from "../EmptyState";
import { RelatorioEstudo } from "./RelatorioEstudo";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";
const BOTAO =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50";

export function EstudoDetalhe({ id }: { id: string }) {
  const router = useRouter();
  const [estudo, setEstudo] = useState<Estudo | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState("");
  const [conclusao, setConclusao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState<string | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    carregarEstudo(id)
      .then(setEstudo)
      .catch((err) => setErro(mensagemErroEstudo(err)))
      .finally(() => setCarregando(false));
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function abrirEdicao() {
    if (!estudo) return;
    setNome(estudo.nome);
    setConclusao(estudo.conclusao ?? "");
    setErroAcao(null);
    setEditando(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const n = nome.trim().replace(/\s+/g, " ");
    if (n.length < 3 || n.length > 120) return setErroAcao("Dê ao estudo um nome de 3 a 120 caracteres.");
    setSalvando(true);
    setErroAcao(null);
    try {
      setEstudo(await atualizarEstudo(id, { nome: n, conclusao: conclusao.trim() || null }));
      setEditando(false);
    } catch (err) {
      setErroAcao(mensagemErroEstudo(err));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    setSalvando(true);
    setErroAcao(null);
    try {
      await excluirEstudo(id);
      router.push("/dashboard/bii/estudos");
    } catch (err) {
      setErroAcao(mensagemErroEstudo(err));
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href="/dashboard/bii/estudos" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-blue-700">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar aos estudos
        </Link>
        {estudo && !editando && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={abrirEdicao} className={BOTAO}>
              <Pencil className="h-4 w-4" aria-hidden="true" /> Editar nome e conclusão
            </button>
            <a href={`/impressao/bii/estudos/${encodeURIComponent(id)}`} target="_blank" rel="noopener" className={BOTAO}>
              <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir / Salvar PDF
            </a>
            {confirmarExclusao ? (
              <span className="inline-flex items-center gap-1.5">
                <button type="button" disabled={salvando} onClick={excluir} className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60">
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Confirmar exclusão
                </button>
                <button type="button" onClick={() => setConfirmarExclusao(false)} className={BOTAO}>
                  Cancelar
                </button>
              </span>
            ) : (
              <button type="button" onClick={() => setConfirmarExclusao(true)} className={`${BOTAO} hover:border-red-200 hover:text-red-700`}>
                <Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir
              </button>
            )}
          </div>
        )}
      </div>

      {erroAcao && !editando && (
        <p role="alert" className="text-sm text-red-600">
          {erroAcao}
        </p>
      )}

      {editando && (
        <form onSubmit={salvar} noValidate className="space-y-3 rounded-2xl border border-blue-200 bg-white p-4 sm:p-5">
          <div>
            <label className="text-xs font-medium text-slate-600" htmlFor="ed-nome">
              Nome do estudo
            </label>
            <input id="ed-nome" className={`mt-1 ${INPUT}`} value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600" htmlFor="ed-conclusao">
              Conclusão
            </label>
            <textarea id="ed-conclusao" rows={6} maxLength={5000} className={`mt-1 ${INPUT}`} value={conclusao} onChange={(e) => setConclusao(e.target.value)} />
            <p className="mt-1 text-right text-[11px] text-slate-400">{conclusao.length}/5.000</p>
          </div>
          <p className="text-xs text-slate-500">Os números do estudo não mudam: só o nome e a conclusão são alterados.</p>
          {erroAcao && (
            <p role="alert" className="text-sm text-red-600">
              {erroAcao}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={salvando} className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60">
              {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />} Salvar
            </button>
            <button type="button" onClick={() => setEditando(false)} className={BOTAO}>
              <X className="h-4 w-4" aria-hidden="true" /> Cancelar
            </button>
          </div>
        </form>
      )}

      {carregando ? (
        <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden="true" />
          <p className="text-sm">Carregando estudo...</p>
        </div>
      ) : erro || !estudo ? (
        <section className="rounded-2xl border border-slate-200 bg-white">
          <EmptyState icon={AlertCircle} titulo="Não foi possível abrir o estudo" texto={erro ?? undefined} acao={{ label: "Tentar de novo", onClick: carregar }} />
        </section>
      ) : (
        <RelatorioEstudo estudo={estudo} />
      )}
    </div>
  );
}
