// src/app/dashboard/imoveis/empreendimentos/book/page.tsx
// Importar o "book" (PDF de apresentacao da construtora):
// 1) envia o PDF -> o sistema separa as paginas e a IA sugere a categoria de
//    cada uma (fachada, lazer, planta, ficha tecnica...) e le a ficha tecnica;
// 2) o usuario revisa tudo nesta tela;
// 3) salvar cria o empreendimento (ou completa um existente, via
//    ?empreendimentoId=) com a ficha tecnica e as fotos.
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, FileUp, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";
import type { PaginaRevisao } from "@/features/imoveis/components/book/BookPaginasGrid";
import { BOOK_CATEGORIA_OPTIONS } from "@/features/imoveis/constants";

const BookPaginasGrid = dynamic(
  () => import("@/features/imoveis/components/book/BookPaginasGrid").then((m) => m.BookPaginasGrid),
  { ssr: false, loading: () => <p className="text-sm text-slate-500">Carregando páginas...</p> },
);

const MAX_MB = 80;
const CATEGORIAS_FOTO = ["fachada", "area_comum", "decorado", "planta", "localizacao"];
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");

interface FichaIA {
  nome: string | null;
  descricao: string | null;
  areaTerreno: number | null;
  totalUnidades: number | null;
  numeroTorres: number | null;
  unidadesPorAndar: number | null;
  gabarito: number | null;
  vagas: number | null;
  tipologias: { nome: string; areaPrivativa: number | null; dormitorios: number | null }[];
  itensLazer: string[];
}

interface Analise {
  bookId: string;
  totalPaginas: number;
  paginas: PaginaRevisao[];
  nome: string | null;
  construtora: string | null;
  endereco: { rua: string | null; numero: string | null; bairro: string | null; cidade: string | null; uf: string | null; cep: string | null };
  ficha: FichaIA;
  avisos: string[];
}

type Etapa = "envio" | "analisando" | "revisao" | "salvando";

const campo =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

function numOuNulo(v: string, inteiro = false): number | null {
  const n = Number(v.replace(",", "."));
  if (!v.trim() || !Number.isFinite(n) || n < 0) return null;
  return inteiro ? Math.round(n) : n;
}
const txt = (v: number | null) => (v === null || v === undefined ? "" : String(v));

function mensagemDeErro(err: unknown, padrao: string): string {
  if (err instanceof ApiError) {
    if (err.status === 413) return `O arquivo é grande demais (máximo ${MAX_MB} MB).`;
    if (err.status === 429) return "Muitas importações seguidas. Aguarde um pouco e tente de novo.";
    return err.message;
  }
  if (err instanceof TypeError) return "Não foi possível conectar ao servidor. Verifique sua internet.";
  return padrao;
}

function Campo({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function ImportarBook() {
  const router = useRouter();
  const params = useSearchParams();
  const empreendimentoId = params.get("empreendimentoId");

  const [etapa, setEtapa] = useState<Etapa>("envio");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [paginas, setPaginas] = useState<PaginaRevisao[]>([]);
  const [nomeExistente, setNomeExistente] = useState<string | null>(null);

  // Dados do empreendimento novo
  const [dados, setDados] = useState({ name: "", construtora: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", cep: "", statusObra: "lancamento" });
  // Ficha tecnica
  const [ficha, setFicha] = useState({ descricao: "", areaTerreno: "", totalUnidades: "", numeroTorres: "", unidadesPorAndar: "", gabarito: "", vagas: "", lazer: "" });
  const [tipologias, setTipologias] = useState<{ nome: string; area: string; dorms: string }[]>([]);

  useEffect(() => {
    if (!empreendimentoId) return;
    apiRequest<{ id: string; name: string }[]>("/empreendimentos")
      .then((lista) => setNomeExistente(lista.find((e) => e.id === empreendimentoId)?.name ?? null))
      .catch(() => setNomeExistente(null));
  }, [empreendimentoId]);

  function escolherArquivo(f: File | null) {
    setErro(null);
    if (!f) return;
    const ehPdf = f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf");
    if (!ehPdf) return setErro("Escolha um arquivo PDF.");
    if (f.size > MAX_MB * 1024 * 1024) return setErro(`O PDF pode ter no máximo ${MAX_MB} MB.`);
    setArquivo(f);
  }

  async function analisar() {
    if (!arquivo) return;
    setErro(null);
    setEtapa("analisando");
    const form = new FormData();
    form.append("file", arquivo);
    if (empreendimentoId) form.append("empreendimentoId", empreendimentoId);
    try {
      const r = await apiRequest<Analise>("/empreendimentos/book/analisar", { method: "POST", body: form });
      setAnalise(r);
      setPaginas(r.paginas);
      setDados((d) => ({
        ...d,
        name: r.nome ?? "",
        construtora: r.construtora ?? "",
        rua: r.endereco.rua ?? "",
        numero: r.endereco.numero ?? "",
        bairro: r.endereco.bairro ?? "",
        cidade: r.endereco.cidade ?? "",
        uf: r.endereco.uf ?? "",
        cep: r.endereco.cep ?? "",
      }));
      setFicha({
        descricao: r.ficha.descricao ?? "",
        areaTerreno: txt(r.ficha.areaTerreno),
        totalUnidades: txt(r.ficha.totalUnidades),
        numeroTorres: txt(r.ficha.numeroTorres),
        unidadesPorAndar: txt(r.ficha.unidadesPorAndar),
        gabarito: txt(r.ficha.gabarito),
        vagas: txt(r.ficha.vagas),
        lazer: r.ficha.itensLazer.join("\n"),
      });
      setTipologias(r.ficha.tipologias.map((t) => ({ nome: t.nome, area: txt(t.areaPrivativa), dorms: txt(t.dormitorios) })));
      setEtapa("revisao");
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível analisar o PDF."));
      setEtapa("envio");
    }
  }

  const contagem = useMemo(() => {
    const c: Record<string, number> = {};
    for (const p of paginas) c[p.categoria] = (c[p.categoria] ?? 0) + 1;
    return c;
  }, [paginas]);
  const totalFotos = paginas.filter((p) => CATEGORIAS_FOTO.includes(p.categoria)).length;

  function validar(): string | null {
    if (empreendimentoId) return null;
    if (dados.name.trim().length < 2) return "Informe o nome do empreendimento.";
    if (dados.rua.trim().length < 2) return "Informe a rua.";
    if (!dados.numero.trim()) return 'Informe o número (use "s/n" se não houver).';
    if (dados.bairro.trim().length < 2) return "Informe o bairro.";
    if (dados.cidade.trim().length < 2) return "Informe a cidade.";
    if (!UFS.includes(dados.uf)) return "Escolha a UF.";
    if (!/^\d{5}-?\d{3}$/.test(dados.cep.trim())) return "Informe o CEP (ex: 01234-567).";
    return null;
  }

  async function salvar() {
    if (!analise) return;
    const problema = validar();
    if (problema) {
      setErro(problema);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setErro(null);
    setEtapa("salvando");
    const corpo = {
      bookId: analise.bookId,
      ...(empreendimentoId
        ? { empreendimentoId }
        : {
            novo: {
              name: dados.name.trim(),
              rua: dados.rua.trim(),
              numero: dados.numero.trim(),
              complemento: dados.complemento.trim() || undefined,
              bairro: dados.bairro.trim(),
              cidade: dados.cidade.trim(),
              uf: dados.uf,
              cep: dados.cep.trim(),
              construtora: dados.construtora.trim() || undefined,
              statusObra: dados.statusObra || undefined,
            },
          }),
      ficha: {
        descricao: ficha.descricao.trim() || null,
        areaTerreno: numOuNulo(ficha.areaTerreno),
        totalUnidades: numOuNulo(ficha.totalUnidades, true),
        numeroTorres: numOuNulo(ficha.numeroTorres, true),
        unidadesPorAndar: numOuNulo(ficha.unidadesPorAndar, true),
        gabarito: numOuNulo(ficha.gabarito, true),
        vagas: numOuNulo(ficha.vagas, true),
        itensLazer: ficha.lazer.split("\n").map((l) => l.trim()).filter(Boolean),
        tipologias: tipologias
          .filter((t) => t.nome.trim())
          .map((t) => ({ nome: t.nome.trim(), areaPrivativa: numOuNulo(t.area), dormitorios: numOuNulo(t.dorms, true) })),
      },
      paginas: paginas.map((p) => ({ numero: p.numero, categoria: p.categoria })),
    };
    try {
      const r = await apiRequest<{ empreendimentoId: string; fotosCriadas: number }>("/empreendimentos/book/confirmar", {
        method: "POST",
        body: JSON.stringify(corpo),
      });
      router.push(`/dashboard/imoveis/empreendimentos/${r.empreendimentoId}?book=${r.fotosCriadas}`);
    } catch (err) {
      setErro(mensagemDeErro(err, "Não foi possível salvar."));
      setEtapa("revisao");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const voltarHref = empreendimentoId ? `/dashboard/imoveis/empreendimentos/${empreendimentoId}` : "/dashboard/imoveis";

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <Link href={voltarHref} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-700">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-lg font-semibold text-slate-800">
          {empreendimentoId ? `Importar book — ${nomeExistente ?? "empreendimento"}` : "Novo empreendimento a partir do book (PDF)"}
        </h1>
        <p className="text-sm text-slate-500">
          Envie o PDF de apresentação da construtora. O sistema separa as páginas, identifica fachada, lazer, plantas e
          ficha técnica, e você revisa antes de salvar.
        </p>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        {erro && (
          <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {erro}
          </div>
        )}

        {(etapa === "envio" || etapa === "analisando") && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <label
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (etapa === "envio") escolherArquivo(e.dataTransfer.files?.[0] ?? null);
              }}
              className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-6 py-12 text-center hover:border-blue-500 hover:bg-blue-50/40"
            >
              <FileUp className="h-10 w-10 text-slate-400" aria-hidden />
              <span className="font-medium text-slate-700">
                {arquivo ? arquivo.name : "Arraste o PDF aqui ou clique para escolher"}
              </span>
              <span className="text-xs text-slate-500">
                {arquivo ? `${(arquivo.size / 1024 / 1024).toFixed(1)} MB` : `Somente PDF, até ${MAX_MB} MB e 80 páginas`}
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                disabled={etapa === "analisando"}
                onChange={(e) => escolherArquivo(e.target.files?.[0] ?? null)}
              />
            </label>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={analisar}
                disabled={!arquivo || etapa === "analisando"}
                className="flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
              >
                {etapa === "analisando" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {etapa === "analisando" ? "Lendo o PDF e separando as páginas..." : "Analisar PDF"}
              </button>
            </div>
            {etapa === "analisando" && (
              <p role="status" className="mt-2 text-right text-xs text-slate-500">
                Isso pode levar até 1 minuto em books grandes. Não feche esta página.
              </p>
            )}
          </section>
        )}

        {(etapa === "revisao" || etapa === "salvando") && analise && arquivo && (
          <>
            {analise.avisos.length > 0 && (
              <div className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {analise.avisos.map((a) => (
                  <p key={a} className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden /> {a}
                  </p>
                ))}
              </div>
            )}

            {!empreendimentoId && (
              <section className="rounded-2xl border border-slate-200 bg-white p-6">
                <h2 className="mb-1 text-sm font-semibold text-slate-800">Dados do empreendimento</h2>
                <p className="mb-4 text-xs text-slate-500">Preenchido com o que estava escrito no book. Confira e complete.</p>
                <div className="grid gap-3 sm:grid-cols-6">
                  <Campo label="Nome *" className="sm:col-span-4">
                    <input className={campo} value={dados.name} onChange={(e) => setDados({ ...dados, name: e.target.value })} maxLength={150} />
                  </Campo>
                  <Campo label="Situação" className="sm:col-span-2">
                    <select className={campo} value={dados.statusObra} onChange={(e) => setDados({ ...dados, statusObra: e.target.value })}>
                      <option value="breve_lancamento">Breve lançamento</option>
                      <option value="lancamento">Lançamento</option>
                      <option value="em_obras">Em obras</option>
                      <option value="pronto">Pronto</option>
                    </select>
                  </Campo>
                  <Campo label="Construtora" className="sm:col-span-6">
                    <input className={campo} value={dados.construtora} onChange={(e) => setDados({ ...dados, construtora: e.target.value })} maxLength={150} />
                  </Campo>
                  <Campo label="Rua *" className="sm:col-span-4">
                    <input className={campo} value={dados.rua} onChange={(e) => setDados({ ...dados, rua: e.target.value })} maxLength={200} />
                  </Campo>
                  <Campo label="Número *" className="sm:col-span-1">
                    <input className={campo} value={dados.numero} onChange={(e) => setDados({ ...dados, numero: e.target.value })} maxLength={20} />
                  </Campo>
                  <Campo label="Complemento" className="sm:col-span-1">
                    <input className={campo} value={dados.complemento} onChange={(e) => setDados({ ...dados, complemento: e.target.value })} maxLength={100} />
                  </Campo>
                  <Campo label="Bairro *" className="sm:col-span-2">
                    <input className={campo} value={dados.bairro} onChange={(e) => setDados({ ...dados, bairro: e.target.value })} maxLength={100} />
                  </Campo>
                  <Campo label="Cidade *" className="sm:col-span-2">
                    <input className={campo} value={dados.cidade} onChange={(e) => setDados({ ...dados, cidade: e.target.value })} maxLength={100} />
                  </Campo>
                  <Campo label="UF *" className="sm:col-span-1">
                    <select className={campo} value={dados.uf} onChange={(e) => setDados({ ...dados, uf: e.target.value })}>
                      <option value="">—</option>
                      {UFS.map((u) => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </Campo>
                  <Campo label="CEP *" className="sm:col-span-1">
                    <input
                      className={campo}
                      inputMode="numeric"
                      placeholder="00000-000"
                      value={dados.cep}
                      onChange={(e) => {
                        const d = e.target.value.replace(/\D/g, "").slice(0, 8);
                        setDados({ ...dados, cep: d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d });
                      }}
                    />
                  </Campo>
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <h2 className="mb-1 text-sm font-semibold text-slate-800">Ficha técnica</h2>
              <p className="mb-4 text-xs text-slate-500">
                Só o que está escrito no PDF foi preenchido — campos vazios não foram encontrados. Preços e condições comerciais
                são ignorados.
                {empreendimentoId && " Campos deixados em branco mantêm o que já está cadastrado no empreendimento."}
              </p>
              <div className="grid gap-3 sm:grid-cols-6">
                <Campo label="Área do terreno (m²)" className="sm:col-span-2">
                  <input className={campo} inputMode="decimal" value={ficha.areaTerreno} onChange={(e) => setFicha({ ...ficha, areaTerreno: e.target.value })} />
                </Campo>
                <Campo label="Total de unidades" className="sm:col-span-2">
                  <input className={campo} inputMode="numeric" value={ficha.totalUnidades} onChange={(e) => setFicha({ ...ficha, totalUnidades: e.target.value })} />
                </Campo>
                <Campo label="Torres/blocos" className="sm:col-span-2">
                  <input className={campo} inputMode="numeric" value={ficha.numeroTorres} onChange={(e) => setFicha({ ...ficha, numeroTorres: e.target.value })} />
                </Campo>
                <Campo label="Unidades por andar" className="sm:col-span-2">
                  <input className={campo} inputMode="numeric" value={ficha.unidadesPorAndar} onChange={(e) => setFicha({ ...ficha, unidadesPorAndar: e.target.value })} />
                </Campo>
                <Campo label="Pavimentos" className="sm:col-span-2">
                  <input className={campo} inputMode="numeric" value={ficha.gabarito} onChange={(e) => setFicha({ ...ficha, gabarito: e.target.value })} />
                </Campo>
                <Campo label="Vagas" className="sm:col-span-2">
                  <input className={campo} inputMode="numeric" value={ficha.vagas} onChange={(e) => setFicha({ ...ficha, vagas: e.target.value })} />
                </Campo>
                <Campo label="Descrição" className="sm:col-span-6">
                  <textarea rows={4} className={campo} value={ficha.descricao} onChange={(e) => setFicha({ ...ficha, descricao: e.target.value })} />
                </Campo>
                <Campo label="Itens de lazer (um por linha)" className="sm:col-span-3">
                  <textarea rows={6} className={campo} value={ficha.lazer} onChange={(e) => setFicha({ ...ficha, lazer: e.target.value })} />
                </Campo>
                <div className="sm:col-span-3">
                  <span className="mb-1 block text-xs font-medium text-slate-600">Plantas (tipologias)</span>
                  <ul className="space-y-2">
                    {tipologias.map((t, i) => (
                      <li key={i} className="grid grid-cols-[minmax(0,1fr)_5rem_5rem_2.5rem] gap-2">
                        <input aria-label="Nome da planta" placeholder="Nome" className={campo} value={t.nome}
                          onChange={(e) => setTipologias(tipologias.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))} />
                        <input aria-label="Área (m²)" placeholder="m²" inputMode="decimal" className={campo} value={t.area}
                          onChange={(e) => setTipologias(tipologias.map((x, j) => (j === i ? { ...x, area: e.target.value } : x)))} />
                        <input aria-label="Dormitórios" placeholder="dorms" inputMode="numeric" className={campo} value={t.dorms}
                          onChange={(e) => setTipologias(tipologias.map((x, j) => (j === i ? { ...x, dorms: e.target.value } : x)))} />
                        <button type="button" aria-label="Remover planta" onClick={() => setTipologias(tipologias.filter((_, j) => j !== i))}
                          className="flex items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button type="button" onClick={() => setTipologias([...tipologias, { nome: "", area: "", dorms: "" }])}
                    className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline">
                    <Plus className="h-4 w-4" /> Adicionar planta
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6">
              <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Páginas do book ({analise.totalPaginas})</h2>
                  <p className="text-xs text-slate-500">
                    Confira a categoria de cada página. As de Fachada, Lazer, Decorado, Planta e Localização viram fotos do
                    empreendimento (a 1ª fachada é a capa).
                  </p>
                </div>
                <p className="text-xs text-slate-600">
                  {BOOK_CATEGORIA_OPTIONS.filter((o) => contagem[o.value]).map((o) => `${o.label}: ${contagem[o.value]}`).join(" · ")}
                </p>
              </div>
              <BookPaginasGrid
                arquivo={arquivo}
                paginas={paginas}
                onMudarCategoria={(numero, categoria) =>
                  setPaginas((ps) => ps.map((p) => (p.numero === numero ? { ...p, categoria } : p)))
                }
              />
            </section>

            <div className="sticky bottom-0 -mx-6 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-6 py-3 backdrop-blur">
              <span className="mr-auto text-sm text-slate-600">
                {totalFotos} {totalFotos === 1 ? "página vai virar foto" : "páginas vão virar fotos"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEtapa("envio");
                  setAnalise(null);
                  setArquivo(null);
                  setPaginas([]);
                  setErro(null);
                }}
                disabled={etapa === "salvando"}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Trocar PDF
              </button>
              <button
                type="button"
                onClick={salvar}
                disabled={etapa === "salvando"}
                className="flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
              >
                {etapa === "salvando" && <Loader2 className="h-4 w-4 animate-spin" />}
                {etapa === "salvando" ? "Salvando fotos..." : empreendimentoId ? "Salvar no empreendimento" : "Criar empreendimento"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function ImportarBookPage() {
  // useSearchParams exige Suspense no App Router.
  return (
    <Suspense fallback={null}>
      <ImportarBook />
    </Suspense>
  );
}
