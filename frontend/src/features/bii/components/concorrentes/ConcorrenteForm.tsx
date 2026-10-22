// Painel lateral de cadastro/edicao de concorrente (BII Fatia 3): dados gerais,
// tipologias (R$/m2 calculado na hora), vendas, fonte e - depois de salvo - o
// pino no mapa com "Ajustar posicao". O backend valida tudo de novo.
"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Move, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import { formatMoeda } from "../../constants";
import { FASES, LIMITES, precoM2 } from "../../constants-concorrentes";
import { formatPrecoM2 } from "../../constants-endereco";
import {
  atualizarConcorrente,
  criarConcorrente,
  excluirConcorrente,
  mensagemErroConcorrente,
} from "../../hooks/useBiiConcorrentesIntegration";
import type { Concorrente, ConcorrenteInput, FaseConcorrente } from "../../types-concorrentes";

const MapaPinoConcorrente = dynamic(() => import("./MapaPinoConcorrente"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-slate-100">
      <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-label="Carregando mapa" />
    </div>
  ),
});

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50";
const LABEL = "text-xs font-medium text-slate-600";

// Numero digitado no jeito brasileiro: "289.000", "289.000,50", "42,5" ou "42.5".
export function lerNumeroBr(texto: string): number | null | "invalido" {
  const t = texto.trim().replace(/\s|R\$/g, "");
  if (!t) return null;
  let normal: string;
  if (t.includes(",")) normal = t.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) normal = t.replace(/\./g, "");
  else normal = t;
  if (!/^\d+(\.\d+)?$/.test(normal)) return "invalido";
  const n = Number(normal);
  return Number.isFinite(n) ? n : "invalido";
}

function numeroParaTexto(n: number | null): string {
  return n === null ? "" : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

interface LinhaTipologia {
  chave: number;
  descricao: string;
  dormitorios: string;
  area: string;
  precoDe: string;
  precoAte: string;
}

interface Estado {
  nome: string;
  construtora: string;
  endereco: string;
  fase: FaseConcorrente;
  dataLancamento: string;
  totalUnidades: string;
  unidadesVendidas: string;
  fonte: string;
  fonteUrl: string;
  observacoes: string;
}

let proximaChave = 1;
const linhaVazia = (): LinhaTipologia => ({ chave: proximaChave++, descricao: "", dormitorios: "", area: "", precoDe: "", precoAte: "" });

function estadoInicial(c: Concorrente | null): Estado {
  return {
    nome: c?.nome ?? "",
    construtora: c?.construtora ?? "",
    endereco: c?.endereco ?? "",
    fase: c?.fase ?? "lancamento",
    dataLancamento: c?.dataLancamento ?? "",
    totalUnidades: c?.totalUnidades?.toString() ?? "",
    unidadesVendidas: c?.unidadesVendidas?.toString() ?? "",
    fonte: c?.fonte ?? "",
    fonteUrl: c?.fonteUrl ?? "",
    observacoes: c?.observacoes ?? "",
  };
}

function linhasIniciais(c: Concorrente | null): LinhaTipologia[] {
  if (!c || c.tipologias.length === 0) return [linhaVazia()];
  return c.tipologias.map((t) => ({
    chave: proximaChave++,
    descricao: t.descricao,
    dormitorios: t.dormitorios?.toString() ?? "",
    area: numeroParaTexto(t.areaPrivativa),
    precoDe: numeroParaTexto(t.precoDe),
    precoAte: numeroParaTexto(t.precoAte),
  }));
}

function inteiroOuNull(texto: string): number | null | "invalido" {
  const t = texto.trim().replace(/\./g, "");
  if (!t) return null;
  return /^\d+$/.test(t) ? Number(t) : "invalido";
}

type Erros = Partial<Record<keyof Estado | "tipologias" | "geral", string>>;

// Valida e monta o corpo; devolve erros por campo.
function montarInput(e: Estado, linhas: LinhaTipologia[]): { input?: ConcorrenteInput; erros: Erros } {
  const erros: Erros = {};
  const nome = e.nome.trim().replace(/\s+/g, " ");
  if (nome.length < 2) erros.nome = "Informe o nome do empreendimento.";
  const endereco = e.endereco.trim().replace(/\s+/g, " ");
  if (endereco.length < 5) erros.endereco = "Digite o endereço com rua, número e bairro.";
  const total = inteiroOuNull(e.totalUnidades);
  const vendidas = inteiroOuNull(e.unidadesVendidas);
  if (total === "invalido" || (typeof total === "number" && (total < 1 || total > LIMITES.unidadesMax)))
    erros.totalUnidades = "Use um número inteiro maior que zero.";
  if (vendidas === "invalido" || (typeof vendidas === "number" && vendidas > LIMITES.unidadesMax))
    erros.unidadesVendidas = "Use um número inteiro.";
  if (typeof total === "number" && typeof vendidas === "number" && vendidas > total)
    erros.unidadesVendidas = "Não pode passar do total de unidades.";
  const url = e.fonteUrl.trim();
  if (url && !/^https:\/\/[^\s]+\.[^\s]+$/i.test(url)) erros.fonteUrl = "Use um link começando com https://";

  const tipologias: ConcorrenteInput["tipologias"] = [];
  linhas.forEach((l, i) => {
    if (erros.tipologias) return;
    const n = i + 1;
    const area = lerNumeroBr(l.area);
    const de = lerNumeroBr(l.precoDe);
    const ate = lerNumeroBr(l.precoAte);
    const dorm = inteiroOuNull(l.dormitorios);
    if (!l.descricao.trim()) erros.tipologias = `Descreva a tipologia nº ${n} (ex.: 2 dorm. c/ varanda).`;
    else if (typeof area !== "number" || area < LIMITES.areaMin || area > LIMITES.areaMax)
      erros.tipologias = `Tipologia nº ${n}: área privativa entre ${LIMITES.areaMin} e ${LIMITES.areaMax} m².`;
    else if (typeof de !== "number" || de < LIMITES.precoMin || de > LIMITES.precoMax)
      erros.tipologias = `Tipologia nº ${n}: informe o preço "a partir de" em reais (ex.: 289.000).`;
    else if (ate === "invalido" || (typeof ate === "number" && (ate < de || ate > LIMITES.precoMax)))
      erros.tipologias = `Tipologia nº ${n}: o preço "até" precisa ser maior ou igual ao "a partir de".`;
    else if (dorm === "invalido" || (typeof dorm === "number" && dorm > LIMITES.dormitoriosMax))
      erros.tipologias = `Tipologia nº ${n}: dormitórios entre 0 e ${LIMITES.dormitoriosMax}.`;
    else
      tipologias.push({
        descricao: l.descricao.trim().slice(0, LIMITES.descricao),
        dormitorios: dorm as number | null,
        areaPrivativa: area,
        precoDe: de,
        precoAte: ate as number | null,
      });
  });
  if (Object.keys(erros).length > 0) return { erros };

  const opcional = (s: string) => (s.trim() ? s.trim() : null);
  return {
    erros,
    input: {
      nome,
      construtora: opcional(e.construtora),
      endereco,
      fase: e.fase,
      dataLancamento: e.dataLancamento || null,
      totalUnidades: total as number | null,
      unidadesVendidas: vendidas as number | null,
      fonte: opcional(e.fonte),
      fonteUrl: opcional(url),
      observacoes: opcional(e.observacoes),
      tipologias,
    },
  };
}

interface Props {
  concorrente: Concorrente | null; // null = novo
  aviso?: string | null;
  onFechar: () => void;
  onSalvo: (c: Concorrente, aviso?: string) => void;
  onExcluido: (id: string) => void;
}

export function ConcorrenteForm({ concorrente, aviso, onFechar, onSalvo, onExcluido }: Props) {
  const [estado, setEstado] = useState<Estado>(() => estadoInicial(concorrente));
  const [linhas, setLinhas] = useState<LinhaTipologia[]>(() => linhasIniciais(concorrente));
  const [erros, setErros] = useState<Erros>({});
  const [salvando, setSalvando] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const [ponto, setPonto] = useState<{ lat: number; lng: number } | null>(null);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);

  // trocou de concorrente (ex.: depois de criar) -> recarrega o formulario
  useEffect(() => {
    setEstado(estadoInicial(concorrente));
    setLinhas(linhasIniciais(concorrente));
    setErros({});
    setAjustando(false);
    setPonto(null);
    setConfirmarExclusao(false);
  }, [concorrente]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !salvando && onFechar();
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onFechar, salvando]);

  const set = <K extends keyof Estado>(k: K, v: Estado[K]) => setEstado((s) => ({ ...s, [k]: v }));
  const setLinha = (chave: number, campo: keyof Omit<LinhaTipologia, "chave">, v: string) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [campo]: v } : l)));

  const pontoAtual = ponto ?? (concorrente ? { lat: concorrente.lat, lng: concorrente.lng } : null);
  const enderecoMudou = concorrente !== null && estado.endereco.trim().replace(/\s+/g, " ") !== concorrente.endereco;

  async function salvar(e?: React.FormEvent) {
    e?.preventDefault();
    if (salvando) return;
    const { input, erros: novos } = montarInput(estado, linhas);
    setErros(novos);
    if (!input) return;
    // pino ajustado a mao vale so se o endereco nao mudou (endereco novo = nova busca)
    if (ponto && !enderecoMudou) {
      input.latitude = ponto.lat;
      input.longitude = ponto.lng;
    }
    setSalvando(true);
    try {
      const salvo = concorrente ? await atualizarConcorrente(concorrente.id, input) : await criarConcorrente(input);
      onSalvo(salvo, concorrente ? "Alterações salvas." : "Concorrente cadastrado. Confira o pino no mapa abaixo.");
    } catch (err) {
      setErros({ geral: mensagemErroConcorrente(err) });
    } finally {
      setSalvando(false);
    }
  }

  async function excluir() {
    if (!concorrente || salvando) return;
    setSalvando(true);
    try {
      await excluirConcorrente(concorrente.id);
      onExcluido(concorrente.id);
    } catch (err) {
      setErros({ geral: mensagemErroConcorrente(err) });
      setSalvando(false);
    }
  }

  const precosM2 = useMemo(
    () =>
      linhas.map((l) => {
        const a = lerNumeroBr(l.area);
        const d = lerNumeroBr(l.precoDe);
        return typeof a === "number" && typeof d === "number" ? precoM2(d, a) : null;
      }),
    [linhas],
  );

  const titulo = concorrente ? "Editar concorrente" : "Cadastrar concorrente";

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="bii-conc-titulo">
      <button type="button" aria-label="Fechar" className="absolute inset-0 bg-slate-900/30" onClick={() => !salvando && onFechar()} />
      <form
        onSubmit={salvar}
        noValidate
        className="relative flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-xl"
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h2 id="bii-conc-titulo" className="text-base font-semibold text-slate-800">
              {titulo}
            </h2>
            <p className="text-xs text-slate-500">Empreendimento de outra construtora perto dos seus lançamentos.</p>
          </div>
          <button
            type="button"
            onClick={onFechar}
            disabled={salvando}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
          {aviso && (
            <p role="status" className="rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-800">
              {aviso}
            </p>
          )}
          <p className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <TriangleAlert className="mt-px h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden="true" />
            Não registre dados pessoais (nome ou telefone de corretor). Guarde só dados do empreendimento.
          </p>

          {/* Dados gerais */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">Empreendimento</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="conc-nome" className={LABEL}>
                  Nome do empreendimento
                </label>
                <input id="conc-nome" className={`mt-1 ${INPUT} ${erros.nome ? "border-red-400" : ""}`} value={estado.nome} maxLength={LIMITES.nome} onChange={(e) => set("nome", e.target.value)} aria-invalid={erros.nome ? true : undefined} />
                {erros.nome && <p className="mt-1 text-xs text-red-600">{erros.nome}</p>}
              </div>
              <div>
                <label htmlFor="conc-construtora" className={LABEL}>
                  Construtora (opcional)
                </label>
                <input id="conc-construtora" className={`mt-1 ${INPUT}`} value={estado.construtora} maxLength={LIMITES.construtora} onChange={(e) => set("construtora", e.target.value)} />
              </div>
              <div>
                <label htmlFor="conc-fase" className={LABEL}>
                  Fase
                </label>
                <select id="conc-fase" className={`mt-1 ${INPUT}`} value={estado.fase} onChange={(e) => set("fase", e.target.value as FaseConcorrente)}>
                  {FASES.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="conc-endereco" className={LABEL}>
                  Endereço
                </label>
                <input
                  id="conc-endereco"
                  className={`mt-1 ${INPUT} ${erros.endereco ? "border-red-400" : ""}`}
                  value={estado.endereco}
                  maxLength={LIMITES.endereco}
                  placeholder="Ex.: Av. Vila Ema, 3000, Vila Ema, São Paulo"
                  autoComplete="off"
                  onChange={(e) => set("endereco", e.target.value)}
                  aria-invalid={erros.endereco ? true : undefined}
                />
                <p className={`mt-1 text-xs ${erros.endereco ? "text-red-600" : "text-slate-500"}`}>
                  {erros.endereco ?? (enderecoMudou ? "Endereço alterado: ao salvar, a posição no mapa é buscada de novo." : "Rua, número, bairro, São Paulo")}
                </p>
              </div>
            </div>
          </section>

          {/* Mapa (so depois de salvo) */}
          {concorrente && pontoAtual && (
            <section className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                  <MapPin className="h-4 w-4 text-violet-600" aria-hidden="true" /> Posição no mapa
                </h3>
                <button
                  type="button"
                  disabled={enderecoMudou}
                  onClick={() => setAjustando((v) => !v)}
                  aria-pressed={ajustando}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ${
                    ajustando ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <Move className="h-3.5 w-3.5" aria-hidden="true" />
                  {ajustando ? "Clique no mapa para mover o pino" : "Ajustar posição no mapa"}
                </button>
              </div>
              <div className="relative isolate h-56 overflow-hidden rounded-xl border border-slate-200">
                <MapaPinoConcorrente lat={pontoAtual.lat} lng={pontoAtual.lng} ajustando={ajustando && !enderecoMudou} onMover={(lat, lng) => setPonto({ lat, lng })} />
              </div>
              <p className="text-xs text-slate-500">
                {ponto
                  ? "Posição ajustada. Clique em Salvar para gravar."
                  : concorrente.precisao === "manual"
                    ? "Posição ajustada à mão."
                    : concorrente.enderecoFormatado
                      ? `Localizado pelo OpenStreetMap: ${concorrente.enderecoFormatado}`
                      : "Localizado pelo OpenStreetMap."}
              </p>
            </section>
          )}

          {/* Tipologias */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-700">Tipologias</h3>
              <button
                type="button"
                disabled={linhas.length >= LIMITES.tipologias}
                onClick={() => setLinhas((ls) => [...ls, linhaVazia()])}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Adicionar tipologia
              </button>
            </div>
            <p className="text-xs text-slate-500">Preço anunciado e área privativa. O R$/m² é calculado sozinho.</p>
            <ul className="space-y-2">
              {linhas.map((l, i) => (
                <li key={l.chave} className="rounded-xl border border-slate-200 p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_5rem_6rem]">
                    <div className="col-span-2 sm:col-span-1">
                      <label className={LABEL} htmlFor={`tip-desc-${l.chave}`}>
                        Descrição
                      </label>
                      <input id={`tip-desc-${l.chave}`} className={`mt-1 ${INPUT}`} value={l.descricao} maxLength={LIMITES.descricao} placeholder="2 dorm. c/ varanda" onChange={(e) => setLinha(l.chave, "descricao", e.target.value)} />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor={`tip-dorm-${l.chave}`}>
                        Dorm.
                      </label>
                      <input id={`tip-dorm-${l.chave}`} className={`mt-1 ${INPUT}`} inputMode="numeric" value={l.dormitorios} placeholder="2" onChange={(e) => setLinha(l.chave, "dormitorios", e.target.value)} />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor={`tip-area-${l.chave}`}>
                        Área (m²)
                      </label>
                      <input id={`tip-area-${l.chave}`} className={`mt-1 ${INPUT}`} inputMode="decimal" value={l.area} placeholder="42,5" onChange={(e) => setLinha(l.chave, "area", e.target.value)} />
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                    <div>
                      <label className={LABEL} htmlFor={`tip-de-${l.chave}`}>
                        Preço a partir de (R$)
                      </label>
                      <input id={`tip-de-${l.chave}`} className={`mt-1 ${INPUT}`} inputMode="decimal" value={l.precoDe} placeholder="289.000" onChange={(e) => setLinha(l.chave, "precoDe", e.target.value)} />
                    </div>
                    <div>
                      <label className={LABEL} htmlFor={`tip-ate-${l.chave}`}>
                        Até (R$, opcional)
                      </label>
                      <input id={`tip-ate-${l.chave}`} className={`mt-1 ${INPUT}`} inputMode="decimal" value={l.precoAte} placeholder="320.000" onChange={(e) => setLinha(l.chave, "precoAte", e.target.value)} />
                    </div>
                    <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:justify-end">
                      <span className="text-xs text-slate-500" aria-live="polite">
                        {precosM2[i] !== null ? (
                          <>
                            <b className="font-semibold text-slate-700">{formatPrecoM2(precosM2[i])}</b>
                          </>
                        ) : (
                          "R$/m² —"
                        )}
                      </span>
                      <button
                        type="button"
                        disabled={linhas.length === 1}
                        onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        aria-label={`Remover tipologia ${i + 1}`}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {erros.tipologias && <p className="text-xs text-red-600">{erros.tipologias}</p>}
          </section>

          {/* Vendas */}
          <section className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-700">Vendas (opcional)</h3>
              <p className="text-xs text-slate-500">Com esses dados o BII calcula o % vendido e as vendas por mês desde o lançamento.</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="col-span-2 sm:col-span-1">
                <label htmlFor="conc-lanc" className={LABEL}>
                  Data de lançamento
                </label>
                <input id="conc-lanc" type="date" className={`mt-1 ${INPUT}`} value={estado.dataLancamento} min="1990-01-01" max="2100-12-31" onChange={(e) => set("dataLancamento", e.target.value)} />
              </div>
              <div>
                <label htmlFor="conc-total" className={LABEL}>
                  Total de unidades
                </label>
                <input id="conc-total" inputMode="numeric" className={`mt-1 ${INPUT} ${erros.totalUnidades ? "border-red-400" : ""}`} value={estado.totalUnidades} onChange={(e) => set("totalUnidades", e.target.value)} />
                {erros.totalUnidades && <p className="mt-1 text-xs text-red-600">{erros.totalUnidades}</p>}
              </div>
              <div>
                <label htmlFor="conc-vendidas" className={LABEL}>
                  Unidades vendidas
                </label>
                <input id="conc-vendidas" inputMode="numeric" className={`mt-1 ${INPUT} ${erros.unidadesVendidas ? "border-red-400" : ""}`} value={estado.unidadesVendidas} onChange={(e) => set("unidadesVendidas", e.target.value)} />
                {erros.unidadesVendidas && <p className="mt-1 text-xs text-red-600">{erros.unidadesVendidas}</p>}
              </div>
            </div>
          </section>

          {/* Fonte */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">De onde veio a informação</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="conc-fonte" className={LABEL}>
                  Fonte
                </label>
                <input id="conc-fonte" className={`mt-1 ${INPUT}`} value={estado.fonte} maxLength={LIMITES.fonte} placeholder="visita ao stand, site da construtora…" onChange={(e) => set("fonte", e.target.value)} />
              </div>
              <div>
                <label htmlFor="conc-url" className={LABEL}>
                  Link (opcional)
                </label>
                <input id="conc-url" type="url" className={`mt-1 ${INPUT} ${erros.fonteUrl ? "border-red-400" : ""}`} value={estado.fonteUrl} maxLength={LIMITES.fonteUrl} placeholder="https://" onChange={(e) => set("fonteUrl", e.target.value)} />
                {erros.fonteUrl && <p className="mt-1 text-xs text-red-600">{erros.fonteUrl}</p>}
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="conc-obs" className={LABEL}>
                  Observações
                </label>
                <textarea id="conc-obs" rows={3} className={`mt-1 ${INPUT}`} value={estado.observacoes} maxLength={LIMITES.observacoes} placeholder="Condições de pagamento, diferenciais, lazer…" onChange={(e) => set("observacoes", e.target.value)} />
                <p className="mt-1 text-right text-[11px] text-slate-400">
                  {estado.observacoes.length}/{LIMITES.observacoes}
                </p>
              </div>
            </div>
          </section>
        </div>

        <footer className="space-y-2 border-t border-slate-200 px-4 py-3 sm:px-6">
          {erros.geral && (
            <p role="alert" className="text-sm text-red-600">
              {erros.geral}
            </p>
          )}
          {confirmarExclusao ? (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2">
              <span className="text-sm text-red-700">Excluir este concorrente? Não dá para desfazer.</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmarExclusao(false)} disabled={salvando} className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600">
                  Cancelar
                </button>
                <button type="button" onClick={excluir} disabled={salvando} className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700">
                  Excluir
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-2">
              {concorrente ? (
                <button type="button" onClick={() => setConfirmarExclusao(true)} disabled={salvando} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" aria-hidden="true" /> Excluir
                </button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <button type="button" onClick={onFechar} disabled={salvando} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
                  {concorrente ? "Fechar" : "Cancelar"}
                </button>
                <button
                  type="submit"
                  disabled={salvando}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  {salvando ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          )}
          {!concorrente && <p className="text-xs text-slate-400">Ao salvar, o endereço é localizado no mapa pelo OpenStreetMap.</p>}
        </footer>
      </form>
    </div>
  );
}

// usado pela tabela (faixa de preco por tipologia)
export function formatPrecoTipologia(de: number, ate: number | null): string {
  return ate !== null && ate !== de ? `${formatMoeda(de)} – ${formatMoeda(ate)}` : formatMoeda(de);
}
