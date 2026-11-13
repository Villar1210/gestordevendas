// src/features/campanhas/components/ContatosTabela.tsx
// Contatos da campanha: filtro por situacao, busca (nome, corretor ou final do
// telefone) e paginacao de 50. Quem respondeu e quem clicou aparecem primeiro.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MousePointerClick, Search } from "lucide-react";
import { listarContatos, mensagemErro } from "../api";
import { STATUS_CONTATO, formatarDataHora } from "../constants";
import type { PaginaContatos, StatusContato } from "../types";

const FILTROS: { id: StatusContato | ""; label: string }[] = [
  { id: "", label: "Todos" },
  { id: "pendente", label: "Na fila" },
  { id: "enviado", label: "Enviados" },
  { id: "entregue", label: "Entregues" },
  { id: "falhou", label: "Falhas" },
  { id: "optout", label: "Pediram para sair" },
  { id: "bloqueado", label: "Bloqueados" },
];

export function ContatosTabela({ campanhaId, versao }: { campanhaId: string; versao: number }) {
  const [status, setStatus] = useState<StatusContato | "">("");
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [pagina, setPagina] = useState(1);
  const [dados, setDados] = useState<PaginaContatos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setBuscaAplicada(busca);
      setPagina(1);
    }, 350);
    return () => clearTimeout(t);
  }, [busca]);

  const carregar = useCallback(() => {
    setCarregando(true);
    setErro(null);
    listarContatos(campanhaId, { status: status || undefined, busca: buscaAplicada, pagina })
      .then(setDados)
      .catch((e) => setErro(mensagemErro(e)))
      .finally(() => setCarregando(false));
  }, [campanhaId, status, buscaAplicada, pagina]);

  useEffect(() => {
    carregar();
  }, [carregar, versao]);

  const paginas = dados ? Math.max(1, Math.ceil(dados.total / dados.porPagina)) : 1;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {FILTROS.map((f) => (
            <button
              key={f.id || "todos"}
              type="button"
              onClick={() => {
                setStatus(f.id);
                setPagina(1);
              }}
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${status === f.id ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <label className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, corretor ou telefone"
            aria-label="Buscar contato"
            className="w-full rounded-lg border border-slate-300 py-2 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
      </div>

      {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-xs text-slate-500">
            <tr className="border-b border-slate-200">
              <th className="py-2 pr-3 font-medium">Contato</th>
              <th className="py-2 pr-3 font-medium">Corretor</th>
              <th className="py-2 pr-3 font-medium">Situação</th>
              <th className="py-2 pr-3 font-medium">Enviado</th>
              <th className="py-2 pr-3 font-medium">Cliques</th>
              <th className="py-2 font-medium">Resposta</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dados?.itens.map((c) => (
              <tr key={c.id} className="align-top">
                <td className="py-2 pr-3">
                  <span className="block font-medium text-slate-800">{c.nome || c.primeiroNome || "—"}</span>
                  <span className="block text-xs text-slate-500">{c.telefoneFormatado}</span>
                </td>
                <td className="py-2 pr-3 text-xs text-slate-600">{c.corretor ?? "—"}</td>
                <td className="py-2 pr-3">
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CONTATO[c.status].classe}`}>
                    {STATUS_CONTATO[c.status].label}
                  </span>
                  {c.erro && c.status === "falhou" && <span className="mt-1 block max-w-[220px] text-[11px] text-red-600">{c.erro}</span>}
                </td>
                <td className="py-2 pr-3 text-xs text-slate-600">{formatarDataHora(c.enviadoEm)}</td>
                <td className="py-2 pr-3 text-xs text-slate-600">
                  {c.cliques > 0 ? (
                    <span className="inline-flex items-center gap-1 font-medium text-blue-700">
                      <MousePointerClick className="h-3.5 w-3.5" aria-hidden="true" /> {c.cliques}
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="py-2 text-xs text-slate-700">
                  {c.respostaTexto ? (
                    <>
                      <span className="block max-w-[260px] break-words">“{c.respostaTexto}”</span>
                      <span className="text-[11px] text-slate-400">{formatarDataHora(c.respondidoEm)}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {carregando && !dados && (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Carregando contatos...
          </div>
        )}
        {dados && dados.itens.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Nenhum contato aqui.</p>}
      </div>

      {dados && dados.total > dados.porPagina && (
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>
            {dados.total} contatos · página {pagina} de {paginas}
          </span>
          <span className="flex gap-1">
            <button type="button" disabled={pagina <= 1} onClick={() => setPagina(pagina - 1)} className="rounded-lg border px-2 py-1 disabled:opacity-40">
              Anterior
            </button>
            <button type="button" disabled={pagina >= paginas} onClick={() => setPagina(pagina + 1)} className="rounded-lg border px-2 py-1 disabled:opacity-40">
              Próxima
            </button>
          </span>
        </div>
      )}
    </div>
  );
}
