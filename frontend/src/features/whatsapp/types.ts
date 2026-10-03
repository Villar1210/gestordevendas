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

// Titulo gravado pela VIVI: "Maria Souza - visita via VIVI" (ou sem nome).
export function nomeDoCliente(titulo: string): string | null {
  const m = /^(.*?)\s+-\s+visita via VIVI$/i.exec(titulo.trim());
  return m ? m[1].trim() || null : null;
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
