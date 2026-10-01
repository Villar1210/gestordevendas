// src/features/imoveis/components/EmpreendimentosTab.tsx
// Secao "Empreendimentos" de Imoveis: vitrine dos empreendimentos (capa,
// local, unidades cadastradas, se esta no site) com atalho para a ficha
// completa. Antes so dava para chegar num empreendimento filtrando o
// Catalogo de unidades - um empreendimento novo (ex: criado pelo book em
// PDF) sem unidades ficava "invisivel".
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, FileUp, Globe, MapPin, Search, LayoutGrid, Home } from "lucide-react";
import { API_BASE_URL } from "@/core/api/client";
import { useImoveisStore } from "../store/useImoveisStore";

export function EmpreendimentosTab() {
  const empreendimentos = useImoveisStore((state) => state.empreendimentos);
  const setEmpreendimentoFilter = useImoveisStore((state) => state.setEmpreendimentoFilter);
  const setActiveView = useImoveisStore((state) => state.setActiveView);
  const [busca, setBusca] = useState("");

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return empreendimentos;
    return empreendimentos.filter((e) =>
      [e.name, e.bairro, e.cidade].some((campo) => campo?.toLowerCase().includes(termo)),
    );
  }, [empreendimentos, busca]);

  function verUnidades(id: string) {
    setEmpreendimentoFilter(id);
    setActiveView("catalogo");
    window.history.replaceState(null, "", "/dashboard/imoveis?secao=catalogo");
  }

  return (
    <div className="px-6 py-5">
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar empreendimento, bairro ou cidade..."
            aria-label="Buscar empreendimento"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <p className="text-sm text-slate-500">
          {lista.length} {lista.length === 1 ? "empreendimento" : "empreendimentos"}
        </p>
        <Link
          href="/dashboard/imoveis/empreendimentos/book"
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <FileUp className="h-4 w-4" aria-hidden /> Cadastrar pelo book (PDF)
        </Link>
      </div>

      {lista.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white py-20 text-slate-400">
          <Building2 className="h-8 w-8" aria-hidden />
          <p className="text-sm">{busca ? "Nenhum empreendimento encontrado." : "Nenhum empreendimento cadastrado ainda."}</p>
        </div>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {lista.map((e) => {
            const capa = e.fotoCapaUrl ? `${API_BASE_URL}${e.fotoCapaUrl}` : null;
            const local = [e.bairro, e.cidade && e.uf ? `${e.cidade}/${e.uf}` : e.cidade].filter(Boolean).join(" · ");
            const unidades = e.quantidadeUnidades ?? 0;
            return (
              <li key={e.id} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                <Link href={`/dashboard/imoveis/empreendimentos/${e.id}`} className="block">
                  <div className="relative aspect-[16/10] bg-slate-100">
                    {capa ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={capa} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-1 text-slate-400">
                        <Building2 className="h-10 w-10" aria-hidden />
                        <span className="text-xs">Sem fotos ainda</span>
                      </div>
                    )}
                    <span
                      className={`absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        e.publicado ? "bg-emerald-50 text-emerald-700" : "bg-white/90 text-slate-600"
                      }`}
                    >
                      {e.publicado ? <Globe className="h-3.5 w-3.5" aria-hidden /> : null}
                      {e.publicado ? "Publicado" : "Em revisão"}
                    </span>
                  </div>
                  <div className="px-4 pt-4">
                    <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-700">{e.name}</h3>
                    {local && (
                      <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                        <MapPin className="h-3.5 w-3.5 flex-none" aria-hidden /> {local}
                      </p>
                    )}
                    <p className="mt-2 flex items-center gap-1 text-sm text-slate-600">
                      <Home className="h-3.5 w-3.5 flex-none" aria-hidden />
                      {unidades === 0
                        ? "Nenhuma unidade cadastrada"
                        : `${unidades} ${unidades === 1 ? "unidade cadastrada" : "unidades cadastradas"}`}
                      {e.totalUnidades ? <span className="text-slate-400"> de {e.totalUnidades}</span> : null}
                    </p>
                  </div>
                </Link>
                <div className="flex flex-wrap gap-2 px-4 pb-4 pt-3">
                  {unidades > 0 ? (
                    <button
                      type="button"
                      onClick={() => verUnidades(e.id)}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Ver unidades
                    </button>
                  ) : null}
                  <Link
                    href={`/dashboard/imoveis/empreendimentos/${e.id}/lote`}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> {unidades === 0 ? "Cadastrar unidades" : "Cadastro em lote"}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
