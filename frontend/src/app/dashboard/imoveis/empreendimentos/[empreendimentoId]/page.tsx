// src/app/dashboard/imoveis/empreendimentos/[empreendimentoId]/page.tsx
// Fatia 4 (gestao_imobiliaria): tela de Revisao e Publicacao do
// empreendimento. Amarra as Fatias 3a (planilha) e 3c (ficha tecnica via
// IA), que deixam o Empreendimento marcado publicado=false ate revisao
// humana - ate esta fatia nao havia nenhuma tela mostrando esse estado
// pendente nem permitindo publicar.
"use client";

import { useEffect, useRef, useState, use as usePromise } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Loader2,
  LayoutGrid,
  Plus,
  X,
} from "lucide-react";
import { ApiError, API_BASE_URL } from "@/core/api/client";
import {
  useImoveisIntegration,
  ConfirmarFichaTecnicaInput,
  TipologiaInput,
} from "@/features/imoveis/hooks/useImoveisIntegration";
import {
  Empreendimento,
  Tipologia,
  EmpreendimentoPhoto,
} from "@/features/imoveis/store/useImoveisStore";
import {
  getOrigemImportacaoLabel,
  EMPREENDIMENTO_PHOTO_CATEGORIA_OPTIONS,
} from "@/features/imoveis/constants";

// Estado local de edicao da ficha tecnica (strings no form, convertidos so
// na hora de enviar - mesmo padrao ja usado no grid de Cadastro em Lote).
interface FichaTecnicaForm {
  descricao: string;
  areaTerreno: string;
  totalUnidades: string;
  numeroTorres: string;
  unidadesPorAndar: string;
  gabarito: string;
  vagas: string;
  itensLazer: string[];
  tipologias: { key: string; nome: string; areaPrivativa: string; dormitorios: string }[];
}

function numeroOuNull(valor: string): number | null {
  return valor.trim() ? Number(valor) : null;
}

function fichaTecnicaParaForm(empreendimento: Empreendimento, tipologias: Tipologia[]): FichaTecnicaForm {
  return {
    descricao: empreendimento.description ?? "",
    areaTerreno: empreendimento.areaTerreno !== null ? String(empreendimento.areaTerreno) : "",
    totalUnidades: empreendimento.totalUnidades !== null ? String(empreendimento.totalUnidades) : "",
    numeroTorres: empreendimento.numeroTorres !== null ? String(empreendimento.numeroTorres) : "",
    unidadesPorAndar:
      empreendimento.unidadesPorAndar !== null ? String(empreendimento.unidadesPorAndar) : "",
    gabarito: empreendimento.gabarito !== null ? String(empreendimento.gabarito) : "",
    vagas: empreendimento.vagas !== null ? String(empreendimento.vagas) : "",
    itensLazer: empreendimento.itensLazer,
    tipologias: tipologias.map((tipologia) => ({
      key: tipologia.id,
      nome: tipologia.nome,
      areaPrivativa: tipologia.areaPrivativa !== null ? String(tipologia.areaPrivativa) : "",
      dormitorios: tipologia.dormitorios !== null ? String(tipologia.dormitorios) : "",
    })),
  };
}

function formParaPayload(form: FichaTecnicaForm): ConfirmarFichaTecnicaInput {
  const tipologias: TipologiaInput[] = form.tipologias
    .filter((tipologia) => tipologia.nome.trim())
    .map((tipologia) => ({
      nome: tipologia.nome.trim(),
      areaPrivativa: numeroOuNull(tipologia.areaPrivativa),
      dormitorios: numeroOuNull(tipologia.dormitorios),
    }));

  return {
    descricao: form.descricao.trim() || null,
    areaTerreno: numeroOuNull(form.areaTerreno),
    totalUnidades: numeroOuNull(form.totalUnidades),
    numeroTorres: numeroOuNull(form.numeroTorres),
    unidadesPorAndar: numeroOuNull(form.unidadesPorAndar),
    gabarito: numeroOuNull(form.gabarito),
    vagas: numeroOuNull(form.vagas),
    itensLazer: form.itensLazer.filter((item) => item.trim()),
    tipologias,
  };
}

export default function EmpreendimentoDetailPage({
  params,
}: {
  params: Promise<{ empreendimentoId: string }>;
}) {
  const { empreendimentoId } = usePromise(params);
  const {
    handleGetEmpreendimentoDetail,
    handlePublicarEmpreendimento,
    handleDespublicarEmpreendimento,
    handleConfirmarFichaTecnica,
    handleUploadEmpreendimentoPhoto,
    handleDeleteEmpreendimentoPhoto,
    handleReorderEmpreendimentoPhotos,
  } = useImoveisIntegration();

  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [empreendimento, setEmpreendimento] = useState<Empreendimento | null>(null);
  const [tipologias, setTipologias] = useState<Tipologia[]>([]);
  const [unidadesCadastradas, setUnidadesCadastradas] = useState(0);
  const [photos, setPhotos] = useState<EmpreendimentoPhoto[]>([]);

  const [isTogglingPublicacao, setIsTogglingPublicacao] = useState(false);

  const [isEditingFicha, setIsEditingFicha] = useState(false);
  const [fichaForm, setFichaForm] = useState<FichaTecnicaForm | null>(null);
  const [isSavingFicha, setIsSavingFicha] = useState(false);

  const hasInitialized = useRef(false);

  async function carregar() {
    setIsLoading(true);
    setNotFound(false);
    try {
      const detail = await handleGetEmpreendimentoDetail(empreendimentoId);
      setEmpreendimento(detail.empreendimento);
      setTipologias(detail.tipologias);
      setUnidadesCadastradas(detail.unidadesCadastradas);
      setPhotos(detail.photos);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true);
      } else {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar o empreendimento.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePublicarClick() {
    if (!empreendimento) return;
    const confirmado = window.confirm(
      `Publicar "${empreendimento.name}"? Isso marca o empreendimento como revisado.`,
    );
    if (!confirmado) return;

    setIsTogglingPublicacao(true);
    try {
      const atualizado = await handlePublicarEmpreendimento(empreendimento.id);
      if (atualizado) setEmpreendimento(atualizado);
    } finally {
      setIsTogglingPublicacao(false);
    }
  }

  async function handleDespublicarClick() {
    if (!empreendimento) return;
    const confirmado = window.confirm(
      `Despublicar "${empreendimento.name}"? Ele volta a ficar como pendente de revisao.`,
    );
    if (!confirmado) return;

    setIsTogglingPublicacao(true);
    try {
      const atualizado = await handleDespublicarEmpreendimento(empreendimento.id);
      if (atualizado) setEmpreendimento(atualizado);
    } finally {
      setIsTogglingPublicacao(false);
    }
  }

  function handleIniciarEdicaoFicha() {
    if (!empreendimento) return;
    setFichaForm(fichaTecnicaParaForm(empreendimento, tipologias));
    setIsEditingFicha(true);
  }

  function handleCancelarEdicaoFicha() {
    setIsEditingFicha(false);
    setFichaForm(null);
  }

  function updateFichaField<K extends keyof FichaTecnicaForm>(campo: K, valor: FichaTecnicaForm[K]) {
    setFichaForm((current) => (current ? { ...current, [campo]: valor } : current));
  }

  function updateItemLazer(index: number, valor: string) {
    setFichaForm((current) => {
      if (!current) return current;
      const itensLazer = [...current.itensLazer];
      itensLazer[index] = valor;
      return { ...current, itensLazer };
    });
  }

  function addItemLazer() {
    setFichaForm((current) => (current ? { ...current, itensLazer: [...current.itensLazer, ""] } : current));
  }

  function removeItemLazer(index: number) {
    setFichaForm((current) =>
      current ? { ...current, itensLazer: current.itensLazer.filter((_, i) => i !== index) } : current,
    );
  }

  function updateTipologia(key: string, patch: Partial<FichaTecnicaForm["tipologias"][number]>) {
    setFichaForm((current) =>
      current
        ? {
            ...current,
            tipologias: current.tipologias.map((tipologia) =>
              tipologia.key === key ? { ...tipologia, ...patch } : tipologia,
            ),
          }
        : current,
    );
  }

  function addTipologia() {
    setFichaForm((current) =>
      current
        ? {
            ...current,
            tipologias: [
              ...current.tipologias,
              { key: crypto.randomUUID(), nome: "", areaPrivativa: "", dormitorios: "" },
            ],
          }
        : current,
    );
  }

  function removeTipologia(key: string) {
    setFichaForm((current) =>
      current ? { ...current, tipologias: current.tipologias.filter((t) => t.key !== key) } : current,
    );
  }

  async function handleSalvarFicha() {
    if (!empreendimento || !fichaForm) return;
    setIsSavingFicha(true);
    try {
      const result = await handleConfirmarFichaTecnica(empreendimento.id, formParaPayload(fichaForm));
      if (result) {
        setEmpreendimento(result.empreendimento);
        setTipologias(result.tipologias);
        setIsEditingFicha(false);
        setFichaForm(null);
      }
    } finally {
      setIsSavingFicha(false);
    }
  }

  async function handleUploadPhotoCategoria(categoria: string, file: File) {
    if (!empreendimento) return;
    const photo = await handleUploadEmpreendimentoPhoto(empreendimento.id, categoria, file);
    if (photo) setPhotos((prev) => [...prev, photo]);
  }

  async function handleRemovePhoto(photoId: string) {
    if (!empreendimento) return;
    const ok = await handleDeleteEmpreendimentoPhoto(empreendimento.id, photoId);
    if (ok) setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }

  // Troca de posicao DENTRO DA MESMA CATEGORIA - as fotos das outras
  // categorias nao entram no calculo (ver ReorderEmpreendimentoPhotosUseCase).
  async function handleMovePhoto(categoria: string, index: number, direction: -1 | 1) {
    if (!empreendimento) return;
    const daCategoria = photos.filter((p) => p.categoria === categoria);
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= daCategoria.length) return;

    const reordered = [...daCategoria];
    [reordered[index], reordered[targetIndex]] = [reordered[targetIndex], reordered[index]];

    const outrasCategorias = photos.filter((p) => p.categoria !== categoria);
    setPhotos([...outrasCategorias, ...reordered]);

    const updated = await handleReorderEmpreendimentoPhotos(
      empreendimento.id,
      categoria,
      reordered.map((p) => p.id),
    );
    if (updated) {
      setPhotos([...outrasCategorias, ...updated]);
    } else {
      // Reorder falhou no backend - desfaz a troca otimista.
      setPhotos(photos);
    }
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-2 bg-slate-50 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        <p className="text-sm">Carregando empreendimento...</p>
      </div>
    );
  }

  if (notFound || !empreendimento) {
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

  const temFichaTecnica = empreendimento.origemImportacao === "ia_pdf";

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/imoveis"
            className="text-slate-400 hover:text-slate-600"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">{empreendimento.name}</h1>
            <p className="text-sm text-slate-500">
              {empreendimento.rua}, {empreendimento.numero} - {empreendimento.bairro},{" "}
              {empreendimento.cidade}/{empreendimento.uf}
            </p>
          </div>
        </div>
        <Link
          href={`/dashboard/imoveis/empreendimentos/${empreendimentoId}/lote`}
          className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <LayoutGrid className="h-4 w-4" /> Cadastro em Lote
        </Link>
      </header>

      <div className="space-y-6 p-6">
        {/* Revisao e Publicacao - sempre visivel, com destaque quando pendente. */}
        <div
          className={`rounded-2xl border p-5 ${
            empreendimento.publicado
              ? "border-slate-200 bg-white"
              : "border-amber-300 bg-amber-50"
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {empreendimento.publicado ? (
                <span className="flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                  <CheckCircle2 className="h-4 w-4" /> Publicado
                </span>
              ) : (
                <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800">
                  <Clock className="h-4 w-4" /> Pendente de revisao
                </span>
              )}
              <span className="text-sm text-slate-500">
                {getOrigemImportacaoLabel(empreendimento.origemImportacao)}
              </span>
            </div>

            {empreendimento.publicado ? (
              <button
                onClick={handleDespublicarClick}
                disabled={isTogglingPublicacao}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Despublicar
              </button>
            ) : (
              <button
                onClick={handlePublicarClick}
                disabled={isTogglingPublicacao}
                className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
              >
                Publicar empreendimento
              </button>
            )}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-medium text-slate-500">Unidades cadastradas</p>
              <p className="text-xl font-semibold text-slate-800">{unidadesCadastradas}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-xs font-medium text-slate-500">Tipologias</p>
              <p className="text-xl font-semibold text-slate-800">{tipologias.length}</p>
            </div>
          </div>
        </div>

        {/* Ficha tecnica extraida via IA (Fatia 3c) - so mostra dados se ja
            tiver sido confirmada ao menos uma vez. O fluxo de UPLOAD do PDF
            ainda nao tem tela propria (fora do escopo desta fatia) - ver
            CLAUDE.md. */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800">Ficha Tecnica (extraida via IA)</h2>
            {temFichaTecnica && !isEditingFicha && (
              <button
                onClick={handleIniciarEdicaoFicha}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Editar
              </button>
            )}
          </div>

          {!temFichaTecnica ? (
            <p className="text-sm text-slate-400">
              Nenhuma ficha tecnica importada via IA ainda. A importacao de PDF acontece via
              API (POST /empreendimentos/:id/importar-pdf + confirmar-ficha-tecnica) - a tela
              de upload ainda nao foi construida.
            </p>
          ) : !isEditingFicha || !fichaForm ? (
            <div className="grid gap-4 sm:grid-cols-3">
              <FichaCampo label="Area do terreno (m2)" valor={empreendimento.areaTerreno} />
              <FichaCampo label="Total de unidades (declarado)" valor={empreendimento.totalUnidades} />
              <FichaCampo label="Numero de torres" valor={empreendimento.numeroTorres} />
              <FichaCampo label="Unidades por andar" valor={empreendimento.unidadesPorAndar} />
              <FichaCampo label="Gabarito (pavimentos)" valor={empreendimento.gabarito} />
              <FichaCampo label="Vagas de garagem" valor={empreendimento.vagas} />
              <div className="sm:col-span-3">
                <p className="text-xs font-medium text-slate-500">Descricao</p>
                <p className="text-sm text-slate-700">{empreendimento.description || "-"}</p>
              </div>
              <div className="sm:col-span-3">
                <p className="mb-1 text-xs font-medium text-slate-500">Itens de lazer</p>
                {empreendimento.itensLazer.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {empreendimento.itensLazer.map((item, i) => (
                      <span
                        key={i}
                        className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">-</p>
                )}
              </div>
              <div className="sm:col-span-3">
                <p className="mb-1 text-xs font-medium text-slate-500">Tipologias</p>
                {tipologias.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
                          <th className="px-3 py-2 font-medium">Nome</th>
                          <th className="px-3 py-2 font-medium">Area privativa</th>
                          <th className="px-3 py-2 font-medium">Dormitorios</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tipologias.map((tipologia) => (
                          <tr key={tipologia.id} className="border-b border-slate-100 last:border-0">
                            <td className="px-3 py-2 text-slate-700">{tipologia.nome}</td>
                            <td className="px-3 py-2 text-slate-700">
                              {tipologia.areaPrivativa !== null ? `${tipologia.areaPrivativa} m2` : "-"}
                            </td>
                            <td className="px-3 py-2 text-slate-700">{tipologia.dormitorios ?? "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">-</p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <NumeroInput
                  label="Area do terreno (m2)"
                  value={fichaForm.areaTerreno}
                  onChange={(v) => updateFichaField("areaTerreno", v)}
                />
                <NumeroInput
                  label="Total de unidades (declarado)"
                  value={fichaForm.totalUnidades}
                  onChange={(v) => updateFichaField("totalUnidades", v)}
                />
                <NumeroInput
                  label="Numero de torres"
                  value={fichaForm.numeroTorres}
                  onChange={(v) => updateFichaField("numeroTorres", v)}
                />
                <NumeroInput
                  label="Unidades por andar"
                  value={fichaForm.unidadesPorAndar}
                  onChange={(v) => updateFichaField("unidadesPorAndar", v)}
                />
                <NumeroInput
                  label="Gabarito (pavimentos)"
                  value={fichaForm.gabarito}
                  onChange={(v) => updateFichaField("gabarito", v)}
                />
                <NumeroInput
                  label="Vagas de garagem"
                  value={fichaForm.vagas}
                  onChange={(v) => updateFichaField("vagas", v)}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Descricao</label>
                <textarea
                  value={fichaForm.descricao}
                  onChange={(e) => updateFichaField("descricao", e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Itens de lazer</label>
                <div className="space-y-2">
                  {fichaForm.itensLazer.map((item, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={item}
                        onChange={(e) => updateItemLazer(i, e.target.value)}
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                      <button
                        onClick={() => removeItemLazer(i)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 hover:text-red-600"
                        aria-label="Remover item"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addItemLazer}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar item
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Tipologias</label>
                <div className="space-y-2">
                  {fichaForm.tipologias.map((tipologia) => (
                    <div key={tipologia.key} className="flex items-center gap-2">
                      <input
                        placeholder="Nome (ex: Garden Ponta)"
                        value={tipologia.nome}
                        onChange={(e) => updateTipologia(tipologia.key, { nome: e.target.value })}
                        className="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                      <input
                        placeholder="Area (m2)"
                        type="number"
                        value={tipologia.areaPrivativa}
                        onChange={(e) =>
                          updateTipologia(tipologia.key, { areaPrivativa: e.target.value })
                        }
                        className="w-28 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                      <input
                        placeholder="Dorm."
                        type="number"
                        value={tipologia.dormitorios}
                        onChange={(e) =>
                          updateTipologia(tipologia.key, { dormitorios: e.target.value })
                        }
                        className="w-20 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                      />
                      <button
                        onClick={() => removeTipologia(tipologia.key)}
                        className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:bg-slate-50 hover:text-red-600"
                        aria-label="Remover tipologia"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={addTipologia}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar tipologia
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={handleSalvarFicha}
                  disabled={isSavingFicha}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {isSavingFicha ? "Salvando..." : "Salvar"}
                </button>
                <button
                  onClick={handleCancelarEdicaoFicha}
                  disabled={isSavingFicha}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Fotos do Empreendimento (Fatia 5) - planta/area comum, separado
            das fotos de UNIDADE (essas continuam em ImovelDetailPanel.tsx,
            no nivel do Imovel). */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-800">Fotos do Empreendimento</h2>
          <div className="space-y-6">
            {EMPREENDIMENTO_PHOTO_CATEGORIA_OPTIONS.map((categoriaOption) => (
              <EmpreendimentoPhotoCategorySection
                key={categoriaOption.value}
                label={categoriaOption.label}
                photos={photos.filter((p) => p.categoria === categoriaOption.value)}
                onUpload={(file) => handleUploadPhotoCategoria(categoriaOption.value, file)}
                onRemove={handleRemovePhoto}
                onMove={(index, direction) =>
                  handleMovePhoto(categoriaOption.value, index, direction)
                }
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmpreendimentoPhotoCategorySection({
  label,
  photos,
  onUpload,
  onRemove,
  onMove,
}: {
  label: string;
  photos: EmpreendimentoPhoto[];
  onUpload: (file: File) => void;
  onRemove: (photoId: string) => void;
  onMove: (index: number, direction: -1 | 1) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <h3 className="mb-2 text-xs font-medium uppercase text-slate-500">{label}</h3>
      <div className="flex flex-wrap gap-3">
        {photos.map((photo, index) => (
          <div
            key={photo.id}
            className="group relative h-24 w-24 overflow-hidden rounded-lg border border-slate-200"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${API_BASE_URL}${photo.url}`}
              alt={label}
              className="h-full w-full object-cover"
            />
            <button
              type="button"
              onClick={() => onRemove(photo.id)}
              className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-1 text-white group-hover:block"
              aria-label="Remover foto"
            >
              <X className="h-3 w-3" />
            </button>
            <div className="absolute inset-x-1 bottom-1 hidden items-center justify-between group-hover:flex">
              <button
                type="button"
                onClick={() => onMove(index, -1)}
                disabled={index === 0}
                className="rounded-full bg-black/60 p-1 text-white disabled:opacity-30"
                aria-label="Mover para a esquerda"
              >
                <ArrowLeft className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => onMove(index, 1)}
                disabled={index === photos.length - 1}
                className="rounded-full bg-black/60 p-1 text-white disabled:opacity-30"
                aria-label="Mover para a direita"
              >
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-slate-400 hover:border-blue-400 hover:text-blue-600 disabled:opacity-60"
        >
          <Plus className="h-5 w-5" />
          <span className="text-xs">{uploading ? "Enviando..." : "Adicionar"}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>
    </div>
  );
}

function FichaCampo({ label, valor }: { label: string; valor: number | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="text-sm text-slate-700">{valor !== null ? valor : "-"}</p>
    </div>
  );
}

function NumeroInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (valor: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-500">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
      />
    </div>
  );
}
