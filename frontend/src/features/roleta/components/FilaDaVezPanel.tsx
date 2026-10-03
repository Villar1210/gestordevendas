// src/features/roleta/components/FilaDaVezPanel.tsx
// Fatia 2 (Sorteio da vez): ordem de atendimento de cada roleta, visível
// para todos na Central de Atendimento. Botão "Sortear agora" para
// Administrador, gerentes, diretores e coordenadores.
"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, History, Shuffle, Users } from "lucide-react";
import { useRoletas } from "../hooks/useRoletas";
import { ORIGEM_SORTEIO_LABEL, horaCurta, type Roleta, type Sorteio } from "../types";

const POLL_MS = 30_000;

export function FilaDaVezPanel({ currentUserId }: { currentUserId: string | null }) {
  const { roletas, podeSortear, carregando, ocupado, carregar, sortear, historico } = useRoletas();
  const [aberto, setAberto] = useState(true);

  useEffect(() => {
    carregar();
    const id = setInterval(carregar, POLL_MS);
    return () => clearInterval(id);
  }, [carregar]);

  const ativas = roletas.filter((r) => r.ativa);
  if (carregando || ativas.length === 0) return null;

  return (
    <section className="border-b border-slate-200 bg-white px-6 py-3">
      <button
        onClick={() => setAberto((v) => !v)}
        className="flex w-full items-center justify-between text-left"
        aria-expanded={aberto}
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
          <Shuffle className="h-4 w-4 text-blue-600" />
          Fila da vez
          <span className="font-normal text-slate-400">
            ({ativas.length} {ativas.length === 1 ? "roleta" : "roletas"})
          </span>
        </span>
        {aberto ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {aberto && (
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {ativas.map((r) => (
            <RoletaFilaCard
              key={r.id}
              roleta={r}
              currentUserId={currentUserId}
              podeSortear={podeSortear}
              ocupado={ocupado}
              onSortear={async () => {
                if (!confirm(`Sortear agora a ordem da roleta "${r.nome}"? A fila atual será substituída.`)) return;
                await sortear(r.id);
              }}
              carregarHistorico={() => historico(r.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function RoletaFilaCard({
  roleta,
  currentUserId,
  podeSortear,
  ocupado,
  onSortear,
  carregarHistorico,
}: {
  roleta: Roleta;
  currentUserId: string | null;
  podeSortear: boolean;
  ocupado: boolean;
  onSortear: () => void;
  carregarHistorico: () => Promise<Sorteio[]>;
}) {
  const [hist, setHist] = useState<Sorteio[] | null>(null);
  const proximo = roleta.fila.find((f) => f.presente)?.userId ?? null;
  const minhaPosicao = roleta.fila.findIndex((f) => f.userId === currentUserId);
  const sorteioHoje =
    roleta.ultimoSorteio &&
    new Date(roleta.ultimoSorteio.createdAt).toDateString() === new Date().toDateString()
      ? roleta.ultimoSorteio
      : null;

  return (
    <div className="w-72 shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-1 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-800" title={roleta.nome}>
            {roleta.nome}
          </p>
          <p className="text-xs text-slate-500">
            {[
              roleta.tipo === "stand" ? "Stand" : "Produto",
              roleta.padrao ? "padrão" : null,
              roleta.proximoHorario
                ? `próximo sorteio ${roleta.proximoHorario}${roleta.modoSorteio === "botao" ? " (botão)" : ""}`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {podeSortear && (
          <button
            onClick={onSortear}
            disabled={ocupado}
            className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            <Shuffle className="h-3.5 w-3.5" />
            Sortear agora
          </button>
        )}
      </div>

      <p className="mb-2 text-xs text-slate-400">
        {sorteioHoje
          ? `Sorteada às ${horaCurta(sorteioHoje.createdAt)} (${
              sorteioHoje.disparadoPorNome ?? ORIGEM_SORTEIO_LABEL[sorteioHoje.origem]
            })`
          : "Ainda sem sorteio hoje: vale a ordem de chegada"}
      </p>

      {minhaPosicao >= 0 && (
        <p className="mb-2 rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
          {roleta.fila[minhaPosicao].userId === proximo ? "Você é o próximo a receber!" : `Você está em ${minhaPosicao + 1}º`}
        </p>
      )}

      {roleta.fila.length === 0 ? (
        <p className="flex items-center gap-1.5 py-2 text-xs text-slate-400">
          <Users className="h-3.5 w-3.5" />
          Ninguém na fila agora.
        </p>
      ) : (
        <ol className="max-h-48 space-y-1 overflow-y-auto">
          {roleta.fila.map((f) => (
            <li
              key={f.userId}
              className={`flex items-center gap-2 rounded-md px-2 py-1 text-sm ${
                f.userId === proximo ? "bg-white font-medium text-slate-800 shadow-sm" : "text-slate-600"
              }`}
            >
              <span className="w-5 text-right text-xs text-slate-400">{f.posicao}º</span>
              <span
                className={`h-2 w-2 shrink-0 rounded-full ${f.presente ? "bg-green-500" : "bg-slate-300"}`}
                title={f.presente ? "Online" : "Offline (mantém o lugar)"}
              />
              <span className="truncate">
                {f.nome}
                {f.userId === currentUserId ? " (você)" : ""}
              </span>
              {f.userId === proximo && <span className="ml-auto text-xs text-blue-600">próximo</span>}
            </li>
          ))}
        </ol>
      )}

      <button
        onClick={async () => setHist(hist ? null : await carregarHistorico())}
        className="mt-2 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
      >
        <History className="h-3.5 w-3.5" />
        {hist ? "Ocultar histórico" : "Histórico de sorteios"}
      </button>
      {hist && (
        <ul className="mt-1 max-h-40 space-y-1.5 overflow-y-auto text-xs text-slate-500">
          {hist.length === 0 && <li>Nenhum sorteio ainda.</li>}
          {hist.map((s) => (
            <li key={s.id} className="rounded-md bg-white px-2 py-1">
              <span className="font-medium text-slate-700">
                {new Date(s.createdAt).toLocaleDateString("pt-BR")} {horaCurta(s.createdAt)}
              </span>{" "}
              · {s.disparadoPorNome ?? ORIGEM_SORTEIO_LABEL[s.origem]}
              <br />
              {s.ordem.length ? s.ordem.map((o, i) => `${i + 1}. ${o.nome}`).join("  ") : "ninguém presente"}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
