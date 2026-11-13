// src/features/campanhas/constants.ts
// Rotulos/cores de status e a contagem de caracteres do SMS (copia da regra
// do backend em campanhas_sms/domain/services/sms-texto.ts - o backend e a
// fonte da verdade; aqui e so para o contador ao vivo enquanto se digita).
import type { AnaliseTexto, StatusCampanha, StatusContato } from "./types";

export const STATUS_CAMPANHA: Record<StatusCampanha, { label: string; classe: string }> = {
  rascunho: { label: "Rascunho", classe: "bg-slate-100 text-slate-700" },
  enviando: { label: "Enviando", classe: "bg-blue-100 text-blue-800" },
  pausada: { label: "Pausada", classe: "bg-amber-100 text-amber-800" },
  concluida: { label: "Concluída", classe: "bg-emerald-100 text-emerald-800" },
  cancelada: { label: "Cancelada", classe: "bg-red-100 text-red-700" },
};

export const STATUS_CONTATO: Record<StatusContato, { label: string; classe: string }> = {
  pendente: { label: "Na fila", classe: "bg-slate-100 text-slate-700" },
  enviando: { label: "Enviando", classe: "bg-blue-100 text-blue-800" },
  enviado: { label: "Enviado", classe: "bg-blue-100 text-blue-800" },
  entregue: { label: "Entregue", classe: "bg-emerald-100 text-emerald-800" },
  falhou: { label: "Falhou", classe: "bg-red-100 text-red-700" },
  bloqueado: { label: "Bloqueado", classe: "bg-slate-200 text-slate-600" },
  optout: { label: "Pediu para sair", classe: "bg-amber-100 text-amber-800" },
  cancelado: { label: "Cancelado", classe: "bg-slate-100 text-slate-500" },
};

export const MENSAGEM_PADRAO =
  "Oi {primeiro_nome}, e a Novolar! Novolar Freguesia: Minha Casa Minha Vida com FGTS. Veja a tabela: {link} SAIR p/ parar";

const GSM7_BASICO = new Set(
  Array.from(
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?" +
      "¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà",
  ),
);
const GSM7_EXTENSAO = new Set(Array.from("^{}\\[~]|€\f"));

export function analisarTexto(texto: string): AnaliseTexto {
  let septetos = 0;
  const fora = new Set<string>();
  for (const ch of Array.from(texto)) {
    if (GSM7_BASICO.has(ch)) septetos += 1;
    else if (GSM7_EXTENSAO.has(ch)) septetos += 2;
    else fora.add(ch);
  }
  if (fora.size === 0) {
    const segmentos = septetos === 0 ? 0 : septetos <= 160 ? 1 : Math.ceil(septetos / 153);
    return { codificacao: "GSM7", tamanho: septetos, segmentos, caracteresForaDoGsm: [] };
  }
  const unidades = texto.length;
  return {
    codificacao: "UCS2",
    tamanho: unidades,
    segmentos: unidades <= 70 ? 1 : Math.ceil(unidades / 67),
    caracteresForaDoGsm: Array.from(fora).slice(0, 10),
  };
}

export function montarExemplo(modelo: string, primeiroNome: string, linkBase: string): string {
  const nome = primeiroNome.trim();
  let texto = modelo;
  if (!nome) texto = texto.replace(/\s*\{primeiro_nome\}/g, "");
  return texto.split("{primeiro_nome}").join(nome).split("{link}").join(`${linkBase}/XXXXXX`);
}

export function formatarDataHora(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
}

export function pct(parte: number, total: number): string {
  if (!total) return "—";
  return `${((parte / total) * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}
