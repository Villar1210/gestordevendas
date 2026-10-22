// Assistente "Novo estudo" (BII Fatia 5) em 3 passos: (1) analise de mercado
// salva ou nova, (2) tipologias + premissas, (3) nome + conclusao -> salvar.
// O servidor monta o relatorio a partir da analise (nao geocodifica de novo).
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Building, Check, Loader2, Plus, Save, Search, Trash2, X } from "lucide-react";
import { apiRequest } from "@/core/api/client";
import { formatDataIso, formatNumero } from "../../constants";
import { formatPrecoM2, formatRaio } from "../../constants-endereco";
import { carregarAnalise, ehCotaDiaria, listarAnalises, mensagemErroAnalise } from "../../hooks/useBiiAnaliseIntegration";
import { criarEstudo, mensagemErroEstudo } from "../../hooks/useBiiEstudosIntegration";
import type { AnaliseEnderecoInput, AnaliseEnderecoResponse, AnaliseResumoItem } from "../../types-endereco";
import { lerNumeroBr } from "../concorrentes/ConcorrenteForm";
import { AnaliseEnderecoForm } from "../endereco/AnaliseEnderecoForm";

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50";
const LABEL = "text-xs font-medium text-slate-600";
const BOTAO_PRIMARIO =
  "inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60";
const BOTAO_SECUNDARIO =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50";
const MAX_TIPOLOGIAS = 20;
const PASSOS = ["Análise de mercado", "Tipologias", "Nome e conclusão"];

interface Linha {
  chave: number;
  descricao: string;
  area: string;
  preco: string;
}
let seq = 1;
const nova = (d = "", a = "", p = ""): Linha => ({ chave: seq++, descricao: d, area: a, preco: p });
const br = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

function nomePadrao(endereco: string): string {
  const rua = endereco.split(",").slice(0, 2).join(",").trim();
  return `Estudo — ${rua}`.slice(0, 120);
}

export function NovoEstudo({ analiseInicial, onCancelar }: { analiseInicial?: string | null; onCancelar: () => void }) {
  const router = useRouter();
  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);

  // passo 1
  const [analises, setAnalises] = useState<AnaliseResumoItem[] | null>(null);
  const [analiseId, setAnaliseId] = useState<string | null>(analiseInicial ?? null);
  const [analise, setAnalise] = useState<AnaliseEnderecoResponse | null>(null);
  const [fazendoNova, setFazendoNova] = useState(false);
  const [analisando, setAnalisando] = useState(false);
  const [cotaAcabou, setCotaAcabou] = useState(false);
  const [carregandoAnalise, setCarregandoAnalise] = useState(false);

  // passo 2
  const [linhas, setLinhas] = useState<Linha[]>(() => [nova("2 dorm.", "40", "")]);
  const [entrada, setEntrada] = useState("20");
  const [prazo, setPrazo] = useState("420");
  const [comprometimento, setComprometimento] = useState("30");
  const [jurosFixo, setJurosFixo] = useState(false);
  const [juros, setJuros] = useState("");
  const [escolhendo, setEscolhendo] = useState(false);

  // passo 3
  const [nome, setNome] = useState("");
  const [conclusao, setConclusao] = useState("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    listarAnalises()
      .then((l) => {
        setAnalises(l);
        if (l.length === 0) setFazendoNova(true);
      })
      .catch((err) => {
        setAnalises([]);
        setErro(mensagemErroAnalise(err));
      });
  }, []);

  const selecionada = useMemo(() => analises?.find((a) => a.id === analiseId) ?? null, [analises, analiseId]);

  async function analisarNova(input: AnaliseEnderecoInput) {
    if (analisando) return;
    setAnalisando(true);
    setErro(null);
    try {
      const r = await apiRequest<AnaliseEnderecoResponse>("/bii/analises/endereco", { method: "POST", body: JSON.stringify(input) });
      const item: AnaliseResumoItem = {
        id: r.id,
        endereco: r.endereco.digitado,
        enderecoFormatado: r.endereco.formatado,
        raioMetros: r.parametros.raioMetros,
        meses: r.parametros.meses,
        criadoEm: r.criadoEm,
        transacoes: r.resumo.transacoes,
        precoM2Mediano: r.resumo.precoM2Mediano,
      };
      setAnalises((l) => [item, ...(l ?? [])]);
      setAnaliseId(r.id);
      setAnalise(r);
      setFazendoNova(false);
    } catch (err) {
      setErro(mensagemErroAnalise(err));
      if (ehCotaDiaria(err)) setCotaAcabou(true);
    } finally {
      setAnalisando(false);
    }
  }

  const avancarDaAnalise = useCallback(async () => {
    if (!analiseId) return setErro("Escolha uma análise de mercado ou faça uma nova.");
    setErro(null);
    let a = analise && analise.id === analiseId ? analise : null;
    if (!a) {
      setCarregandoAnalise(true);
      try {
        a = await carregarAnalise(analiseId);
        setAnalise(a);
      } catch (err) {
        setCarregandoAnalise(false);
        return setErro(mensagemErroAnalise(err));
      }
      setCarregandoAnalise(false);
    }
    if (!nome.trim()) setNome(nomePadrao(a.endereco.formatado));
    setPasso(1);
  }, [analise, analiseId, nome]);

  const concorrentesNoRaio = analise?.concorrentes?.itens ?? [];

  function trazer(i: number) {
    const c = concorrentesNoRaio[i];
    setLinhas(c.tipologias.slice(0, MAX_TIPOLOGIAS).map((t) => nova(t.descricao, br(t.areaPrivativa), br(t.precoDe))));
    setEscolhendo(false);
  }

  const setLinha = (chave: number, campo: "descricao" | "area" | "preco", v: string) =>
    setLinhas((ls) => ls.map((l) => (l.chave === chave ? { ...l, [campo]: v } : l)));

  function lerTipologias() {
    const tipologias: { descricao: string; areaPrivativa: number; preco: number }[] = [];
    for (const [i, l] of linhas.entries()) {
      const area = lerNumeroBr(l.area);
      const preco = lerNumeroBr(l.preco);
      if (typeof area !== "number" || area < 10 || area > 1000) return `Tipologia nº ${i + 1}: informe a área privativa entre 10 e 1.000 m².`;
      if (typeof preco !== "number" || preco < 10_000 || preco > 100_000_000) return `Tipologia nº ${i + 1}: informe o preço em reais (ex.: 269.000).`;
      tipologias.push({ descricao: l.descricao.trim() || `Tipologia ${i + 1}`, areaPrivativa: area, preco });
    }
    const ent = lerNumeroBr(entrada);
    const com = lerNumeroBr(comprometimento);
    const jur = jurosFixo ? lerNumeroBr(juros) : null;
    if (typeof ent !== "number" || ent > 90) return "Entrada: use um percentual de 0 a 90.";
    if (typeof com !== "number" || com < 10 || com > 50) return "Comprometimento da renda: use de 10% a 50%.";
    if (jurosFixo && (typeof jur !== "number" || jur > 30)) return "Juros: informe a taxa ao ano, de 0 a 30%.";
    return {
      tipologias,
      premissas: { entradaPercentual: ent, prazoMeses: Number(prazo), comprometimentoPercentual: com, jurosAnual: jurosFixo ? (jur as number) : null },
    };
  }

  function avancarDasTipologias() {
    const r = lerTipologias();
    if (typeof r === "string") return setErro(r);
    setErro(null);
    setPasso(2);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando || !analiseId) return;
    const r = lerTipologias();
    if (typeof r === "string") {
      setPasso(1);
      return setErro(r);
    }
    const n = nome.trim().replace(/\s+/g, " ");
    if (n.length < 3 || n.length > 120) return setErro("Dê ao estudo um nome de 3 a 120 caracteres.");
    if (conclusao.length > 5000) return setErro("A conclusão pode ter no máximo 5.000 caracteres.");
    setErro(null);
    setSalvando(true);
    try {
      const estudo = await criarEstudo({ analiseId, nome: n, conclusao: conclusao.trim() || null, ...r });
      router.push(`/dashboard/bii/estudos/${estudo.id}`);
    } catch (err) {
      setErro(mensagemErroEstudo(err));
      setSalvando(false);
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Novo estudo">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-800">Novo estudo de terreno</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Junta a análise de mercado do endereço, os concorrentes no raio e a viabilidade das tipologias num relatório que
            você salva e imprime.
          </p>
        </div>
        <button type="button" onClick={onCancelar} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Fechar">
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <ol className="mt-4 flex flex-wrap gap-2" aria-label="Passos">
        {PASSOS.map((p, i) => (
          <li
            key={p}
            aria-current={i === passo ? "step" : undefined}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
              i === passo ? "border-blue-600 bg-blue-50 text-blue-700" : i < passo ? "border-green-200 bg-green-50 text-green-700" : "border-slate-200 text-slate-400"
            }`}
          >
            {i < passo ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <span>{i + 1}.</span>} {p}
          </li>
        ))}
      </ol>

      {/* Passo 1 */}
      {passo === 0 && (
        <div className="mt-4 space-y-3">
          {analises === null ? (
            <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-label="Carregando análises" />
          ) : (
            analises.length > 0 && (
              <fieldset>
                <legend className="text-sm font-medium text-slate-700">Escolha uma análise salva</legend>
                <ul className="mt-2 max-h-72 space-y-1.5 overflow-y-auto pr-1">
                  {analises.map((a) => (
                    <li key={a.id}>
                      <label
                        className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm ${
                          analiseId === a.id ? "border-blue-600 bg-blue-50" : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <input type="radio" name="analise" className="mt-1 accent-blue-700" checked={analiseId === a.id} onChange={() => setAnaliseId(a.id)} />
                        <span className="min-w-0">
                          <span className="block break-words font-medium text-slate-800">{a.enderecoFormatado}</span>
                          <span className="block text-xs text-slate-500">
                            {formatDataIso(a.criadoEm)} · raio {formatRaio(a.raioMetros)} · {a.meses} meses · {formatNumero(a.transacoes)} transações
                            {a.precoM2Mediano !== null ? ` · ${formatPrecoM2(a.precoM2Mediano)}` : ""}
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
            )
          )}

          {fazendoNova ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-sm font-medium text-slate-700">Nova análise de mercado</p>
              <AnaliseEnderecoForm
                onAnalisar={analisarNova}
                carregando={analisando}
                bloqueadoMotivo={cotaAcabou ? "Limite diário de análises da empresa atingido. Use uma análise salva." : null}
              />
            </div>
          ) : (
            <button type="button" onClick={() => setFazendoNova(true)} className={BOTAO_SECUNDARIO}>
              <Search className="h-4 w-4" aria-hidden="true" /> Fazer uma análise nova
            </button>
          )}

          {selecionada && (
            <p className="text-xs text-slate-500">
              Selecionada: <b className="text-slate-700">{selecionada.enderecoFormatado}</b>
            </p>
          )}
        </div>
      )}

      {/* Passo 2 */}
      {passo === 1 && (
        <div className="mt-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium text-slate-700">Tipologias pensadas para o terreno</p>
            <button type="button" onClick={() => setEscolhendo((v) => !v)} className={BOTAO_SECUNDARIO}>
              <Building className="h-4 w-4" aria-hidden="true" /> Trazer de um concorrente no raio
            </button>
          </div>
          {escolhendo && (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              {concorrentesNoRaio.length === 0 ? (
                <p className="text-sm text-slate-600">Nenhum concorrente no raio desta análise.</p>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs text-slate-500">Copiar as tipologias de:</span>
                  {concorrentesNoRaio.map((c, i) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => trazer(i)}
                      className="rounded-full border border-violet-200 bg-white px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50"
                    >
                      {c.nome}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <ul className="mt-3 space-y-2">
            {linhas.map((l, i) => (
              <li key={l.chave} className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_10rem_auto] sm:items-end">
                <div className="col-span-2 sm:col-span-1">
                  <label className={LABEL} htmlFor={`e-desc-${l.chave}`}>
                    Tipologia
                  </label>
                  <input id={`e-desc-${l.chave}`} className={`mt-1 ${INPUT}`} value={l.descricao} maxLength={100} placeholder="2 dorm. c/ varanda" onChange={(e) => setLinha(l.chave, "descricao", e.target.value)} />
                </div>
                <div>
                  <label className={LABEL} htmlFor={`e-area-${l.chave}`}>
                    Área privativa (m²)
                  </label>
                  <input id={`e-area-${l.chave}`} className={`mt-1 ${INPUT}`} inputMode="decimal" value={l.area} placeholder="40" onChange={(e) => setLinha(l.chave, "area", e.target.value)} />
                </div>
                <div>
                  <label className={LABEL} htmlFor={`e-preco-${l.chave}`}>
                    Preço (R$)
                  </label>
                  <input id={`e-preco-${l.chave}`} className={`mt-1 ${INPUT}`} inputMode="decimal" value={l.preco} placeholder="269.000" onChange={(e) => setLinha(l.chave, "preco", e.target.value)} />
                </div>
                <button
                  type="button"
                  disabled={linhas.length === 1}
                  onClick={() => setLinhas((ls) => ls.filter((x) => x.chave !== l.chave))}
                  className="col-span-2 justify-self-end rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40 sm:col-span-1"
                  aria-label={`Remover tipologia ${i + 1}`}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            disabled={linhas.length >= MAX_TIPOLOGIAS}
            onClick={() => setLinhas((ls) => [...ls, nova()])}
            className="mt-2 inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Adicionar tipologia
          </button>

          <fieldset className="mt-5">
            <legend className="text-sm font-semibold text-slate-700">Premissas do financiamento</legend>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className={LABEL} htmlFor="e-entrada">
                  Entrada (%)
                </label>
                <input id="e-entrada" className={`mt-1 ${INPUT}`} inputMode="decimal" value={entrada} onChange={(e) => setEntrada(e.target.value)} />
              </div>
              <div>
                <label className={LABEL} htmlFor="e-prazo">
                  Prazo
                </label>
                <select id="e-prazo" className={`mt-1 ${INPUT}`} value={prazo} onChange={(e) => setPrazo(e.target.value)}>
                  {[420, 360, 300, 240, 180, 120].map((m) => (
                    <option key={m} value={m}>
                      {m / 12} anos ({m} meses)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL} htmlFor="e-comp">
                  Comprometimento da renda (%)
                </label>
                <input id="e-comp" className={`mt-1 ${INPUT}`} inputMode="decimal" value={comprometimento} onChange={(e) => setComprometimento(e.target.value)} />
              </div>
              <div>
                <span className={LABEL}>Juros ao ano</span>
                <label className="mt-2 flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" className="h-4 w-4 accent-blue-700" checked={jurosFixo} onChange={(e) => setJurosFixo(e.target.checked)} />
                  Usar taxa fixa
                </label>
                {jurosFixo ? (
                  <input aria-label="Juros ao ano (%)" className={`mt-1 ${INPUT}`} inputMode="decimal" value={juros} placeholder="8,16" onChange={(e) => setJuros(e.target.value)} />
                ) : (
                  <p className="mt-1 text-xs text-slate-500">Referência da faixa do MCMV.</p>
                )}
              </div>
            </div>
          </fieldset>
        </div>
      )}

      {/* Passo 3 */}
      {passo === 2 && (
        <form id="form-estudo" onSubmit={salvar} noValidate className="mt-4 space-y-3">
          <div>
            <label className={LABEL} htmlFor="e-nome">
              Nome do estudo
            </label>
            <input id="e-nome" className={`mt-1 ${INPUT}`} value={nome} maxLength={120} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <label className={LABEL} htmlFor="e-conclusao">
              Conclusão (opcional)
            </label>
            <textarea
              id="e-conclusao"
              rows={6}
              maxLength={5000}
              className={`mt-1 ${INPUT}`}
              value={conclusao}
              placeholder="Ex.: produto de 2 dorm. em HIS-2 cabe na Faixa 3 e fica abaixo da concorrência; recomendo seguir para o estudo de massa."
              onChange={(e) => setConclusao(e.target.value)}
            />
            <p className="mt-1 text-right text-[11px] text-slate-400">{conclusao.length}/5.000</p>
          </div>
          <p className="text-xs text-slate-500">
            Ao salvar, o BII calcula a viabilidade e o posicionamento e guarda tudo como foto do dia. Depois você pode
            editar o nome e a conclusão.
          </p>
        </form>
      )}

      {erro && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {erro}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
        <button type="button" onClick={() => (passo === 0 ? onCancelar() : (setErro(null), setPasso(passo - 1)))} className={BOTAO_SECUNDARIO}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> {passo === 0 ? "Cancelar" : "Voltar"}
        </button>
        {passo === 0 && (
          <button type="button" onClick={avancarDaAnalise} disabled={!analiseId || carregandoAnalise || analisando} className={BOTAO_PRIMARIO}>
            {carregandoAnalise ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
            Continuar
          </button>
        )}
        {passo === 1 && (
          <button type="button" onClick={avancarDasTipologias} className={BOTAO_PRIMARIO}>
            <ArrowRight className="h-4 w-4" aria-hidden="true" /> Continuar
          </button>
        )}
        {passo === 2 && (
          <button type="submit" form="form-estudo" disabled={salvando} className={BOTAO_PRIMARIO}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
            {salvando ? "Salvando..." : "Salvar estudo"}
          </button>
        )}
      </div>
    </section>
  );
}
