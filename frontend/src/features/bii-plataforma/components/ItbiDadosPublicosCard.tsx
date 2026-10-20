// Card "Dados publicos do BII — ITBI" da tela do Super Usuario: importa a
// planilha anual do ITBI da Prefeitura de SP, mostra o historico das
// importacoes e dispara a geocodificacao por prefixo de CEP/bairro.
// Polling de 5 s so enquanto houver algo em andamento.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, Database, FileSpreadsheet, Loader2, MapPinned, RefreshCw, Upload } from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";
import type {
  GeocodificarInput,
  GeocodificarResponse,
  ImportarItbiResponse,
  ItbiImportacao,
  ProgressoGeocodificacao,
} from "../types";

const POLLING_MS = 5000;
const TAMANHO_MAXIMO = 120 * 1024 * 1024;
const MAX_GEOCODIFICAR = 5000;
const MAX_GEOCODIFICAR_PADRAO = 2000;

const numero = new Intl.NumberFormat("pt-BR");
const dataHora = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

const INPUT =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50";
const BOTAO =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60";

function fmtNum(v: number | null | undefined): string {
  return typeof v === "number" ? numero.format(v) : "—";
}

function fmtData(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : dataHora.format(d);
}

function fmtTamanho(bytes: number): string {
  return `${numero.format(Math.round((bytes / (1024 * 1024)) * 10) / 10)} MB`;
}

function mensagemErro(err: unknown, contexto: "importar" | "geocodificar" | "carregar"): string {
  if (!(err instanceof ApiError)) return "Não foi possível falar com o servidor. Verifique sua conexão.";
  if (err.status === 409)
    return contexto === "importar"
      ? "Já existe uma importação em andamento. Aguarde ela terminar."
      : "Já existe uma geocodificação em andamento. Aguarde ela terminar.";
  if (err.status === 429)
    return contexto === "importar"
      ? "Limite de importações atingido (2 por hora). Tente mais tarde."
      : "Muitas solicitações em pouco tempo. Aguarde e tente de novo.";
  if (err.status === 413) return "Arquivo grande demais: o máximo é 120 MB.";
  if (err.status === 400 || err.status === 422) return err.message;
  if (err.status === 503) return "Servidor ocupado. Tente em instantes.";
  return "Não foi possível concluir agora. Tente de novo.";
}

const STATUS_IMPORTACAO: Record<string, { label: string; classe: string }> = {
  processando: { label: "Processando", classe: "bg-amber-50 text-amber-700 border-amber-200" },
  concluida: { label: "Concluída", classe: "bg-green-50 text-green-700 border-green-200" },
  erro: { label: "Erro", classe: "bg-red-50 text-red-700 border-red-200" },
};

const STATUS_GEO: Record<string, { label: string; classe: string }> = {
  processando: { label: "Em andamento", classe: "bg-amber-50 text-amber-700 border-amber-200" },
  concluida: { label: "Concluída", classe: "bg-green-50 text-green-700 border-green-200" },
  erro: { label: "Erro", classe: "bg-red-50 text-red-700 border-red-200" },
  cancelada: { label: "Cancelada", classe: "bg-slate-50 text-slate-600 border-slate-200" },
};

function Pill({ mapa, status }: { mapa: Record<string, { label: string; classe: string }>; status: string }) {
  const s = mapa[status] ?? { label: status, classe: "bg-slate-50 text-slate-600 border-slate-200" };
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${s.classe}`}>
      {status === "processando" && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
      {s.label}
    </span>
  );
}

function geoEmAndamento(p: ProgressoGeocodificacao | null): boolean {
  return !!p && p.status === "processando";
}

// Lista separada por virgula/ponto e virgula/quebra de linha, sem repetidos.
function lerLista(texto: string): string[] {
  return Array.from(
    new Set(
      texto
        .split(/[,;\n]/)
        .map((p) => p.trim().replace(/\s+/g, " "))
        .filter(Boolean),
    ),
  );
}

// ---------------------------------------------------------------------------

export function ItbiDadosPublicosCard() {
  const anoAtual = new Date().getFullYear();

  // Importacoes
  const [importacoes, setImportacoes] = useState<ItbiImportacao[] | null>(null);
  const [importacoesErro, setImportacoesErro] = useState<string | null>(null);
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [ano, setAno] = useState(String(anoAtual));
  const [importErro, setImportErro] = useState<string | null>(null);
  const [importOk, setImportOk] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const inputArquivo = useRef<HTMLInputElement>(null);

  // Geocodificacao
  const [progresso, setProgresso] = useState<ProgressoGeocodificacao | null>(null);
  const [progressoCarregado, setProgressoCarregado] = useState(false);
  const [ceps, setCeps] = useState("");
  const [bairros, setBairros] = useState("");
  const [max, setMax] = useState(String(MAX_GEOCODIFICAR_PADRAO));
  const [geoErro, setGeoErro] = useState<string | null>(null);
  const [geoOk, setGeoOk] = useState<string | null>(null);
  const [geoEnviando, setGeoEnviando] = useState(false);

  const carregarImportacoes = useCallback(async () => {
    try {
      const lista = await apiRequest<ItbiImportacao[]>("/bii-plataforma/itbi/importacoes");
      setImportacoes(Array.isArray(lista) ? lista : []);
      setImportacoesErro(null);
    } catch (err) {
      setImportacoesErro(mensagemErro(err, "carregar"));
    }
  }, []);

  const carregarProgresso = useCallback(async () => {
    try {
      const r = await apiRequest<{ atual: ProgressoGeocodificacao | null }>("/bii-plataforma/itbi/geocodificacao");
      const p = r?.atual;
      setProgresso(p && typeof p === "object" && "status" in p ? p : null);
    } catch {
      // Sem progresso disponivel: a tela so nao mostra a barra.
    } finally {
      setProgressoCarregado(true);
    }
  }, []);

  useEffect(() => {
    carregarImportacoes();
    carregarProgresso();
  }, [carregarImportacoes, carregarProgresso]);

  const importando = importacoes?.some((i) => i.status === "processando") ?? false;
  const geocodificando = geoEmAndamento(progresso);

  useEffect(() => {
    if (!importando) return;
    const t = window.setInterval(carregarImportacoes, POLLING_MS);
    return () => window.clearInterval(t);
  }, [importando, carregarImportacoes]);

  useEffect(() => {
    if (!geocodificando) return;
    const t = window.setInterval(carregarProgresso, POLLING_MS);
    return () => window.clearInterval(t);
  }, [geocodificando, carregarProgresso]);

  function escolherArquivo(f: File | null) {
    setImportErro(null);
    setImportOk(null);
    if (!f) return setArquivo(null);
    if (!f.name.toLowerCase().endsWith(".xlsx")) {
      setArquivo(null);
      if (inputArquivo.current) inputArquivo.current.value = "";
      return setImportErro("Envie a planilha no formato .xlsx (Excel).");
    }
    if (f.size > TAMANHO_MAXIMO) {
      setArquivo(null);
      if (inputArquivo.current) inputArquivo.current.value = "";
      return setImportErro(`Arquivo de ${fmtTamanho(f.size)}: o máximo é 120 MB.`);
    }
    setArquivo(f);
  }

  async function importar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setImportErro(null);
    setImportOk(null);
    const anoNum = Number(ano);
    if (!arquivo) return setImportErro("Escolha a planilha .xlsx do ITBI.");
    if (!Number.isInteger(anoNum) || anoNum < 2000 || anoNum > anoAtual + 1)
      return setImportErro(`Informe o ano da planilha (2000 a ${anoAtual + 1}).`);
    const form = new FormData();
    form.append("file", arquivo, arquivo.name);
    form.append("ano", String(anoNum));
    setEnviando(true);
    try {
      await apiRequest<ImportarItbiResponse>("/bii-plataforma/itbi/importar", { method: "POST", body: form });
      setImportOk("Planilha recebida. A importação roda em segundo plano — acompanhe abaixo.");
      setArquivo(null);
      if (inputArquivo.current) inputArquivo.current.value = "";
      await carregarImportacoes();
    } catch (err) {
      setImportErro(mensagemErro(err, "importar"));
    } finally {
      setEnviando(false);
    }
  }

  async function geocodificar(e: React.FormEvent) {
    e.preventDefault();
    if (geoEnviando) return;
    setGeoErro(null);
    setGeoOk(null);
    const listaCeps = lerLista(ceps).map((c) => c.replace("-", ""));
    const listaBairros = lerLista(bairros);
    const cepInvalido = listaCeps.find((c) => !/^\d{5}$/.test(c));
    if (cepInvalido) return setGeoErro(`"${cepInvalido}" não é um prefixo de CEP válido: use os 5 primeiros dígitos (ex.: 03277).`);
    if (listaCeps.length === 0 && listaBairros.length === 0)
      return setGeoErro("Informe pelo menos um prefixo de CEP ou um bairro.");
    if (listaBairros.some((b) => b.length > 80)) return setGeoErro("Nome de bairro muito longo (máximo 80 caracteres).");
    const maxNum = Number(max);
    if (!Number.isInteger(maxNum) || maxNum < 1 || maxNum > MAX_GEOCODIFICAR)
      return setGeoErro(`O máximo precisa ser um número de 1 a ${numero.format(MAX_GEOCODIFICAR)}.`);
    const body: GeocodificarInput = { max: maxNum };
    if (listaCeps.length) body.ceps = listaCeps;
    if (listaBairros.length) body.bairros = listaBairros;
    setGeoEnviando(true);
    try {
      const r = await apiRequest<GeocodificarResponse>("/bii-plataforma/itbi/geocodificar", {
        method: "POST",
        body: JSON.stringify(body),
      });
      const qtd = typeof r?.enfileirados === "number" ? r.enfileirados : null;
      setGeoOk(
        qtd === null
          ? "Geocodificação iniciada em segundo plano."
          : qtd === 0
            ? "Nenhum endereço novo para geocodificar nesse filtro (já estão no mapa ou não há transações)."
            : `${numero.format(qtd)} endereços na fila. O OpenStreetMap aceita 1 consulta por segundo — cerca de ${numero.format(Math.ceil(qtd / 60))} min.`,
      );
      if (r && typeof r === "object" && "status" in r) setProgresso(r);
      else await carregarProgresso();
    } catch (err) {
      setGeoErro(mensagemErro(err, "geocodificar"));
    } finally {
      setGeoEnviando(false);
    }
  }

  const pct =
    progresso && progresso.enfileirados > 0 ? Math.min(100, Math.round((progresso.processados / progresso.enfileirados) * 100)) : 0;

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-blue-50 p-2 text-blue-700">
          <Database className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-slate-800">Dados públicos do BII — ITBI</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Guias de ITBI pagas da Prefeitura de São Paulo (base aberta, planilha anual). Dado público, compartilhado por
            todos os tenants na Análise por Endereço.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Importar planilha */}
        <form onSubmit={importar} noValidate className="min-w-0 rounded-xl border border-slate-200 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <FileSpreadsheet className="h-4 w-4 text-slate-400" aria-hidden="true" />
            Importar planilha
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Arquivo .xlsx de até 120 MB. Linhas repetidas são ignoradas; reimportar o mesmo ano é seguro.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
            <div className="min-w-0">
              <label htmlFor="itbi-arquivo" className="text-xs font-medium text-slate-600">
                Planilha
              </label>
              <input
                id="itbi-arquivo"
                ref={inputArquivo}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={enviando}
                onChange={(e) => escolherArquivo(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full min-w-0 text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
              {arquivo && (
                <p className="mt-1 truncate text-xs text-slate-500" title={arquivo.name}>
                  {arquivo.name} · {fmtTamanho(arquivo.size)}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="itbi-ano" className="text-xs font-medium text-slate-600">
                Ano
              </label>
              <input
                id="itbi-ano"
                type="number"
                inputMode="numeric"
                min={2000}
                max={anoAtual + 1}
                value={ano}
                disabled={enviando}
                onChange={(e) => setAno(e.target.value)}
                className={`mt-1 ${INPUT}`}
              />
            </div>
          </div>
          {importErro && (
            <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {importErro}
            </p>
          )}
          {importOk && <p role="status" className="mt-3 text-sm text-green-700">{importOk}</p>}
          <button type="submit" disabled={enviando || importando} className={`mt-4 w-full sm:w-auto ${BOTAO}`}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
            {enviando ? "Enviando..." : "Importar"}
          </button>
          {importando && !enviando && (
            <p className="mt-2 text-xs text-slate-500">Há uma importação em andamento; espere terminar para enviar outra.</p>
          )}
        </form>

        {/* Geocodificar */}
        <form onSubmit={geocodificar} noValidate className="min-w-0 rounded-xl border border-slate-200 p-4">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <MapPinned className="h-4 w-4 text-slate-400" aria-hidden="true" />
            Geocodificar região
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">
            Coloca no mapa os endereços do ITBI ainda sem localização. Comece pelas regiões em análise.
          </p>
          <div className="mt-3 grid gap-3">
            <div>
              <label htmlFor="geo-ceps" className="text-xs font-medium text-slate-600">
                Prefixos de CEP (5 dígitos)
              </label>
              <input
                id="geo-ceps"
                type="text"
                inputMode="numeric"
                value={ceps}
                disabled={geoEnviando}
                onChange={(e) => setCeps(e.target.value)}
                placeholder="03277, 03278, 03156"
                className={`mt-1 ${INPUT}`}
              />
            </div>
            <div>
              <label htmlFor="geo-bairros" className="text-xs font-medium text-slate-600">
                Bairros (opcional)
              </label>
              <input
                id="geo-bairros"
                type="text"
                value={bairros}
                disabled={geoEnviando}
                onChange={(e) => setBairros(e.target.value)}
                placeholder="Vila Ema, Vila Prudente"
                className={`mt-1 ${INPUT}`}
              />
              <p className="mt-1 text-xs text-slate-500">Separe por vírgula.</p>
            </div>
            <div className="max-w-[10rem]">
              <label htmlFor="geo-max" className="text-xs font-medium text-slate-600">
                Máximo de endereços
              </label>
              <input
                id="geo-max"
                type="number"
                inputMode="numeric"
                min={1}
                max={MAX_GEOCODIFICAR}
                value={max}
                disabled={geoEnviando}
                onChange={(e) => setMax(e.target.value)}
                className={`mt-1 ${INPUT}`}
              />
            </div>
          </div>
          {geoErro && (
            <p role="alert" className="mt-3 flex items-start gap-1.5 text-sm text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {geoErro}
            </p>
          )}
          {geoOk && <p role="status" className="mt-3 text-sm text-green-700">{geoOk}</p>}
          <button type="submit" disabled={geoEnviando || geocodificando} className={`mt-4 w-full sm:w-auto ${BOTAO}`}>
            {geoEnviando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <MapPinned className="h-4 w-4" aria-hidden="true" />}
            {geoEnviando ? "Enviando..." : "Geocodificar"}
          </button>

          {progressoCarregado && progresso && (
            <div className="mt-4 rounded-lg bg-slate-50 p-3" aria-live="polite">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-medium text-slate-600">
                  {geocodificando ? "Geocodificação atual" : "Última geocodificação"}
                </p>
                <Pill mapa={STATUS_GEO} status={progresso.status} />
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct}
                aria-label="Progresso da geocodificação"
              >
                <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-600">
                {fmtNum(progresso.processados)} de {fmtNum(progresso.enfileirados)} ({pct}%) · {fmtNum(progresso.encontrados)}{" "}
                localizados · {fmtNum(progresso.naoEncontrados)} não encontrados
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                Início {fmtData(progresso.iniciadoEm)}
                {progresso.concluidoEm ? ` · fim ${fmtData(progresso.concluidoEm)}` : ""}
              </p>
              {progresso.mensagemErro && <p className="mt-1 text-xs text-red-700">{progresso.mensagemErro}</p>}
            </div>
          )}
        </form>
      </div>

      {/* Historico de importacoes */}
      <div className="mt-6">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">Histórico de importações</h3>
          <button
            type="button"
            onClick={carregarImportacoes}
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Atualizar
          </button>
        </div>
        {importacoesErro ? (
          <p className="mt-3 text-sm text-red-700">{importacoesErro}</p>
        ) : importacoes === null ? (
          <div className="flex items-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" aria-hidden="true" />
            Carregando...
          </div>
        ) : importacoes.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-400">
            Nenhuma planilha importada ainda.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Arquivo</th>
                  <th scope="col" className="px-3 py-2 font-medium">Ano</th>
                  <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Lidas</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Inseridas</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Duplicadas</th>
                  <th scope="col" className="px-3 py-2 text-right font-medium">Descartadas</th>
                  <th scope="col" className="px-3 py-2 font-medium">Início</th>
                  <th scope="col" className="px-3 py-2 font-medium">Fim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {importacoes.map((i) => (
                  <tr key={i.id} className="align-top">
                    <td className="max-w-[220px] px-3 py-2">
                      <p className="truncate font-medium text-slate-800" title={i.nomeArquivo}>
                        {i.nomeArquivo || "—"}
                      </p>
                      {i.status === "erro" && i.mensagemErro && (
                        <p className="mt-0.5 text-xs text-red-700">{i.mensagemErro}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{i.ano}</td>
                    <td className="px-3 py-2">
                      <Pill mapa={STATUS_IMPORTACAO} status={i.status} />
                    </td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtNum(i.linhasLidas)}</td>
                    <td className="px-3 py-2 text-right font-medium text-slate-800">{fmtNum(i.linhasInseridas)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtNum(i.linhasDuplicadas)}</td>
                    <td className="px-3 py-2 text-right text-slate-600">{fmtNum(i.linhasDescartadas)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtData(i.iniciadoEm)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-slate-500">{fmtData(i.concluidoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {importando && <p className="mt-2 text-xs text-slate-400">Atualizando a cada 5 segundos enquanto processa.</p>}
      </div>
    </section>
  );
}
