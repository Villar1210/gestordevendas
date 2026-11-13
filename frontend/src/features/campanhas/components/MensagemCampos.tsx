// src/features/campanhas/components/MensagemCampos.tsx
// Campos da campanha (nome, mensagem com contador ao vivo, link, ritmo e
// horario). Usado em "Nova campanha" e na edicao. O contador simula o pior
// caso: primeiro nome de 12 letras (ou o maior da lista) + link no tamanho real.
"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { analisarTexto, montarExemplo } from "../constants";
import type { DadosCampanha } from "../types";

interface Props {
  valor: DadosCampanha;
  onChange: (v: DadosCampanha) => void;
  linkBase: string;
  maiorPrimeiroNome?: string;
  desabilitado?: boolean;
}

const inputBase =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-500";

export function MensagemCampos({ valor, onChange, linkBase, maiorPrimeiroNome, desabilitado }: Props) {
  const set = <K extends keyof DadosCampanha>(k: K, v: DadosCampanha[K]) => onChange({ ...valor, [k]: v });
  const nomeExemplo = maiorPrimeiroNome || "Mmmmmmmmmmmm";
  const exemplo = montarExemplo(valor.mensagem, nomeExemplo, linkBase);
  const analise = analisarTexto(exemplo);
  const limite = analise.codificacao === "GSM7" ? 160 : 70;
  const cabe = analise.segmentos <= valor.maxSegmentos;
  const temLink = valor.mensagem.includes("{link}");

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs font-medium text-slate-600">Nome da campanha (só para você)</span>
        <input
          className={`${inputBase} mt-1`}
          value={valor.nome}
          maxLength={120}
          disabled={desabilitado}
          onChange={(e) => set("nome", e.target.value)}
          placeholder="Repique Freguesia — 90 dias"
        />
      </label>

      <label className="block">
        <span className="text-xs font-medium text-slate-600">Mensagem do SMS</span>
        <textarea
          className={`${inputBase} mt-1 min-h-[96px] font-mono`}
          value={valor.mensagem}
          maxLength={600}
          disabled={desabilitado}
          onChange={(e) => set("mensagem", e.target.value)}
        />
        <span className="mt-1 block text-xs text-slate-500">
          Use <code className="rounded bg-slate-100 px-1">{"{primeiro_nome}"}</code> e{" "}
          <code className="rounded bg-slate-100 px-1">{"{link}"}</code> (obrigatório — vira o link curto de cada pessoa). Escreva sem
          acento: um único “ã” ou “ç” derruba o limite de 160 para 70 caracteres.
        </span>
      </label>

      <div className={`rounded-xl border p-3 text-sm ${cabe && temLink ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex flex-wrap items-center gap-2 font-medium">
          {cabe && temLink ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          ) : (
            <AlertTriangle className="h-4 w-4 text-amber-600" aria-hidden="true" />
          )}
          <span className="text-slate-800">
            {analise.tamanho} de {limite} caracteres · {analise.segmentos} SMS por pessoa
            {analise.codificacao === "UCS2" ? " (com acento/emoji)" : ""}
          </span>
        </div>
        {!temLink && <p className="mt-1 text-xs text-amber-800">Falta o {"{link}"} na mensagem.</p>}
        {!cabe && (
          <p className="mt-1 text-xs text-amber-800">
            Passa do limite de {valor.maxSegmentos} SMS por pessoa. Encurte o texto
            {analise.caracteresForaDoGsm.length ? ` ou tire: ${analise.caracteresForaDoGsm.join(" ")}` : ""}.
          </p>
        )}
        <p className="mt-2 break-words rounded-lg bg-white/70 p-2 font-mono text-xs text-slate-700">{exemplo}</p>
        <p className="mt-1 text-[11px] text-slate-500">
          Exemplo com o {maiorPrimeiroNome ? "maior primeiro nome da sua lista" : "nome mais comprido possível (12 letras)"} — é o pior caso.
        </p>
      </div>

      <label className="block">
        <span className="text-xs font-medium text-slate-600">Página de destino do link</span>
        <input
          className={`${inputBase} mt-1`}
          value={valor.linkDestino}
          maxLength={500}
          disabled={desabilitado}
          onChange={(e) => set("linkDestino", e.target.value)}
          placeholder="https://freguesia.ivillar.com.br"
        />
      </label>

      <details className="rounded-xl border border-slate-200 p-3">
        <summary className="cursor-pointer text-xs font-medium text-slate-600">Ritmo e horário de envio</summary>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="block">
            <span className="text-xs text-slate-600">SMS por minuto</span>
            <input
              type="number"
              min={6}
              max={120}
              className={`${inputBase} mt-1`}
              value={valor.taxaPorMinuto}
              disabled={desabilitado}
              onChange={(e) => set("taxaPorMinuto", Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">Máx. de SMS por pessoa</span>
            <select
              className={`${inputBase} mt-1`}
              value={valor.maxSegmentos}
              disabled={desabilitado}
              onChange={(e) => set("maxSegmentos", Number(e.target.value))}
            >
              <option value={1}>1 (recomendado)</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">Envia a partir de</span>
            <input
              type="number"
              min={6}
              max={22}
              className={`${inputBase} mt-1`}
              value={valor.janelaInicio}
              disabled={desabilitado}
              onChange={(e) => set("janelaInicio", Number(e.target.value))}
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">Para às (h)</span>
            <input
              type="number"
              min={6}
              max={22}
              className={`${inputBase} mt-1`}
              value={valor.janelaFim}
              disabled={desabilitado}
              onChange={(e) => set("janelaFim", Number(e.target.value))}
            />
          </label>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">Segunda a sábado, horário de Brasília. Domingo não envia.</p>
      </details>
    </div>
  );
}
