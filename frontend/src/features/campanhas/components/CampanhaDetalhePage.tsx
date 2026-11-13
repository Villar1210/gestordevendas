// src/features/campanhas/components/CampanhaDetalhePage.tsx
// Detalhe de uma campanha: numeros, mensagem, importacao da planilha, SMS de
// teste, disparo (iniciar/pausar/cancelar), contatos e exportacao.
// Atualiza sozinho a cada 10 s enquanto a campanha esta enviando.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Download,
  FlaskConical,
  Loader2,
  Pause,
  Play,
  Send,
  Upload,
  XCircle,
} from "lucide-react";
import {
  atualizarCampanha,
  baixarCsv,
  cancelarCampanha,
  enviarTeste,
  importarContatos,
  iniciarCampanha,
  mensagemErro,
  obterCampanha,
  pausarCampanha,
} from "../api";
import { STATUS_CAMPANHA, formatarDataHora, pct } from "../constants";
import type { CampanhaDetalhe, DadosCampanha, FiltroExportacao, ResultadoImportacao } from "../types";
import { MensagemCampos } from "./MensagemCampos";
import { ContatosTabela } from "./ContatosTabela";

function dadosDe(c: CampanhaDetalhe): DadosCampanha {
  return {
    nome: c.nome,
    mensagem: c.mensagem,
    linkDestino: c.linkDestino,
    maxSegmentos: c.maxSegmentos,
    taxaPorMinuto: c.taxaPorMinuto,
    janelaInicio: c.janelaInicio,
    janelaFim: c.janelaFim,
  };
}

function Kpi({ titulo, valor, detalhe, destaque }: { titulo: string; valor: number | string; detalhe?: string; destaque?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${destaque ? "border-blue-200 bg-blue-50" : "border-slate-200 bg-white"}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{titulo}</div>
      <div className="mt-1 text-xl font-semibold text-slate-800">{valor}</div>
      {detalhe && <div className="text-[11px] text-slate-500">{detalhe}</div>}
    </div>
  );
}

const btn = "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium disabled:opacity-50";

export function CampanhaDetalhePage({ id }: { id: string }) {
  const [c, setC] = useState<CampanhaDetalhe | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [form, setForm] = useState<DadosCampanha | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [versaoContatos, setVersaoContatos] = useState(0);
  const [importacao, setImportacao] = useState<ResultadoImportacao | null>(null);
  const [substituir, setSubstituir] = useState(false);
  const [telTeste, setTelTeste] = useState("");
  const [confirmar, setConfirmar] = useState<"iniciar" | "cancelar" | null>(null);
  const arquivoRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(
    (resetForm = false) =>
      obterCampanha(id)
        .then((d) => {
          setC(d);
          setErro(null);
          if (resetForm) setForm(dadosDe(d));
        })
        .catch((e) => setErro(mensagemErro(e))),
    [id],
  );

  useEffect(() => {
    void carregar(true);
  }, [carregar]);

  // Atualiza os numeros a cada 10 s enquanto envia (sem mexer no formulario).
  useEffect(() => {
    if (c?.status !== "enviando") return;
    const t = setInterval(() => {
      void carregar(false);
      setVersaoContatos((v) => v + 1);
    }, 10_000);
    return () => clearInterval(t);
  }, [c?.status, carregar]);

  async function acao(nome: string, fn: () => Promise<unknown>, sucesso: string) {
    setOcupado(nome);
    setAviso(null);
    try {
      await fn();
      setAviso({ tipo: "ok", texto: sucesso });
      await carregar(nome === "salvar");
      setVersaoContatos((v) => v + 1);
    } catch (e) {
      setAviso({ tipo: "erro", texto: mensagemErro(e) });
    } finally {
      setOcupado(null);
      setConfirmar(null);
    }
  }

  async function importar(arquivo: File) {
    setOcupado("importar");
    setAviso(null);
    setImportacao(null);
    try {
      const r = await importarContatos(id, arquivo, substituir);
      setImportacao(r);
      await carregar(false);
      setVersaoContatos((v) => v + 1);
    } catch (e) {
      setAviso({ tipo: "erro", texto: mensagemErro(e) });
    } finally {
      setOcupado(null);
      if (arquivoRef.current) arquivoRef.current.value = "";
    }
  }

  async function exportar(filtro: FiltroExportacao) {
    setOcupado(`csv-${filtro}`);
    try {
      await baixarCsv(id, filtro);
    } catch (e) {
      setAviso({ tipo: "erro", texto: mensagemErro(e) });
    } finally {
      setOcupado(null);
    }
  }

  if (erro && !c) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        {erro}{" "}
        <Link href="/dashboard/campanhas" className="underline">
          Voltar
        </Link>
      </div>
    );
  }
  if (!c || !form) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" /> Carregando campanha...
      </div>
    );
  }

  const k = c.contagens;
  const enviados = k.enviado + k.entregue + k.optout;
  const processados = enviados + k.falhou;
  const naFila = k.pendente + k.enviando;
  const editavel = c.status === "rascunho" || c.status === "pausada";
  const alterado = JSON.stringify(form) !== JSON.stringify(dadosDe(c));
  const progresso = k.total ? Math.round((processados / (processados + naFila || 1)) * 100) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/dashboard/campanhas" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Campanhas
        </Link>
        <h2 className="min-w-0 break-words text-base font-semibold text-slate-800">{c.nome}</h2>
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CAMPANHA[c.status].classe}`}>{STATUS_CAMPANHA[c.status].label}</span>
      </div>

      {c.provedor.simulado && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <FlaskConical className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            <strong>Modo simulação:</strong> o servidor ainda não está ligado à Zenvia, então nenhum SMS de verdade sai — o resto (fila, links,
            cliques, relatórios) funciona normalmente para você testar.
          </span>
        </div>
      )}
      {!c.provedor.disponivel && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> A Zenvia foi escolhida mas falta o token/remetente no servidor. O envio está
          desligado.
        </div>
      )}
      {aviso && (
        <div className={`rounded-xl p-3 text-sm ${aviso.tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{aviso.texto}</div>
      )}

      {/* Numeros */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
          <Kpi titulo="Contatos" valor={k.total} detalhe={`${k.bloqueado} bloqueados`} />
          <Kpi titulo="Na fila" valor={naFila} />
          <Kpi titulo="Enviados" valor={enviados} />
          <Kpi titulo="Entregues" valor={k.entregue} detalhe={pct(k.entregue, enviados)} />
          <Kpi titulo="Clicaram" valor={k.comClique} detalhe={`${pct(k.comClique, enviados)} · ${k.cliquesTotais} cliques`} destaque />
          <Kpi titulo="Responderam" valor={k.comResposta} detalhe={`${k.optout} pediram para sair`} destaque />
          <Kpi titulo="Falhas" valor={k.falhou} />
        </div>
        {(c.status === "enviando" || c.status === "pausada") && (
          <div className="mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progresso}%` }} />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {progresso}% processado · ritmo de {c.taxaPorMinuto} SMS/min · envia de seg. a sáb., das {c.janelaInicio}h às {c.janelaFim}h
            </p>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {(c.status === "rascunho" || c.status === "pausada") &&
            (confirmar === "iniciar" ? (
              <span className="flex flex-wrap items-center gap-2 rounded-lg bg-blue-50 px-3 py-1.5 text-sm text-blue-900">
                Disparar para {k.pendente} contatos{c.provedor.simulado ? " (simulação)" : ""}?
                <button
                  type="button"
                  disabled={!!ocupado}
                  onClick={() => acao("iniciar", () => iniciarCampanha(id), "Disparo iniciado. Os números atualizam sozinhos.")}
                  className={`${btn} bg-blue-700 text-white hover:bg-blue-800`}
                >
                  {ocupado === "iniciar" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Play className="h-4 w-4" aria-hidden="true" />}
                  Sim, disparar
                </button>
                <button type="button" onClick={() => setConfirmar(null)} className="text-sm underline">
                  Não
                </button>
              </span>
            ) : (
              <button
                type="button"
                disabled={!!ocupado || k.pendente === 0 || alterado}
                title={alterado ? "Salve a mensagem antes de disparar" : k.pendente === 0 ? "Importe os contatos primeiro" : undefined}
                onClick={() => setConfirmar("iniciar")}
                className={`${btn} bg-blue-700 text-white hover:bg-blue-800`}
              >
                <Play className="h-4 w-4" aria-hidden="true" /> {c.status === "pausada" ? "Retomar envio" : "Disparar campanha"}
              </button>
            ))}
          {c.status === "enviando" && (
            <button
              type="button"
              disabled={!!ocupado}
              onClick={() => acao("pausar", () => pausarCampanha(id), "Campanha pausada.")}
              className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-50`}
            >
              <Pause className="h-4 w-4" aria-hidden="true" /> Pausar
            </button>
          )}
          {(c.status === "rascunho" || c.status === "enviando" || c.status === "pausada") &&
            (confirmar === "cancelar" ? (
              <span className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-800">
                Cancelar de vez? Quem ainda não recebeu não recebe mais.
                <button
                  type="button"
                  onClick={() => acao("cancelar", () => cancelarCampanha(id), "Campanha cancelada.")}
                  className={`${btn} bg-red-600 text-white hover:bg-red-700`}
                >
                  Sim, cancelar
                </button>
                <button type="button" onClick={() => setConfirmar(null)} className="text-sm underline">
                  Não
                </button>
              </span>
            ) : (
              <button type="button" disabled={!!ocupado} onClick={() => setConfirmar("cancelar")} className={`${btn} text-red-600 hover:bg-red-50`}>
                <XCircle className="h-4 w-4" aria-hidden="true" /> Cancelar campanha
              </button>
            ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Criada em {formatarDataHora(c.createdAt)}
          {c.iniciadaEm ? ` · disparada em ${formatarDataHora(c.iniciadaEm)}` : ""}
          {c.concluidaEm ? ` · encerrada em ${formatarDataHora(c.concluidaEm)}` : ""}
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Mensagem */}
        <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-sm font-semibold text-slate-800">Mensagem</h3>
          {!editavel && <p className="mt-0.5 text-xs text-slate-500">Para mudar a mensagem, pause a campanha.</p>}
          <div className="mt-3">
            <MensagemCampos
              valor={form}
              onChange={setForm}
              linkBase={c.linkBase}
              maiorPrimeiroNome={c.mensagemAnalise?.maiorPrimeiroNome || undefined}
              desabilitado={!editavel}
            />
          </div>
          {editavel && (
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                disabled={!alterado || !!ocupado}
                onClick={() => acao("salvar", () => atualizarCampanha(id, form), "Mensagem salva.")}
                className={`${btn} bg-blue-700 text-white hover:bg-blue-800`}
              >
                {ocupado === "salvar" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Salvar
              </button>
              {alterado && (
                <button type="button" onClick={() => setForm(dadosDe(c))} className={`${btn} text-slate-600 hover:bg-slate-100`}>
                  Desfazer
                </button>
              )}
            </div>
          )}
        </section>

        <div className="space-y-4">
          {/* Importar */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-slate-800">Contatos</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Planilha .xlsx (usa a aba “SMS”, se existir) ou .csv, com cabeçalho na 1ª linha: <strong>telefone</strong> (obrigatório), nome,
              primeiro_nome, corretor. Fixos, inválidos e repetidos ficam de fora; quem já pediu para sair entra como bloqueado.
            </p>
            {editavel ? (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  ref={arquivoRef}
                  type="file"
                  accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void importar(f);
                  }}
                />
                <button
                  type="button"
                  disabled={!!ocupado}
                  onClick={() => arquivoRef.current?.click()}
                  className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-50`}
                >
                  {ocupado === "importar" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Upload className="h-4 w-4" aria-hidden="true" />}
                  Importar planilha
                </button>
                {c.status === "rascunho" && k.total > 0 && (
                  <label className="flex items-center gap-1.5 text-xs text-slate-600">
                    <input type="checkbox" checked={substituir} onChange={(e) => setSubstituir(e.target.checked)} />
                    Substituir a lista atual
                  </label>
                )}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Para importar mais contatos, pause a campanha.</p>
            )}
            {importacao && (
              <p className="mt-3 rounded-lg bg-slate-50 p-2 text-xs text-slate-700">
                {importacao.linhasLidas} linhas lidas · <strong>{importacao.importados} importados</strong> · {importacao.bloqueados} bloqueados (já
                pediram para sair) · {importacao.invalidos} inválidos/fixos · {importacao.duplicados} repetidos
                {importacao.ignoradosPorLimite ? ` · ${importacao.ignoradosPorLimite} acima do limite de 5.000` : ""} — total na campanha:{" "}
                {importacao.totalNaCampanha}
              </p>
            )}
          </section>

          {/* Teste */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-slate-800">SMS de teste</h3>
            <p className="mt-0.5 text-xs text-slate-500">
              Manda a mensagem para o seu celular antes de disparar. O link do teste abre a página sem contar clique.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                value={telTeste}
                onChange={(e) => setTelTeste(e.target.value)}
                placeholder="(11) 99999-9999"
                inputMode="tel"
                aria-label="Celular para o teste"
                className="w-48 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                type="button"
                disabled={!telTeste.trim() || !!ocupado || alterado}
                title={alterado ? "Salve a mensagem antes" : undefined}
                onClick={() =>
                  acao(
                    "teste",
                    () => enviarTeste(id, telTeste),
                    c.provedor.simulado ? "Teste registrado (simulação: nenhum SMS saiu)." : "SMS de teste enviado.",
                  )
                }
                className={`${btn} border border-slate-300 text-slate-700 hover:bg-slate-50`}
              >
                {ocupado === "teste" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
                Enviar teste
              </button>
            </div>
            <p className="mt-2 break-all text-[11px] text-slate-400">Link de teste: {c.linkTeste}</p>
          </section>
        </div>
      </div>

      {/* Lista */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">Quem recebeu, clicou e respondeu</h3>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ["clicou", "Quem clicou"],
                ["respondeu", "Quem respondeu"],
                ["todos", "Todos"],
              ] as [FiltroExportacao, string][]
            ).map(([f, label]) => (
              <button
                key={f}
                type="button"
                disabled={!!ocupado}
                onClick={() => exportar(f)}
                className={`${btn} border border-slate-300 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50`}
              >
                {ocupado === `csv-${f}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
                {label} (.csv)
              </button>
            ))}
          </div>
        </div>
        <ContatosTabela campanhaId={id} versao={versaoContatos} />
      </section>
    </div>
  );
}
