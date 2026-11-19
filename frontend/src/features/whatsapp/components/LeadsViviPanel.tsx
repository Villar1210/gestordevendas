// src/features/whatsapp/components/LeadsViviPanel.tsx
// WhatsApp do corretor - Etapa 3 do WhatsApp integrado (19/11/2026).
// Tela de chat no estilo do WhatsApp (desenho aprovado pelo Villar):
// - lista de conversas (ultima mensagem, nao lidas, lead aguardando aceite);
// - conversa grande, com autor em cada balao (Cliente / VIVI / corretor) e os
//   avisos do sistema (aceite, passagem da VIVI) no meio;
// - caixa de envio pelo numero OFICIAL, que muda conforme a situacao
//   (pode responder / aguardando aceite / fora das 24 h / somente leitura);
// - painel recolhivel com os dados do lead.
// Atualiza sozinha: a conversa aberta consulta o Gestor a cada 4 s (so as
// mensagens novas) e a lista a cada 15 s. Sem WhatsApp pessoal (decisao do
// Villar: tudo pelo numero oficial, gravado no card).
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Check,
  ChevronRight,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Lock,
  MessageCircle,
  PanelRight,
  Plus,
  Search,
  Send,
} from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";
import {
  contagem,
  dataHoraVisita,
  horaCurta,
  iniciais,
  mensagemApresentacao,
  nomeDoCliente,
  telefoneFormatado,
  tempoRestante,
  type ChatResposta,
  type EventoChat,
  type LeadVivi,
  type MensagemChat,
} from "../types";
import { TextoWhatsApp } from "./TextoWhatsApp";

const LISTA_MS = 15_000;
const CONVERSA_MS = 4_000;

type Filtro = "todas" | "nao_lidas" | "aceitar";

interface Props {
  me: { id: string; name: string } | null;
}

const nomeExibido = (l: LeadVivi) => nomeDoCliente(l.titulo) ?? (telefoneFormatado(l.telefone) || l.titulo);

export function LeadsViviPanel({ me }: Props) {
  const [leads, setLeads] = useState<LeadVivi[]>([]);
  const [veTodos, setVeTodos] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [corretorId, setCorretorId] = useState("");
  const [corretores, setCorretores] = useState<Array<{ id: string; name: string }>>([]);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  // Celular: mostra a lista OU a conversa.
  const [conversaAbertaNoCelular, setConversaAbertaNoCelular] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const resp = await apiRequest<{ leads: LeadVivi[]; veTodos: boolean }>(
        `/leads-vivi${corretorId ? `?corretorId=${corretorId}` : ""}`,
      );
      setLeads(resp.leads);
      setVeTodos(resp.veTodos);
      setErro(null);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível carregar as conversas.");
    } finally {
      setCarregando(false);
    }
  }, [corretorId]);

  useEffect(() => {
    carregar();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") carregar();
    }, LISTA_MS);
    return () => clearInterval(id);
  }, [carregar]);

  useEffect(() => {
    if (veTodos && corretores.length === 0) {
      apiRequest<Array<{ id: string; name: string }>>("/rh/corretores").then(setCorretores).catch(() => {});
    }
  }, [veTodos, corretores.length]);

  const ordenados = useMemo(() => {
    const tempo = (l: LeadVivi) => new Date(l.ultimaMensagem?.em ?? l.atribuidoEm ?? l.createdAt).getTime();
    // Aguardando aceite sempre no topo (tem prazo); depois a mais recente.
    return [...leads].sort((a, b) => Number(b.aguardandoAceite) - Number(a.aguardandoAceite) || tempo(b) - tempo(a));
  }, [leads]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const digitos = q.replace(/\D/g, "");
    return ordenados.filter(
      (l) =>
        (filtro === "todas" || (filtro === "nao_lidas" ? l.naoLidas > 0 : l.aguardandoAceite)) &&
        (!q ||
          l.titulo.toLowerCase().includes(q) ||
          (l.empreendimento ?? "").toLowerCase().includes(q) ||
          (digitos.length >= 3 && (l.telefone ?? "").includes(digitos))),
    );
  }, [ordenados, busca, filtro]);

  const selecionado = leads.find((l) => l.id === selecionadoId) ?? filtrados[0] ?? null;
  const qtdNaoLidas = leads.filter((l) => l.naoLidas > 0).length;
  const qtdAceitar = leads.filter((l) => l.aguardandoAceite).length;

  function abrir(id: string) {
    setSelecionadoId(id);
    setConversaAbertaNoCelular(true);
  }

  const zerarNaoLidas = useCallback((cardId: string) => {
    setLeads((ls) => ls.map((l) => (l.id === cardId && l.naoLidas > 0 ? { ...l, naoLidas: 0 } : l)));
  }, []);

  const filtros: Array<[Filtro, string, number]> = [
    ["todas", "Todas", leads.length],
    ["nao_lidas", "Não lidas", qtdNaoLidas],
    ["aceitar", "Aceitar", qtdAceitar],
  ];

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* Lista de conversas */}
      <section
        aria-label="Conversas"
        className={`${conversaAbertaNoCelular ? "hidden md:flex" : "flex"} w-full flex-col border-r border-slate-200 bg-white md:w-80 md:shrink-0 lg:w-[22rem]`}
      >
        <div className="space-y-3 border-b border-slate-100 p-4">
          <label className="flex items-center gap-2 rounded-xl border border-slate-300 px-3 py-2 focus-within:border-[#0F7B45]">
            <Search className="h-4 w-4 shrink-0 text-slate-500" aria-hidden="true" />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente ou telefone"
              aria-label="Buscar cliente ou telefone"
              className="w-full bg-transparent text-sm text-slate-800 outline-none"
            />
          </label>
          <div role="tablist" aria-label="Filtro de conversas" className="flex flex-wrap gap-1.5">
            {filtros.map(([valor, rotulo, qtd]) => {
              const ativo = filtro === valor;
              const alerta = valor === "aceitar" && qtd > 0 && !ativo;
              return (
                <button
                  key={valor}
                  role="tab"
                  aria-selected={ativo}
                  onClick={() => setFiltro(valor)}
                  className={`min-h-8 rounded-full px-3 text-[13px] font-medium transition ${
                    ativo
                      ? "bg-slate-800 text-white"
                      : alerta
                        ? "border border-red-300 bg-red-50 text-red-800"
                        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {rotulo} · {qtd}
                </button>
              );
            })}
          </div>
          {veTodos && (
            <select
              value={corretorId}
              onChange={(e) => {
                setCarregando(true);
                setCorretorId(e.target.value);
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#0F7B45]"
              aria-label="Filtrar por corretor"
            >
              <option value="">Todos os corretores</option>
              {corretores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {carregando ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </p>
          ) : erro ? (
            <p className="m-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>
          ) : filtrados.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-500">
              <Bot className="mx-auto mb-2 h-8 w-8 text-slate-300" aria-hidden="true" />
              {busca || filtro !== "todas"
                ? "Nenhuma conversa neste filtro."
                : "Nenhum lead da VIVI com você ainda. Quando a roleta te passar um, ele aparece aqui."}
            </div>
          ) : (
            <ul>
              {filtrados.map((l) => (
                <ItemConversa
                  key={l.id}
                  lead={l}
                  ativo={selecionado?.id === l.id}
                  mostrarDono={veTodos}
                  onAbrir={() => abrir(l.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Conversa */}
      <div className={`${conversaAbertaNoCelular ? "flex" : "hidden md:flex"} min-w-0 flex-1`}>
        {selecionado ? (
          <Conversa
            key={selecionado.id}
            lead={selecionado}
            me={me}
            onVoltar={() => setConversaAbertaNoCelular(false)}
            onListaMudou={carregar}
            onLido={zerarNaoLidas}
          />
        ) : (
          <div className="m-auto px-6 text-center text-sm text-slate-500">
            <MessageCircle className="mx-auto mb-2 h-10 w-10 text-[#0F7B45]/40" aria-hidden="true" />
            Escolha uma conversa para ver as mensagens e responder o cliente.
          </div>
        )}
      </div>
    </div>
  );
}

function ItemConversa({
  lead,
  ativo,
  mostrarDono,
  onAbrir,
}: {
  lead: LeadVivi;
  ativo: boolean;
  mostrarDono: boolean;
  onAbrir: () => void;
}) {
  const nome = nomeExibido(lead);
  const u = lead.ultimaMensagem;
  const previa = lead.aguardandoAceite
    ? "Novo lead — aceite para responder"
    : u
      ? `${u.autorTipo === "atendente" ? "Você: " : u.autorTipo === "vivi" ? "VIVI: " : ""}${
          (u.texto ?? "").replace(/^\*[^*\n]+\*\n/, "").replace(/[*_~]/g, "") || (u.temAnexo ? "Anexo" : "")
        }`
      : lead.empreendimento ?? telefoneFormatado(lead.telefone);
  const quando = u?.em ?? lead.atribuidoEm ?? lead.createdAt;
  const naoLida = lead.naoLidas > 0;

  return (
    <li>
      <button
        onClick={onAbrir}
        aria-current={ativo ? "true" : undefined}
        className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition ${
          ativo
            ? "border-l-[3px] border-l-[#0F7B45] bg-[#E8F5EE]"
            : lead.aguardandoAceite
              ? "bg-red-50 hover:bg-red-100/60"
              : "hover:bg-slate-50"
        }`}
      >
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            lead.aguardandoAceite ? "bg-red-100 text-red-800" : "bg-[#CDEBDC] text-[#0B5E35]"
          }`}
          aria-hidden="true"
        >
          {iniciais(nomeDoCliente(lead.titulo))}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center justify-between gap-2">
            <span className={`truncate text-sm text-slate-800 ${naoLida ? "font-bold" : "font-semibold"}`}>{nome}</span>
            <span className={`shrink-0 text-xs ${naoLida ? "font-semibold text-[#0F7B45]" : "text-slate-500"}`}>{horaCurta(quando)}</span>
          </span>
          <span className="flex items-center justify-between gap-2">
            <span
              className={`truncate text-[13px] ${
                lead.aguardandoAceite ? "font-semibold text-red-800" : naoLida ? "font-semibold text-slate-800" : "text-slate-600"
              }`}
            >
              {previa}
            </span>
            {naoLida && (
              <span
                className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-[#0F7B45] px-1.5 text-[11px] font-bold text-white"
                aria-label={`${lead.naoLidas} não lidas`}
              >
                {lead.naoLidas}
              </span>
            )}
          </span>
          {mostrarDono && lead.dono && <span className="truncate text-xs text-slate-500">com {lead.dono.nome}</span>}
        </span>
      </button>
    </li>
  );
}

type ItemLinha =
  | { tipo: "mensagem"; quando: number; m: MensagemChat }
  | { tipo: "evento"; quando: number; e: EventoChat }
  | { tipo: "dia"; quando: number; rotulo: string };

function rotuloDia(d: Date, agoraMs: number): string {
  const hoje = new Date(agoraMs);
  if (d.toDateString() === hoje.toDateString()) return "Hoje";
  if (d.toDateString() === new Date(agoraMs - 86_400_000).toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function Conversa({
  lead,
  me,
  onVoltar,
  onListaMudou,
  onLido,
}: {
  lead: LeadVivi;
  me: { id: string; name: string } | null;
  onVoltar: () => void;
  onListaMudou: () => void;
  onLido: (cardId: string) => void;
}) {
  const [chat, setChat] = useState<ChatResposta | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);
  const [painelAberto, setPainelAberto] = useState(true);
  const [agoraMs, setAgoraMs] = useState(() => Date.now());
  const caixaRef = useRef<HTMLDivElement>(null);
  const colarNoFimRef = useRef(true);
  const cliente = nomeDoCliente(lead.titulo);

  // Lido: no maximo a cada 3 s, so com a aba visivel.
  const ultimoLidoRef = useRef(0);
  const marcarLido = useCallback(() => {
    if (document.visibilityState !== "visible" || Date.now() - ultimoLidoRef.current < 3000) return;
    ultimoLidoRef.current = Date.now();
    onLido(lead.id);
    apiRequest(`/leads-vivi/${lead.id}/lido`, { method: "POST" }).catch(() => {});
  }, [lead.id, onLido]);

  const carregarTudo = useCallback(async () => {
    try {
      const r = await apiRequest<ChatResposta>(`/leads-vivi/${lead.id}/chat`);
      setChat(r);
      setErroCarga(null);
      colarNoFimRef.current = true;
      marcarLido();
    } catch (err) {
      setErroCarga(err instanceof ApiError ? err.message : "Não foi possível carregar a conversa.");
    } finally {
      setCarregando(false);
    }
  }, [lead.id, marcarLido]);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  // Atualizacao automatica: so o que foi gravado depois da ultima consulta.
  const chatRef = useRef(chat);
  chatRef.current = chat;
  useEffect(() => {
    const id = setInterval(async () => {
      const atual = chatRef.current;
      if (!atual || document.visibilityState !== "visible") return;
      const desde = atual.mensagens.reduce((max, m) => (m.gravadaEm > max ? m.gravadaEm : max), atual.agora);
      try {
        const r = await apiRequest<ChatResposta>(`/leads-vivi/${lead.id}/chat?desde=${encodeURIComponent(desde)}`);
        setChat((c) => {
          if (!c) return r;
          const ids = new Set(c.mensagens.map((m) => m.id));
          const novas = r.mensagens.filter((m) => !ids.has(m.id));
          if (novas.length) {
            const caixa = caixaRef.current;
            colarNoFimRef.current = !caixa || caixa.scrollHeight - caixa.scrollTop - caixa.clientHeight < 120;
          }
          return { ...r, mensagens: [...c.mensagens, ...novas] };
        });
        if (r.mensagens.length) marcarLido();
      } catch {
        // falha pontual de rede: tenta de novo na proxima volta
      }
    }, CONVERSA_MS);
    return () => clearInterval(id);
  }, [lead.id, marcarLido]);

  // Relogio da tela (contagem do aceite e da janela de 24 h).
  useEffect(() => {
    const id = setInterval(() => setAgoraMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Rola para a mensagem mais recente, a nao ser que o corretor esteja lendo
  // la em cima (nao arranca a tela dele).
  useEffect(() => {
    const caixa = caixaRef.current;
    if (caixa && colarNoFimRef.current) caixa.scrollTop = caixa.scrollHeight;
  }, [chat?.mensagens.length]);

  const linha = useMemo<ItemLinha[]>(() => {
    if (!chat) return [];
    const itens: ItemLinha[] = [
      ...chat.mensagens.map((m) => ({ tipo: "mensagem" as const, quando: new Date(m.quando).getTime(), m })),
      ...chat.eventos.map((e) => ({ tipo: "evento" as const, quando: new Date(e.quando).getTime(), e })),
    ].sort((a, b) => a.quando - b.quando);
    const comDias: ItemLinha[] = [];
    let diaAnterior = "";
    for (const item of itens) {
      const d = new Date(item.quando);
      if (d.toDateString() !== diaAnterior) {
        diaAnterior = d.toDateString();
        comDias.push({ tipo: "dia", quando: item.quando, rotulo: rotuloDia(d, agoraMs) });
      }
      comDias.push(item);
    }
    return comDias;
    // agoraMs fora de proposito: os rotulos de dia nao precisam mudar a cada segundo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat]);

  const envio = chat?.envio;
  const restanteJanela = tempoRestante(envio?.janelaFechaEm ?? null, agoraMs);
  const janelaAcabando =
    !!envio?.janelaFechaEm && new Date(envio.janelaFechaEm).getTime() - agoraMs < 2 * 3600_000 && !!restanteJanela;

  return (
    <div className="flex min-w-0 flex-1">
      <main className="flex min-w-0 flex-1 flex-col bg-[#EFEAE2]">
        <header className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5 md:px-5">
          <button
            onClick={onVoltar}
            aria-label="Voltar para as conversas"
            className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 md:hidden"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          </button>
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#CDEBDC] text-sm font-bold text-[#0B5E35]"
            aria-hidden="true"
          >
            {iniciais(cliente)}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-slate-800">{nomeExibido(lead)}</h2>
            <p className="truncate text-[13px] text-slate-600">
              {[telefoneFormatado(lead.telefone), lead.empreendimento, lead.dono ? (lead.dono.id === me?.id ? "Com você" : `Com ${lead.dono.nome}`) : null]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {envio && envio.motivo === "ok" && restanteJanela && (
            <span
              className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold sm:flex ${
                janelaAcabando ? "bg-amber-100 text-amber-900" : "bg-green-100 text-green-800"
              }`}
            >
              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
              {janelaAcabando ? `Janela fecha em ${restanteJanela}` : `Pode responder · ${restanteJanela} restantes`}
            </span>
          )}
          <button
            onClick={() => setPainelAberto((v) => !v)}
            aria-label={painelAberto ? "Esconder dados do lead" : "Mostrar dados do lead"}
            aria-pressed={painelAberto}
            className="hidden h-11 w-11 items-center justify-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 xl:flex"
          >
            <PanelRight className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </header>

        <div ref={caixaRef} className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-3 py-4 md:px-6">
          {carregando && !chat ? (
            <p className="m-auto flex items-center gap-2 text-sm text-slate-600">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando conversa...
            </p>
          ) : erroCarga && !chat ? (
            <p className="m-auto flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" /> {erroCarga}
            </p>
          ) : linha.length === 0 ? (
            <p className="m-auto text-sm text-slate-600">Nenhuma mensagem com este cliente no número oficial ainda.</p>
          ) : (
            <>
              {chat?.erro && (
                <p className="self-center rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{chat.erro}</p>
              )}
              {linha.map((item) =>
                item.tipo === "dia" ? (
                  <span key={`d-${item.quando}`} className="self-center rounded-lg bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">
                    {item.rotulo}
                  </span>
                ) : item.tipo === "evento" ? (
                  <span
                    key={`e-${item.e.tipo}-${item.quando}`}
                    className="flex items-center gap-1.5 self-center rounded-lg border border-[#F2E3A6] bg-[#FFF7D6] px-3 py-1 text-center text-xs text-slate-700"
                  >
                    <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {new Date(item.e.quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} ·{" "}
                    {item.e.tipo === "aceite" ? "Lead aceito · a VIVI parou de responder nesta conversa" : item.e.texto}
                  </span>
                ) : (
                  <Balao key={item.m.id} m={item.m} />
                ),
              )}
            </>
          )}
        </div>

        {envio && (
          <CaixaEnvio
            lead={lead}
            envio={envio}
            agoraMs={agoraMs}
            meNome={me?.name ?? null}
            onEnviado={() => {
              carregarTudo();
              onListaMudou();
            }}
            onAceito={() => {
              carregarTudo();
              onListaMudou();
            }}
          />
        )}
      </main>

      {painelAberto && <DadosDoLead lead={lead} onFechar={() => setPainelAberto(false)} />}
    </div>
  );
}

function Balao({ m }: { m: MensagemChat }) {
  const doCliente = m.autor === "cliente";
  const vivi = m.autor === "vivi";
  const cor = doCliente ? "bg-white" : vivi ? "bg-[#EEF2FF]" : "bg-[#D9FDD3]";
  const forma = doCliente ? "self-start rounded-[12px_12px_12px_4px]" : "self-end rounded-[12px_12px_4px_12px]";
  const rotulo = doCliente
    ? m.autorNome ?? "Cliente"
    : vivi
      ? "VIVI · assistente"
      : m.autorNome && m.autorNome !== "Gestor de Vendas"
        ? m.autorNome
        : "Corretor";
  const corRotulo = doCliente ? "text-slate-600" : vivi ? "text-[#3730A3]" : "text-[#166534]";

  return (
    <div className={`${forma} ${cor} max-w-[85%] px-3 py-2 shadow-[0_1px_1px_rgba(15,23,42,.08)] md:max-w-[70%]`}>
      <p className={`flex items-center gap-1 text-xs font-bold ${corRotulo}`}>
        {vivi && <Bot className="h-3.5 w-3.5" aria-hidden="true" />}
        {rotulo}
      </p>
      {m.anexos.map((a, i) =>
        a.tipo === "image" ? (
          <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="mt-1 block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={a.url} alt="Imagem enviada pelo cliente" className="max-h-64 rounded-lg object-cover" loading="lazy" />
          </a>
        ) : a.tipo === "audio" ? (
          <audio key={i} controls src={a.url} className="mt-1 w-64 max-w-full" aria-label="Áudio">
            <a href={a.url}>Ouvir áudio</a>
          </audio>
        ) : (
          <a
            key={i}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-800 no-underline hover:bg-slate-200"
          >
            <FileText className="h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
            {a.tipo === "video" ? "Vídeo · abrir" : "Arquivo · abrir"}
            <ExternalLink className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          </a>
        ),
      )}
      {m.texto && (
        <p className="mt-0.5 text-sm leading-relaxed text-slate-800">
          <TextoWhatsApp texto={m.texto} />
        </p>
      )}
      <p className="mt-1 text-right text-[11px] text-slate-500">
        {new Date(m.quando).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
      </p>
    </div>
  );
}

function CaixaEnvio({
  lead,
  envio,
  agoraMs,
  meNome,
  onEnviado,
  onAceito,
}: {
  lead: LeadVivi;
  envio: ChatResposta["envio"];
  agoraMs: number;
  meNome: string | null;
  onEnviado: () => void;
  onAceito: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [aceitando, setAceitando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar() {
    const t = texto.trim();
    if (!t || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await apiRequest(`/leads-vivi/${lead.id}/mensagens`, { method: "POST", body: JSON.stringify({ texto: t }) });
      setTexto("");
      onEnviado();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível enviar. Sua mensagem continua na caixa.");
    } finally {
      setEnviando(false);
    }
  }

  async function aceitar() {
    setAceitando(true);
    setErro(null);
    try {
      await apiRequest(`/cards/${lead.id}/aceitar-lead`, { method: "POST" });
      onAceito();
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível aceitar o lead.");
    } finally {
      setAceitando(false);
    }
  }

  if (envio.motivo === "aguardando_aceite") {
    const falta = contagem(envio.prazoAceiteAte, agoraMs);
    return (
      <footer className="border-t border-slate-200 bg-white p-3 md:px-5">
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3">
          <div className="min-w-[14rem] flex-1">
            <p className="text-[15px] font-bold text-red-800">Aceite para responder{falta ? ` · ${falta} restantes` : ""}</p>
            <p className="text-[13px] text-red-900">
              Enquanto você não aceita, a VIVI continua respondendo o cliente. Depois do prazo, o lead passa para o próximo da fila.
            </p>
          </div>
          <button
            onClick={aceitar}
            disabled={aceitando}
            className="flex min-h-12 items-center gap-2 rounded-xl bg-red-700 px-6 text-[15px] font-bold text-white hover:bg-red-800 disabled:opacity-60"
          >
            {aceitando && <Loader2 className="h-4 w-4 animate-spin" />} Aceitar lead
          </button>
        </div>
        {erro && <p className="mt-2 text-xs text-red-700">{erro}</p>}
      </footer>
    );
  }

  if (envio.motivo === "somente_leitura") {
    return (
      <footer className="border-t border-slate-200 bg-white p-3 md:px-5">
        <p className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-100 p-3 text-sm text-slate-800">
          <Eye className="h-5 w-5 shrink-0 text-slate-700" aria-hidden="true" />
          <span>
            <strong>Somente leitura.</strong> Este lead é {lead.dono ? <>de <strong>{lead.dono.nome}</strong></> : "de outro corretor"}. Para
            falar com o cliente, transfira o lead no Kanban.
          </span>
        </p>
      </footer>
    );
  }

  if (envio.motivo === "fora_da_janela" || envio.motivo === "sem_mensagem_do_cliente") {
    return (
      <footer className="border-t border-slate-200 bg-white p-3 md:px-5">
        <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <Lock className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="flex flex-col gap-1.5">
            <p className="text-[15px] font-bold text-amber-900">Mensagem livre bloqueada pelo WhatsApp</p>
            <p className="text-[13px] text-amber-900">
              {envio.motivo === "fora_da_janela" && envio.janelaFechaEm
                ? `A última mensagem do cliente foi em ${dataHoraVisita(
                    new Date(new Date(envio.janelaFechaEm).getTime() - 86_400_000).toISOString(),
                  )}. Passadas 24 h, o WhatsApp só permite retomar com um modelo aprovado.`
                : "O cliente ainda não escreveu para o número oficial. O WhatsApp só permite iniciar a conversa com um modelo aprovado."}{" "}
              Se for urgente, ligue para o cliente.
            </p>
            <button
              disabled
              className="self-start rounded-lg border border-dashed border-amber-600 bg-white px-4 py-2 text-sm font-semibold text-amber-800"
            >
              Enviar modelo aprovado · em breve
            </button>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="flex flex-col gap-1.5 border-t border-slate-200 bg-white p-3 md:px-5">
      {!envio.corretorJaEscreveu && !texto && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setTexto(mensagemApresentacao(lead))}
            className="flex min-h-9 items-center gap-1.5 rounded-full border border-[#A7D7BD] bg-[#F0FAF4] px-3.5 text-[13px] font-semibold text-[#0B5E35] hover:bg-[#E2F3EA]"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Inserir apresentação
          </button>
          <span className="text-xs text-slate-600">Coloca o texto pronto na caixa para você revisar</span>
        </div>
      )}
      {erro && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> {erro}
        </p>
      )}
      <div className="flex items-end gap-2">
        <label className="flex flex-1">
          <span className="sr-only">Mensagem para {nomeExibido(lead)}</span>
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviar();
              }
            }}
            rows={2}
            maxLength={4000}
            placeholder="Escreva sua mensagem…"
            className="min-h-12 flex-1 resize-none rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-[#0F7B45]"
          />
        </label>
        <button
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          className="flex min-h-12 items-center gap-2 rounded-xl bg-[#0F7B45] px-5 text-sm font-semibold text-white hover:bg-[#0B5E35] disabled:opacity-50"
        >
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" aria-hidden="true" />} Enviar
        </button>
      </div>
      <p className="text-xs text-slate-600">
        Sai pelo WhatsApp oficial com o seu nome{meNome ? ` (${meNome.split(" ")[0]})` : ""} no início · Enter envia, Shift+Enter quebra
        linha
      </p>
    </footer>
  );
}

function DadosDoLead({ lead, onFechar }: { lead: LeadVivi; onFechar: () => void }) {
  return (
    <aside
      aria-label="Dados do lead"
      className="hidden w-[18rem] shrink-0 flex-col gap-4 overflow-y-auto border-l border-slate-200 bg-white p-5 xl:flex"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-slate-800">Dados do lead</h2>
        <button
          onClick={onFechar}
          aria-label="Recolher dados do lead"
          className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
        >
          <ChevronRight className="h-[18px] w-[18px]" aria-hidden="true" />
        </button>
      </div>
      {lead.resumo && (
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-600">Resumo da VIVI</span>
          <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-sm leading-relaxed text-slate-800">{lead.resumo}</p>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-x-2 gap-y-3 text-[13px]">
        <dt className="text-slate-600">Telefone</dt>
        <dd className="font-semibold text-slate-800">{telefoneFormatado(lead.telefone) || "—"}</dd>
        <dt className="text-slate-600">Etapa</dt>
        <dd className="font-semibold text-slate-800">{lead.etapa ?? "Caixa de Entrada"}</dd>
        <dt className="text-slate-600">Produto</dt>
        <dd className="font-semibold text-slate-800">{lead.empreendimento ?? "—"}</dd>
        <dt className="text-slate-600">Corretor</dt>
        <dd className="font-semibold text-slate-800">{lead.dono?.nome ?? "—"}</dd>
        {lead.proximaVisita && (
          <>
            <dt className="text-slate-600">Visita</dt>
            <dd className="font-semibold text-slate-800">{dataHoraVisita(lead.proximaVisita)}</dd>
          </>
        )}
      </dl>
      <a
        href={`/dashboard/kanban?cardId=${lead.id}`}
        className="flex min-h-11 items-center justify-center rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 hover:bg-slate-50"
      >
        Abrir card no Kanban
      </a>
    </aside>
  );
}
