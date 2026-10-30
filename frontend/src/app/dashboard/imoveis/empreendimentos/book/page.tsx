// src/app/dashboard/imoveis/empreendimentos/book/page.tsx
// Importar o "book" (material de apresentacao da construtora): 1 PDF OU de 1
// a 80 imagens JPG/JPEG (uma por pagina, na ordem escolhida aqui).
// 1) envia o PDF ("file") ou as imagens ("files") -> o sistema separa as
//    paginas e a IA sugere a categoria de cada uma (fachada, lazer, planta,
//    ficha tecnica...) e le a ficha tecnica;
// 2) o usuario revisa tudo nesta tela;
// 3) salvar cria o empreendimento (ou completa um existente, via
//    ?empreendimentoId=) com a ficha tecnica e as fotos.
"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowLeft, FileText, FileUp, Info, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";
import type { FonteBook, PaginaRevisao } from "@/features/imoveis/components/book/BookPaginasGrid";
import { BookImagensSelecionadas } from "@/features/imoveis/components/book/BookImagensSelecionadas";
import { ConstrutoraSelect } from "@/features/imoveis/components/construtoras/ConstrutoraSelect";
import { normalizarNomeConstrutora, useConstrutoras } from "@/features/imoveis/hooks/useConstrutoras";
import {
  BOOK_ACCEPT,
  BOOK_MAX_IMAGENS,
  BOOK_MAX_MB,
  BOOK_MAX_MB_POR_IMAGEM,
  combinarSelecao,
  formatarMb,
  problemaDimensoes,
  totalBytes,
  type ImagemBook,
  type SelecaoBook,
} from "@/features/imoveis/components/book/arquivosBook";
import { BOOK_CATEGORIA_OPTIONS } from "@/features/imoveis/constants";
import { SomenteAdminGuard, destinoComAviso } from "@/features/imoveis/components/SomenteAdminGuard";

const BookPaginasGrid = dynamic(
  () => import("@/features/imoveis/components/book/BookPaginasGrid").then((m) => m.BookPaginasGrid),
  { ssr: false, loading: () => <p className="text-sm text-slate-500">Carregando páginas...</p> },
);

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
  origem?: "pdf" | "imagens";
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
    if (err.status === 413) return `O envio é grande demais: o book pode ter no máximo ${BOOK_MAX_MB} MB no total e ${BOOK_MAX_MB_POR_IMAGEM} MB por imagem.`;
    if (err.status === 411) return "O navegador não informou o tamanho do envio. Escolha os arquivos e tente de novo.";
    if (err.status === 503) return "Servidor ocupado, tente em instantes.";
    if (err.status === 409) return err.message || "Este book já está sendo salvo. Aguarde.";
    if (err.status === 429) return "Muitas importações seguidas. Aguarde um pouco e tente de novo.";
    if (err.status === 400) {
      // Erros do multer chegam em ingles.
      if (/too many files|unexpected field/i.test(err.message)) return `O book pode ter no máximo ${BOOK_MAX_IMAGENS} imagens.`;
      if (/file too large/i.test(err.message)) return `Um dos arquivos passa do limite (${BOOK_MAX_MB_POR_IMAGEM} MB por imagem, ${BOOK_MAX_MB} MB no total).`;
      return err.message || padrao;
    }
    if (err.status >= 500) return `${padrao} Tente de novo em instantes.`;
    return err.message;
  }
  if (err instanceof TypeError) return "Não foi possível conectar ao servidor. Verifique sua internet.";
  return padrao;
}

const duracao = (seg: number) => `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`;

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
  const [selecao, setSelecao] = useState<SelecaoBook>({ tipo: "vazio" });
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [soltando, setSoltando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const selecaoRef = useRef<SelecaoBook>(selecao);
  const enviandoRef = useRef(false);
  const [analise, setAnalise] = useState<Analise | null>(null);
  const [paginas, setPaginas] = useState<PaginaRevisao[]>([]);
  const [nomeExistente, setNomeExistente] = useState<string | null>(null);

  // Dados do empreendimento novo
  const [dados, setDados] = useState({ name: "", construtora: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", cep: "", statusObra: "lancamento" });
  // Ficha tecnica
  const [ficha, setFicha] = useState({ descricao: "", areaTerreno: "", totalUnidades: "", numeroTorres: "", unidadesPorAndar: "", gabarito: "", vagas: "", lazer: "" });
  const [tipologias, setTipologias] = useState<{ nome: string; area: string; dorms: string }[]>([]);
  // Construtoras (Fatia A): dados.construtora guarda so o nome LIDO do book
  // (sugestao). O vinculo e o seletor: casa sozinho com uma construtora ja
  // cadastrada pelo nome normalizado; sem casamento e sem escolha manual, o
  // nome lido vai como texto e o backend acha/cria a construtora.
  const { construtoras } = useConstrutoras();
  const [construtoraId, setConstrutoraId] = useState("");
  const [construtoraEscolhida, setConstrutoraEscolhida] = useState(false);
  useEffect(() => {
    if (construtoraEscolhida || construtoraId || !dados.construtora.trim()) return;
    const chave = normalizarNomeConstrutora(dados.construtora);
    const existente = construtoras.find((c) => c.nomeNormalizado === chave);
    if (existente) setConstrutoraId(existente.id);
  }, [construtoras, dados.construtora, construtoraEscolhida, construtoraId]);

  useEffect(() => {
    if (!empreendimentoId) return;
    apiRequest<{ id: string; name: string }[]>("/empreendimentos")
      .then((lista) => setNomeExistente(lista.find((e) => e.id === empreendimentoId)?.name ?? null))
      .catch(() => setNomeExistente(null));
  }, [empreendimentoId]);

  // Fonte da verdade sincrona (o handler async le a selecao mais recente).
  const trocarSelecao = useCallback((nova: SelecaoBook) => {
    selecaoRef.current = nova;
    setSelecao(nova);
  }, []);

  // Libera as object URLs das miniaturas ao sair da tela.
  useEffect(
    () => () => {
      const s = selecaoRef.current;
      if (s.tipo === "imagens") s.imagens.forEach((i) => URL.revokeObjectURL(i.url));
    },
    [],
  );

  // Cronometro e aviso ao fechar a aba durante a analise (1-2 min).
  useEffect(() => {
    if (etapa !== "analisando") return;
    setSegundos(0);
    const inicio = Date.now();
    const t = window.setInterval(() => setSegundos(Math.floor((Date.now() - inicio) / 1000)), 1000);
    const antesDeSair = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", antesDeSair);
    return () => {
      window.clearInterval(t);
      window.removeEventListener("beforeunload", antesDeSair);
    };
  }, [etapa]);

  async function adicionarArquivos(lista: FileList | File[] | null) {
    const novos = Array.from(lista ?? []);
    if (!novos.length || etapa !== "envio") return;
    setErro(null);
    setAviso(null);
    const atual = selecaoRef.current;
    const r = await combinarSelecao(atual, novos);
    if (!r.ok) return setErro(r.erro);
    let nova = r.selecao;
    if (nova.tipo === "imagens") {
      nova = { ...nova, imagens: nova.imagens.map((i) => (i.url ? i : { ...i, url: URL.createObjectURL(i.arquivo) })) };
    }
    trocarSelecao(nova);
    if (r.aviso) setAviso(r.aviso);
  }

  function limparSelecao() {
    const s = selecaoRef.current;
    if (s.tipo === "imagens") s.imagens.forEach((i) => URL.revokeObjectURL(i.url));
    trocarSelecao({ tipo: "vazio" });
  }

  function atualizarImagens(fn: (imgs: ImagemBook[]) => ImagemBook[]) {
    const s = selecaoRef.current;
    if (s.tipo !== "imagens") return;
    const imagens = fn(s.imagens);
    trocarSelecao(imagens.length ? { tipo: "imagens", imagens } : { tipo: "vazio" });
  }

  function removerImagem(id: string) {
    setErro(null);
    setAviso(null);
    atualizarImagens((imgs) => {
      const alvo = imgs.find((i) => i.id === id);
      if (alvo) URL.revokeObjectURL(alvo.url);
      return imgs.filter((i) => i.id !== id);
    });
  }

  function moverImagemPara(id: string, destino: number) {
    atualizarImagens((imgs) => {
      const de = imgs.findIndex((i) => i.id === id);
      if (de < 0 || destino < 0 || destino >= imgs.length || de === destino) return imgs;
      const copia = [...imgs];
      const [item] = copia.splice(de, 1);
      copia.splice(destino, 0, item);
      return copia;
    });
  }

  function moverImagem(id: string, delta: -1 | 1) {
    const s = selecaoRef.current;
    if (s.tipo !== "imagens") return;
    moverImagemPara(id, s.imagens.findIndex((i) => i.id === id) + delta);
  }

  function registrarDimensoes(id: string, largura: number, altura: number) {
    atualizarImagens((imgs) =>
      imgs.map((i) =>
        i.id === id && i.largura === undefined ? { ...i, largura, altura, problema: problemaDimensoes(largura, altura) } : i,
      ),
    );
  }

  const imagensComProblema = selecao.tipo === "imagens" ? selecao.imagens.filter((i) => i.problema).length : 0;
  const ehImagens = selecao.tipo === "imagens";

  async function analisar() {
    const s = selecaoRef.current;
    if (s.tipo === "vazio" || enviandoRef.current) return;
    if (s.tipo === "imagens" && s.imagens.some((i) => i.problema)) {
      return setErro("Remova ou troque as imagens marcadas em vermelho antes de analisar.");
    }
    enviandoRef.current = true;
    setErro(null);
    setAviso(null);
    setEtapa("analisando");
    const form = new FormData();
    if (s.tipo === "pdf") form.append("file", s.arquivo);
    // A ordem do campo "files" e a ordem das paginas.
    else s.imagens.forEach((i) => form.append("files", i.arquivo, i.arquivo.name));
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
      setErro(mensagemDeErro(err, s.tipo === "pdf" ? "Não foi possível analisar o PDF." : "Não foi possível analisar as imagens."));
      setEtapa("envio");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } finally {
      enviandoRef.current = false;
    }
  }

  const fonte = useMemo<FonteBook | null>(() => {
    if (selecao.tipo === "pdf") return { tipo: "pdf", arquivo: selecao.arquivo };
    if (selecao.tipo === "imagens") return { tipo: "imagens", urls: selecao.imagens.map((i) => i.url) };
    return null;
  }, [selecao]);

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
              ...(construtoraId
                ? { construtoraId }
                : !construtoraEscolhida && dados.construtora.trim()
                  ? { construtora: dados.construtora.trim() }
                  : {}),
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
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <Link href={voltarHref} className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-blue-700">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </Link>
        <h1 className="text-lg font-semibold text-slate-800">
          {empreendimentoId ? `Importar book — ${nomeExistente ?? "empreendimento"}` : "Novo empreendimento a partir do book (PDF ou imagens JPG)"}
        </h1>
        <p className="text-sm text-slate-500">
          Envie o PDF de apresentação da construtora ou as imagens JPG das páginas. O sistema separa as páginas,
          identifica fachada, lazer, plantas e ficha técnica, e você revisa antes de salvar.
        </p>
      </header>

      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
        {erro && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" aria-hidden /> <span>{erro}</span>
          </div>
        )}
        {aviso && (
          <div role="status" className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
            <Info className="mt-0.5 h-4 w-4 flex-none" aria-hidden /> <span>{aviso}</span>
          </div>
        )}

        {(etapa === "envio" || etapa === "analisando") && (
          <section
            aria-label="Arquivos do book"
            onDragOver={(e) => {
              if (etapa !== "envio" || !e.dataTransfer.types.includes("Files")) return;
              e.preventDefault();
              setSoltando(true);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setSoltando(false);
            }}
            onDrop={(e) => {
              if (!e.dataTransfer.types.includes("Files")) return;
              e.preventDefault();
              setSoltando(false);
              void adicionarArquivos(e.dataTransfer.files);
            }}
            className={`rounded-2xl border bg-white p-4 transition sm:p-6 ${
              soltando ? "border-blue-500 ring-2 ring-blue-200" : "border-slate-200"
            }`}
          >
            <input
              ref={inputRef}
              type="file"
              accept={BOOK_ACCEPT}
              multiple
              className="hidden"
              tabIndex={-1}
              aria-hidden
              disabled={etapa === "analisando"}
              onChange={(e) => {
                const arquivos = Array.from(e.target.files ?? []);
                // Permite escolher o mesmo arquivo de novo depois de remover.
                e.target.value = "";
                void adicionarArquivos(arquivos);
              }}
            />

            {selecao.tipo === "vazio" && (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-12 text-center transition hover:border-blue-500 hover:bg-blue-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${
                  soltando ? "border-blue-500 bg-blue-50/60" : "border-slate-300"
                }`}
              >
                <FileUp className="h-10 w-10 text-slate-400" aria-hidden />
                <span className="font-medium text-slate-700">Arraste aqui ou clique para escolher</span>
                <span className="max-w-md text-sm text-slate-600">
                  <strong className="font-semibold">1 PDF</strong> (até {BOOK_MAX_MB} MB e {BOOK_MAX_IMAGENS} páginas){" "}
                  <span className="text-slate-500">ou</span>{" "}
                  <strong className="font-semibold">imagens JPG/JPEG</strong>, uma por página (até {BOOK_MAX_IMAGENS} imagens,{" "}
                  {BOOK_MAX_MB_POR_IMAGEM} MB cada, {BOOK_MAX_MB} MB no total)
                </span>
              </button>
            )}

            {selecao.tipo === "pdf" && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-lg bg-white text-blue-700 ring-1 ring-slate-200">
                  <FileText className="h-6 w-6" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800" title={selecao.arquivo.name}>
                    {selecao.arquivo.name}
                  </p>
                  <p className="text-xs text-slate-500">PDF · {formatarMb(selecao.arquivo.size)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    limparSelecao();
                    inputRef.current?.click();
                  }}
                  disabled={etapa === "analisando"}
                  className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50"
                >
                  Trocar arquivo
                </button>
              </div>
            )}

            {selecao.tipo === "imagens" && (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div className="mr-auto">
                    <h2 className="text-sm font-semibold text-slate-800">
                      {selecao.imagens.length} {selecao.imagens.length === 1 ? "imagem" : "imagens"} ·{" "}
                      {formatarMb(totalBytes(selecao))} de {BOOK_MAX_MB} MB
                    </h2>
                    <p className="text-sm text-slate-600">
                      As imagens entram em ordem pelo nome do arquivo; use as setas para ajustar. A ordem vira a ordem das
                      páginas do book.
                    </p>
                    <p className="text-xs text-slate-500">
                      <span className="hidden sm:inline">Você também pode arrastar a miniatura. </span>Até {BOOK_MAX_IMAGENS} imagens.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (selecao.imagens.length > 1 && !window.confirm(`Remover as ${selecao.imagens.length} imagens escolhidas?`)) return;
                      limparSelecao();
                      setErro(null);
                      setAviso(null);
                    }}
                    disabled={etapa === "analisando"}
                    className="min-h-11 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50"
                  >
                    Remover todas
                  </button>
                </div>
                <BookImagensSelecionadas
                  imagens={selecao.imagens}
                  desabilitado={etapa === "analisando"}
                  onMover={moverImagem}
                  onMoverPara={moverImagemPara}
                  onRemover={removerImagem}
                  onDimensoes={registrarDimensoes}
                  onAdicionar={() => inputRef.current?.click()}
                  podeAdicionar={selecao.imagens.length < BOOK_MAX_IMAGENS}
                />
                {imagensComProblema > 0 && (
                  <p className="text-sm font-medium text-red-700">
                    {imagensComProblema === 1
                      ? "1 imagem não pode ser usada (marcada em vermelho)."
                      : `${imagensComProblema} imagens não podem ser usadas (marcadas em vermelho).`}{" "}
                    Remova ou troque antes de analisar.
                  </p>
                )}
              </div>
            )}

            <div className="mt-5 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
              {etapa === "analisando" && (
                <div role="status" aria-live="polite" className="text-sm text-slate-600 sm:mr-auto">
                  <p className="font-medium text-slate-800">
                    {ehImagens ? "Analisando as imagens" : "Lendo o PDF e separando as páginas"}… {duracao(segundos)}
                  </p>
                  <p className="text-xs text-slate-500">
                    Pode levar 1 a 2 minutos em books grandes. Não feche esta página.
                  </p>
                </div>
              )}
              <button
                type="button"
                onClick={analisar}
                disabled={selecao.tipo === "vazio" || etapa === "analisando" || imagensComProblema > 0}
                aria-busy={etapa === "analisando"}
                className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {etapa === "analisando" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                {etapa === "analisando" ? "Analisando..." : ehImagens ? "Analisar imagens" : selecao.tipo === "pdf" ? "Analisar PDF" : "Analisar book"}
              </button>
            </div>
          </section>
        )}

        {(etapa === "revisao" || etapa === "salvando") && analise && fonte && (
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
                  {/* Fora do <Campo> (que e um <label>): o seletor tem o proprio
                      mini-formulario com label e botoes. */}
                  <div className="sm:col-span-6">
                    <label htmlFor="book-construtora" className="mb-1 block text-xs font-medium text-slate-600">
                      Construtora
                    </label>
                    <ConstrutoraSelect
                      id="book-construtora"
                      value={construtoraId}
                      onChange={(id) => {
                        setConstrutoraEscolhida(true);
                        setConstrutoraId(id);
                      }}
                      nomeSugerido={dados.construtora.trim() || undefined}
                      placeholder={
                        !construtoraEscolhida && dados.construtora.trim()
                          ? `Cadastrar "${dados.construtora.trim()}" (lida do book)`
                          : "Sem construtora"
                      }
                    />
                  </div>
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
                Só o que está escrito no book foi preenchido — campos vazios não foram encontrados. Preços e condições comerciais
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
                fonte={fonte}
                paginas={paginas}
                onMudarCategoria={(numero, categoria) =>
                  setPaginas((ps) => ps.map((p) => (p.numero === numero ? { ...p, categoria } : p)))
                }
              />
            </section>

            <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
              <span className="mr-auto text-sm text-slate-600">
                {totalFotos} {totalFotos === 1 ? "página vai virar foto" : "páginas vão virar fotos"}
              </span>
              <button
                type="button"
                onClick={() => {
                  setEtapa("envio");
                  setAnalise(null);
                  limparSelecao();
                  setPaginas([]);
                  setErro(null);
                  setAviso(null);
                }}
                disabled={etapa === "salvando"}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                Trocar arquivo(s)
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

// Permissoes (16/10/2026): importar book e so Administrador.
function ImportarBookSomenteAdmin() {
  const empreendimentoId = useSearchParams().get("empreendimentoId");
  const destino = destinoComAviso(
    empreendimentoId
      ? `/dashboard/imoveis/empreendimentos/${encodeURIComponent(empreendimentoId)}`
      : "/dashboard/imoveis?secao=empreendimentos",
  );
  return (
    <SomenteAdminGuard destino={destino}>
      <ImportarBook />
    </SomenteAdminGuard>
  );
}

export default function ImportarBookPage() {
  // useSearchParams exige Suspense no App Router.
  return (
    <Suspense fallback={null}>
      <ImportarBookSomenteAdmin />
    </Suspense>
  );
}
