// src/features/campanhas/components/CampanhasLista.tsx
// Lista de campanhas + "Nova campanha" (cria o rascunho e abre o detalhe,
// onde se importa a planilha e dispara).
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ChevronRight, Loader2, MessageSquareText, Plus } from "lucide-react";
import { criarCampanha, listarCampanhas, mensagemErro } from "../api";
import { MENSAGEM_PADRAO, STATUS_CAMPANHA, formatarDataHora, pct } from "../constants";
import type { Campanha, DadosCampanha } from "../types";
import { MensagemCampos } from "./MensagemCampos";

const NOVA: DadosCampanha = {
  nome: "",
  mensagem: MENSAGEM_PADRAO,
  linkDestino: "https://freguesia.ivillar.com.br",
  maxSegmentos: 1,
  taxaPorMinuto: 30,
  janelaInicio: 9,
  janelaFim: 20,
};

// O link curto real so e conhecido depois de criar (vem do servidor); para o
// contador da criacao, usa o endereco padrao de producao.
const LINK_BASE_PADRAO = "https://gestordevendas.ivillar.com.br/r";

export function CampanhasLista() {
  const router = useRouter();
  const [itens, setItens] = useState<Campanha[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState<DadosCampanha>(NOVA);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState<string | null>(null);

  const carregar = useCallback(() => {
    setErro(null);
    listarCampanhas()
      .then(setItens)
      .catch((e) => setErro(mensagemErro(e)));
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function salvar() {
    setSalvando(true);
    setErroForm(null);
    try {
      const c = await criarCampanha(form);
      router.push(`/dashboard/campanhas/${c.id}`);
    } catch (e) {
      setErroForm(mensagemErro(e));
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      {criando && (
        <section className="rounded-2xl border border-blue-200 bg-white p-4 sm:p-5">
          <h2 className="text-sm font-semibold text-slate-800">Nova campanha</h2>
          <p className="mt-0.5 text-xs text-slate-500">Depois de criar, você importa a planilha, manda um SMS de teste e dispara.</p>
          <div className="mt-4">
            <MensagemCampos valor={form} onChange={setForm} linkBase={LINK_BASE_PADRAO} />
          </div>
          {erroForm && <p className="mt-3 text-sm text-red-600">{erroForm}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={salvando || !form.nome.trim()}
              onClick={salvar}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
            >
              {salvando && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />} Criar rascunho
            </button>
            <button type="button" onClick={() => setCriando(false)} className="rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Cancelar
            </button>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Campanhas</h2>
            <p className="mt-0.5 text-xs text-slate-500">SMS em massa com link único por pessoa: você vê quem recebeu, clicou e respondeu.</p>
          </div>
          {!criando && (
            <button
              type="button"
              onClick={() => {
                setForm(NOVA);
                setCriando(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
            >
              <Plus className="h-4 w-4" aria-hidden="true" /> Nova campanha
            </button>
          )}
        </div>

        <div className="mt-4">
          {erro ? (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" aria-hidden="true" /> {erro}
              <button type="button" onClick={carregar} className="ml-auto underline">
                Tentar de novo
              </button>
            </div>
          ) : itens === null ? (
            <div className="flex items-center justify-center gap-2 py-14 text-sm text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" /> Carregando...
            </div>
          ) : itens.length === 0 ? (
            <div className="py-14 text-center text-sm text-slate-500">
              <MessageSquareText className="mx-auto mb-2 h-8 w-8 text-slate-300" aria-hidden="true" />
              Nenhuma campanha ainda. Clique em <strong>Nova campanha</strong>.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {itens.map((c) => {
                const enviados = c.contagens.enviado + c.contagens.entregue + c.contagens.optout;
                return (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/campanhas/${c.id}`)}
                      className="flex w-full min-w-0 items-center gap-3 px-1 py-3 text-left hover:bg-slate-50"
                    >
                      <MessageSquareText className="h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="break-words text-sm font-medium text-slate-800">{c.nome}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CAMPANHA[c.status].classe}`}>
                            {STATUS_CAMPANHA[c.status].label}
                          </span>
                        </span>
                        <span className="block text-xs text-slate-500">
                          {c.contagens.total} contatos · {enviados} enviados · {c.contagens.comClique} clicaram (
                          {pct(c.contagens.comClique, enviados)}) · {c.contagens.comResposta} responderam · criada em{" "}
                          {formatarDataHora(c.createdAt)}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
