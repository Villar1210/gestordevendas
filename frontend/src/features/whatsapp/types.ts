// src/features/whatsapp/types.ts
// Fatia 3 (WhatsApp do corretor) - espelha GET /leads-vivi e /conversa.

export interface LeadVivi {
  id: string;
  titulo: string;
  telefone: string | null;
  resumo: string | null;
  createdAt: string;
  etapa: string | null;
  empreendimento: string | null;
  dono: { id: string; nome: string } | null;
  aguardandoAceite: boolean;
  atribuidoEm: string | null;
  proximaVisita: string | null;
  ultimoContatoEm: string | null;
  // Etapa 3 (tela de chat)
  ultimaMensagem: { texto: string | null; autorTipo: "cliente" | "vivi" | "atendente"; em: string; temAnexo: boolean } | null;
  naoLidas: number;
}

// Etapa 3 (19/11/2026) - espelha GET /leads-vivi/:id/chat
export type AutorChat = "cliente" | "vivi" | "atendente";

export interface MensagemChat {
  id: number;
  direcao: "entrada" | "saida";
  autor: AutorChat;
  autorNome: string | null;
  texto: string | null;
  anexos: Array<{ tipo: string; url: string }>;
  quando: string;
  gravadaEm: string;
}

export interface EventoChat {
  tipo: "aceite" | "passagem";
  texto: string;
  quando: string;
}

export type MotivoEnvio = "ok" | "somente_leitura" | "aguardando_aceite" | "fora_da_janela" | "sem_mensagem_do_cliente";

export interface EnvioChat {
  podeEnviar: boolean;
  motivo: MotivoEnvio;
  janelaFechaEm: string | null;
  prazoAceiteAte: string | null;
  corretorJaEscreveu: boolean;
}

export interface ChatResposta {
  mensagens: MensagemChat[];
  eventos: EventoChat[];
  envio: EnvioChat;
  agora: string;
  erro: string | null;
}

// Texto do botao "Inserir apresentacao" (decisao do Villar, 19/11/2026): o
// nome do corretor ja vai em negrito na 1a linha, entao nao se repete aqui.
export function mensagemApresentacao(lead: LeadVivi): string {
  const cliente = nomeDoCliente(lead.titulo)?.split(" ")[0];
  return `Oi${cliente ? `, ${cliente}` : ""}! Vou te acompanhar a partir de agora. Recebi seu contato pela nossa assistente VIVI${
    lead.empreendimento ? ` sobre o ${lead.empreendimento}` : ""
  }. Ficou alguma dúvida que eu possa responder antes?`;
}

// "21h", "1h 05min", "12min" - tempo que falta ate `fim`.
export function tempoRestante(fim: string | null, agoraMs: number): string | null {
  if (!fim) return null;
  const ms = new Date(fim).getTime() - agoraMs;
  if (ms <= 0) return null;
  const min = Math.floor(ms / 60_000);
  const h = Math.floor(min / 60);
  if (h >= 2) return `${h}h`;
  if (h >= 1) return `${h}h ${String(min % 60).padStart(2, "0")}min`;
  if (min >= 1) return `${min}min`;
  return "menos de 1min";
}

// "4:12" - contagem regressiva do aceite.
export function contagem(fim: string | null, agoraMs: number): string | null {
  if (!fim) return null;
  const s = Math.max(0, Math.floor((new Date(fim).getTime() - agoraMs) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function horaCurta(iso: string, agoraMs = Date.now()): string {
  const d = new Date(iso);
  const hoje = new Date(agoraMs);
  if (d.toDateString() === hoje.toDateString()) return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const ontem = new Date(agoraMs - 86_400_000);
  if (d.toDateString() === ontem.toDateString()) return "Ontem";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

export function iniciais(nome: string | null): string {
  const partes = (nome ?? "").trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  return ((partes[0][0] ?? "") + (partes.length > 1 ? partes[partes.length - 1][0] : "")).toUpperCase();
}

export interface MensagemVivi {
  autor: "cliente" | "vivi" | "atendente";
  texto: string;
  quando: string;
}

export interface ConversaVivi {
  encontrado: boolean;
  conversaUrl: string | null;
  status: string | null;
  mensagens: MensagemVivi[];
  erro: string | null;
}

// Titulos gravados pela VIVI: "Maria Souza - visita via VIVI" (agendar
// visita), "Maria Souza" (VIVI do fazer.ai, fase B) ou um titulo generico
// quando ela ainda nao sabe o nome.
const TITULOS_GENERICOS = /^(contato pela vivi|lead da vivi|contato pelo whatsapp)$/i;

export function nomeDoCliente(titulo: string): string | null {
  const t = titulo.trim();
  const m = /^(.*?)\s+-\s+visita via VIVI$/i.exec(t);
  if (m) return m[1].trim() || null;
  return t && !TITULOS_GENERICOS.test(t) ? t : null;
}

export function telefoneFormatado(t: string | null): string {
  const d = (t ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return t ?? "";
}

export function dataHoraVisita(iso: string): string {
  const d = new Date(iso);
  const dia = d.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" });
  const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return `${dia} às ${hora}`;
}

export function mensagemInicial(lead: LeadVivi, meuNome: string | null): string {
  const cliente = nomeDoCliente(lead.titulo)?.split(" ")[0];
  const eu = meuNome?.split(" ")[0];
  return [
    `Olá${cliente ? `, ${cliente}` : ""}! Tudo bem?`,
    `Aqui é ${eu ? `o(a) ${eu}` : "o(a) corretor(a)"}, vou te acompanhar a partir de agora. Recebi seu contato pela nossa assistente VIVI${
      lead.empreendimento ? ` sobre o ${lead.empreendimento}` : ""
    }${lead.proximaVisita ? ` e vi que sua visita está marcada para ${dataHoraVisita(lead.proximaVisita)}` : ""}.`,
    "Ficou alguma dúvida que eu possa responder antes?",
  ].join("\n\n");
}

export function linkWhatsApp(telefone: string, texto: string): string {
  const d = telefone.replace(/\D/g, "");
  const numero = /^\d{10,11}$/.test(d) ? `55${d}` : d;
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
