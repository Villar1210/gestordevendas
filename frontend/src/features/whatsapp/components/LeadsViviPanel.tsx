// src/features/whatsapp/components/LeadsViviPanel.tsx
// Fatia 3 (WhatsApp do corretor): leads que a VIVI passou ao corretor (pela
// roleta). Ele lê o resumo e a conversa da VIVI com o cliente (só leitura) e
// continua o atendimento pelo PRÓPRIO WhatsApp (wa.me), com uma mensagem de
// apresentação pronta e editável. Nada aqui envia mensagem pelo número da VIVI.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  Building2,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Loader2,
  MessageCircle,
  Phone,
  RefreshCw,
  Search,
  User,
} from "lucide-react";
import { apiRequest, ApiError } from "@/core/api/client";
import {
  dataHoraVisita,
  linkWhatsApp,
  mensagemInicial,
  nomeDoCliente,
  telefoneFormatado,
  type ConversaVivi,
  type LeadVivi,
} from "../types";

const POLL_MS = 30_000;

interface Props {
  me: { id: string; name: string } | null;
}

export function LeadsViviPanel({ me }: Props) {
  const [leads, setLeads] = useState<LeadVivi[]>([]);
  const [veTodos, setVeTodos] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [corretorId, setCorretorId] = useState("");
  const [corretores, setCorretores] = useState<Array<{ id: string; name: string }>>([]);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const resp = await apiRequest<{ leads: LeadVivi[]; veTodos: boolean }>(
        `/leads-vivi${corretorId ? `?corretorId=${corretorId}` : ""}`,
      );
      setLeads(resp.leads);
      setVeTodos(resp.veTodos);
      setErro(null);
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : "Não foi possível carregar os leads.");
    } finally {
      setCarregando(false);
    }
  }, [corretorId]);

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, POLL_MS);
    return () => clearInterval(id);
  }, [carregar]);

  useEffect(() => {
    if (veTodos && corretores.length === 0) {
      apiRequest<Array<{ id: string; name: string }>>("/rh/corretores").then(setCorretores).catch(() => {});
    }
  }, [veTodos, corretores.length]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const digitos = q.replace(/\D/g, "");
    return leads.filter(
      (l) =>
        !q ||
        l.titulo.toLowerCase().includes(q) ||
        (l.empreendimento ?? "").toLowerCase().includes(q) ||
        (digitos.length >= 3 && (l.telefone ?? "").includes(digitos)),
    );
  }, [leads, busca]);

  const selecionado = filtrados.find((l) => l.id === selecionadoId) ?? filtrados[0] ?? null;
  const pendentes = leads.filter((l) => l.aguardandoAceite).length;
  const semContato = leads.filter((l) => !l.ultimoContatoEm).length;

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-hidden p-4 lg:flex-row">
      {/* Lista */}
      <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white lg:w-96 lg:shrink-0">
        <div className="space-y-2 border-b border-slate-100 p-3">
          <div className="flex gap-2 text-xs">
            <span className="rounded-full bg-[#25D366]/10 px-2.5 py-1 font-medium text-[#0F7A3D]">{leads.length} leads</span>
            {semContato > 0 && (
              <span className="rounded-full bg-amber-50 px-2.5 py-1 font-medium text-amber-700">{semContato} sem contato</span>
            )}
            {pendentes > 0 && (
              <span className="rounded-full bg-red-50 px-2.5 py-1 font-medium text-red-700">{pendentes} aguardando aceite</span>
            )}
          </div>
          <label className="relative block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar cliente, telefone ou empreendimento"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-[#25D366]"
            />
          </label>
          {veTodos && (
            <select
              value={corretorId}
              onChange={(e) => {
                setCarregando(true);
                setCorretorId(e.target.value);
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#25D366]"
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
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </p>
          ) : erro ? (
            <p className="m-3 rounded-lg bg-red-50 p-3 text-sm text-red-600">{erro}</p>
          ) : filtrados.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-slate-400">
              <Bot className="mx-auto mb-2 h-8 w-8 text-slate-300" />
              {busca ? "Nada encontrado." : "Nenhum lead da VIVI com você ainda. Quando a roleta te passar um, ele aparece aqui."}
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filtrados.map((l) => {
                const ativo = selecionado?.id === l.id;
                return (
                  <li key={l.id}>
                    <button
                      onClick={() => setSelecionadoId(l.id)}
                      className={`w-full px-4 py-3 text-left transition ${ativo ? "bg-[#25D366]/10" : "hover:bg-slate-50"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {nomeDoCliente(l.titulo) ?? telefoneFormatado(l.telefone) ?? l.titulo}
                        </p>
                        {l.aguardandoAceite ? (
                          <span className="shrink-0 rounded bg-red-50 px-1.5 py-0.5 text-[11px] font-medium text-red-700">aceitar</span>
                        ) : !l.ultimoContatoEm ? (
                          <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700">novo</span>
                        ) : (
                          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#25D366]" aria-label="Contato feito" />
                        )}
                      </div>
                      <p className="truncate text-xs text-slate-500">
                        {[l.empreendimento, l.proximaVisita ? `visita ${dataHoraVisita(l.proximaVisita)}` : null]
                          .filter(Boolean)
                          .join(" · ") || telefoneFormatado(l.telefone)}
                      </p>
                      {veTodos && l.dono && <p className="truncate text-xs text-slate-400">com {l.dono.nome}</p>}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Detalhe */}
      <div className="flex min-h-[28rem] flex-1 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {selecionado ? (
          <LeadDetalhe key={selecionado.id} lead={selecionado} me={me} veTodos={veTodos} onAtualizar={carregar} />
        ) : (
          <div className="m-auto px-6 text-center text-sm text-slate-400">
            <MessageCircle className="mx-auto mb-2 h-10 w-10 text-[#25D366]/40" />
            Selecione um lead para ver a conversa da VIVI e falar com o cliente pelo seu WhatsApp.
          </div>
        )}
      </div>
    </div>
  );
}

function LeadDetalhe({
  lead,
  me,
  veTodos,
  onAtualizar,
}: {
  lead: LeadVivi;
  me: { id: string; name: string } | null;
  veTodos: boolean;
  onAtualizar: () => void;
}) {
  const [conversa, setConversa] = useState<ConversaVivi | null>(null);
  const [carregandoConversa, setCarregandoConversa] = useState(true);
  const [texto, setTexto] = useState(() => mensagemInicial(lead, me?.name ?? null));
  const [aceitando, setAceitando] = useState(false);
  const souDono = !!me && lead.dono?.id === me.id;
  const cliente = nomeDoCliente(lead.titulo);

  const carregarConversa = useCallback(async () => {
    setCarregandoConversa(true);
    try {
      setConversa(await apiRequest<ConversaVivi>(`/leads-vivi/${lead.id}/conversa`));
    } catch (err) {
      setConversa({
        encontrado: false,
        conversaUrl: null,
        status: null,
        mensagens: [],
        erro: err instanceof ApiError ? err.message : "Não foi possível carregar a conversa.",
      });
    } finally {
      setCarregandoConversa(false);
    }
  }, [lead.id]);

  useEffect(() => {
    carregarConversa();
  }, [carregarConversa]);

  async function aceitar() {
    setAceitando(true);
    try {
      await apiRequest(`/cards/${lead.id}/aceitar-lead`, { method: "POST" });
      onAtualizar();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Não foi possível aceitar o lead.");
    } finally {
      setAceitando(false);
    }
  }

  function abrirWhatsApp() {
    if (!lead.telefone) return;
    window.open(linkWhatsApp(lead.telefone, texto), "_blank", "noopener,noreferrer");
    // Registra o contato (histórico do card) sem travar a abertura do WhatsApp.
    apiRequest(`/leads-vivi/${lead.id}/contato`, { method: "POST" })
      .then(onAtualizar)
      .catch(() => {});
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden xl:flex-row">
      {/* Coluna: dados + ação */}
      <div className="flex flex-col gap-4 overflow-y-auto border-b border-slate-100 p-5 xl:w-[22rem] xl:shrink-0 xl:border-b-0 xl:border-r">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">{cliente ?? "Cliente da VIVI"}</h2>
          <p className="flex items-center gap-1.5 text-sm text-slate-500">
            <Phone className="h-3.5 w-3.5" /> {telefoneFormatado(lead.telefone) || "sem telefone"}
          </p>
        </div>

        <dl className="space-y-2 text-sm">
          {lead.empreendimento && (
            <div className="flex items-center gap-2 text-slate-600">
              <Building2 className="h-4 w-4 shrink-0 text-slate-400" /> {lead.empreendimento}
            </div>
          )}
          {lead.proximaVisita && (
            <div className="flex items-center gap-2 text-slate-600">
              <CalendarClock className="h-4 w-4 shrink-0 text-slate-400" /> Visita {dataHoraVisita(lead.proximaVisita)}
            </div>
          )}
          {lead.dono && (
            <div className="flex items-center gap-2 text-slate-600">
              <User className="h-4 w-4 shrink-0 text-slate-400" /> {souDono ? "Com você" : `Com ${lead.dono.nome}`}
              {lead.etapa ? ` · ${lead.etapa}` : ""}
            </div>
          )}
        </dl>

        {lead.resumo && (
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Resumo da VIVI</p>
            <p className="whitespace-pre-line text-sm text-slate-700">{lead.resumo}</p>
          </div>
        )}

        {lead.aguardandoAceite && souDono ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3">
            <p className="mb-2 text-sm text-red-700">
              Este lead acabou de chegar para você. Aceite antes do prazo, senão ele passa para o próximo da fila.
            </p>
            <button
              onClick={aceitar}
              disabled={aceitando}
              className="w-full rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
            >
              {aceitando ? "Aceitando..." : "Aceitar lead"}
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Mensagem de apresentação
            </label>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={7}
              className="w-full resize-y rounded-lg border border-slate-200 p-3 text-sm text-slate-700 outline-none focus:border-[#25D366]"
            />
            <button
              onClick={abrirWhatsApp}
              disabled={!lead.telefone || (!souDono && !veTodos)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#1FB959] disabled:opacity-50"
            >
              <MessageCircle className="h-4 w-4" />
              Abrir no meu WhatsApp
            </button>
            <p className="text-xs text-slate-400">
              {lead.ultimoContatoEm
                ? `Último contato registrado em ${new Date(lead.ultimoContatoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}.`
                : "Abre o WhatsApp do seu celular/computador com a mensagem pronta. O contato fica registrado no card."}
            </p>
          </div>
        )}
      </div>

      {/* Coluna: conversa da VIVI (somente leitura) */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Bot className="h-4 w-4 text-[#25D366]" /> Conversa com a VIVI
            <span className="font-normal text-slate-400">(somente leitura)</span>
          </p>
          <div className="flex items-center gap-3">
            {veTodos && conversa?.conversaUrl && (
              <a
                href={conversa.conversaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
              >
                Chatwoot <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <button onClick={carregarConversa} className="text-slate-400 hover:text-slate-600" aria-label="Atualizar conversa">
              <RefreshCw className={`h-4 w-4 ${carregandoConversa ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto bg-[#efeae2]/60 p-4">
          {carregandoConversa && !conversa ? (
            <p className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando conversa...
            </p>
          ) : conversa?.erro ? (
            <p className="flex items-center gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
              <AlertTriangle className="h-4 w-4 shrink-0" /> {conversa.erro}
            </p>
          ) : !conversa?.encontrado || conversa.mensagens.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-400">Nenhuma conversa da VIVI encontrada para este telefone.</p>
          ) : (
            conversa.mensagens.map((m, i) => (
              <div key={i} className={`flex ${m.autor === "cliente" ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                    m.autor === "cliente" ? "bg-white text-slate-800" : m.autor === "vivi" ? "bg-[#d9fdd3] text-slate-800" : "bg-blue-50 text-slate-800"
                  }`}
                >
                  {m.autor !== "cliente" && (
                    <p className="mb-0.5 text-[11px] font-semibold text-slate-500">{m.autor === "vivi" ? "VIVI" : "Atendente"}</p>
                  )}
                  <p className="whitespace-pre-line">{m.texto}</p>
                  <p className="mt-1 text-right text-[10px] text-slate-400">
                    {new Date(m.quando).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
