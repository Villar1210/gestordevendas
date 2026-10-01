// src/features/imoveis/components/EmpreendimentoDestaque.tsx
// Bloco do empreendimento filtrado no Catalogo: fotos (ampliam ao clicar),
// endereco, ficha tecnica e atalhos. Sem ele, um empreendimento com fotos
// mas sem unidades (ex: recem-importado pelo book) aparecia so como
// "Nenhum imovel encontrado".
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Building2, Globe, LayoutGrid, Loader2, MapPin, PencilLine } from "lucide-react";
import { apiRequest, API_BASE_URL } from "@/core/api/client";
import type { EmpreendimentoDetail } from "../hooks/useImoveisIntegration";
import { EMPREENDIMENTO_PHOTO_CATEGORIA_OPTIONS } from "../constants";
import { FotoLightbox, FotoLightboxItem } from "./FotoLightbox";

const MINIATURAS = 6;

export function EmpreendimentoDestaque({
  empreendimentoId,
  unidadesNaLista,
}: {
  empreendimentoId: string;
  unidadesNaLista: number;
}) {
  const [detalhe, setDetalhe] = useState<EmpreendimentoDetail | null>(null);
  const [erro, setErro] = useState(false);
  const [ampliada, setAmpliada] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;
    setDetalhe(null);
    setErro(false);
    apiRequest<EmpreendimentoDetail>(`/empreendimentos/${empreendimentoId}`)
      .then((d) => ativo && setDetalhe(d))
      .catch(() => ativo && setErro(true));
    return () => {
      ativo = false;
    };
  }, [empreendimentoId]);

  if (erro) return null;
  if (!detalhe) {
    return (
      <div className="mx-6 mt-3 flex h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-label="Carregando empreendimento" />
      </div>
    );
  }

  const { empreendimento: e, photos, unidadesCadastradas } = detalhe;
  // Mesma ordem da ficha do empreendimento: por categoria, depois a ordem salva.
  const fotos: FotoLightboxItem[] = EMPREENDIMENTO_PHOTO_CATEGORIA_OPTIONS.flatMap((c) =>
    photos
      .filter((p) => p.categoria === c.value)
      .sort((a, b) => a.order - b.order)
      .map((p) => ({ url: p.url, legenda: c.label })),
  );
  const endereco = [
    e.rua && `${e.rua}${e.numero ? `, ${e.numero}` : ""}`,
    e.bairro,
    e.cidade && `${e.cidade}${e.uf ? `/${e.uf}` : ""}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const ficha = [
    e.totalUnidades != null && `${e.totalUnidades} unidades`,
    e.numeroTorres != null && `${e.numeroTorres} ${e.numeroTorres === 1 ? "torre" : "torres"}`,
    e.vagas != null && `${e.vagas} vagas`,
    e.areaTerreno != null && `Terreno ${e.areaTerreno.toLocaleString("pt-BR")} m²`,
  ].filter((x): x is string => Boolean(x));
  const semUnidades = unidadesCadastradas === 0;

  return (
    <section
      aria-label={`Empreendimento ${e.name}`}
      className="mx-6 mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      <div className="grid gap-0 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Fotos: capa grande + miniaturas; todas ampliam ao clicar. */}
        {fotos.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center gap-1 bg-slate-100 text-slate-400">
            <Building2 className="h-8 w-8" aria-hidden />
            <span className="text-sm">Sem fotos do empreendimento</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1 bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setAmpliada(0)}
              aria-label={`Ampliar foto 1 de ${fotos.length}`}
              className="group relative aspect-[16/9] cursor-zoom-in overflow-hidden rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`${API_BASE_URL}${fotos[0].url}`}
                alt=""
                className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
              />
              <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
                {fotos.length} {fotos.length === 1 ? "foto" : "fotos"}
              </span>
            </button>
            {fotos.length > 1 && (
              <div className="grid grid-cols-6 gap-1">
                {fotos.slice(1, MINIATURAS + 1).map((foto, i) => {
                  const indice = i + 1;
                  const restantes = fotos.length - (MINIATURAS + 1);
                  const ultima = i === MINIATURAS - 1 && restantes > 0;
                  return (
                    <button
                      key={`${foto.url}-${indice}`}
                      type="button"
                      onClick={() => setAmpliada(indice)}
                      aria-label={`Ampliar foto ${indice + 1} de ${fotos.length}`}
                      className="relative aspect-square cursor-zoom-in overflow-hidden rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`${API_BASE_URL}${foto.url}`} alt="" loading="lazy" className="h-full w-full object-cover" />
                      {ultima && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-xs font-semibold text-white">
                          +{restantes}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4 p-5">
          <div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                e.publicado ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
              }`}
            >
              {e.publicado && <Globe className="h-3 w-3" aria-hidden />}
              {e.publicado ? "Publicado no site" : "Em revisão"}
            </span>
            <h2 className="mt-2 text-xl font-semibold text-slate-900">{e.name}</h2>
            {endereco && (
              <p className="mt-1 flex items-start gap-1 text-sm text-slate-500">
                <MapPin className="mt-0.5 h-4 w-4 flex-none" aria-hidden /> {endereco}
              </p>
            )}
          </div>

          {ficha.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {ficha.map((item) => (
                <li key={item} className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                  {item}
                </li>
              ))}
            </ul>
          )}

          {e.itensLazer.length > 0 && (
            <p className="text-sm text-slate-600">
              <span className="font-medium text-slate-800">Lazer:</span> {e.itensLazer.join(", ")}
            </p>
          )}

          {e.description && <p className="line-clamp-3 text-sm text-slate-600">{e.description}</p>}

          {semUnidades ? (
            <p role="status" className="rounded-lg bg-blue-50 px-3 py-2 text-sm text-blue-800">
              Este empreendimento ainda não tem unidades cadastradas. Cadastre as unidades para elas aparecerem no
              catálogo e no espelho de vendas.
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              {unidadesCadastradas} {unidadesCadastradas === 1 ? "unidade cadastrada" : "unidades cadastradas"}
              {unidadesNaLista !== unidadesCadastradas && ` · ${unidadesNaLista} com os filtros atuais`}
            </p>
          )}

          <div className="mt-auto flex flex-wrap gap-2">
            <Link
              href={`/dashboard/imoveis/empreendimentos/${e.id}/lote`}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium ${
                semUnidades
                  ? "bg-blue-700 text-white hover:bg-blue-800"
                  : "border border-slate-200 text-slate-700 hover:bg-slate-50"
              }`}
            >
              <LayoutGrid className="h-4 w-4" aria-hidden /> {semUnidades ? "Cadastrar unidades" : "Cadastro em lote"}
            </Link>
            <Link
              href={`/dashboard/imoveis/empreendimentos/${e.id}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              <PencilLine className="h-4 w-4" aria-hidden /> Ficha e fotos
            </Link>
          </div>
        </div>
      </div>

      {ampliada !== null && (
        <FotoLightbox fotos={fotos} indiceInicial={ampliada} onClose={() => setAmpliada(null)} />
      )}
    </section>
  );
}
