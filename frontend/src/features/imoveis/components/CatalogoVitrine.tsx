// src/features/imoveis/components/CatalogoVitrine.tsx
// Catalogo em modo "Vitrine": lista compacta das unidades a esquerda e, a
// direita, a previa da unidade escolhida no estilo de um site imobiliario
// (galeria, preco, caracteristicas, descricao). Em telas pequenas so a
// lista aparece e o clique abre o painel de detalhe que ja existia.
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Bath,
  Bed,
  Building2,
  Car,
  CheckCircle2,
  Globe,
  Home,
  ImageOff,
  Loader2,
  MapPin,
  Maximize2,
  PencilLine,
} from "lucide-react";
import { apiRequest, API_BASE_URL } from "@/core/api/client";
import { Imovel, useImoveisStore } from "../store/useImoveisStore";
import type { EmpreendimentoDetail } from "../hooks/useImoveisIntegration";
import { formatArea, getFinalidadeLabel, getStatusOption, getTipoLabel } from "../constants";
import { FotoLightbox, FotoLightboxItem } from "./FotoLightbox";

const LOTE_LISTA = 60;

const moeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

function precoDe(imovel: Imovel): string | null {
  if (imovel.price) return moeda.format(imovel.price);
  if (imovel.rentPrice) return `${moeda.format(imovel.rentPrice)}/mês`;
  return null;
}

function telaLarga(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
}

export function CatalogoVitrine({ imoveis }: { imoveis: Imovel[] }) {
  const openImovelDetailPanel = useImoveisStore((state) => state.openImovelDetailPanel);
  const empreendimentos = useImoveisStore((state) => state.empreendimentos);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [visiveis, setVisiveis] = useState(LOTE_LISTA);

  // Lista mudou (filtro): mantem a selecao se a unidade ainda esta nela,
  // senao seleciona a primeira.
  useEffect(() => {
    setVisiveis(LOTE_LISTA);
    setSelecionadoId((atual) => (atual && imoveis.some((i) => i.id === atual) ? atual : imoveis[0]?.id ?? null));
  }, [imoveis]);

  const selecionado = imoveis.find((i) => i.id === selecionadoId) ?? null;
  const nomeEmpreendimento = (id: string | null) => (id ? empreendimentos.find((e) => e.id === id)?.name ?? null : null);

  function escolher(imovel: Imovel) {
    if (telaLarga()) setSelecionadoId(imovel.id);
    else openImovelDetailPanel(imovel);
  }

  if (imoveis.length === 0) {
    return <p className="py-10 text-center text-sm text-slate-400">Nenhum imóvel encontrado.</p>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(300px,380px)_1fr]">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
        <ul aria-label="Unidades">
          {imoveis.slice(0, visiveis).map((imovel) => {
            const ativo = imovel.id === selecionadoId;
            const status = getStatusOption(imovel.status);
            const preco = precoDe(imovel);
            return (
              <li key={imovel.id} className="border-b border-slate-100 last:border-b-0">
                <button
                  type="button"
                  onClick={() => escolher(imovel)}
                  aria-current={ativo ? "true" : undefined}
                  className={`flex w-full gap-3 px-3 py-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${
                    ativo ? "bg-blue-50" : "hover:bg-slate-50"
                  }`}
                >
                  <Miniatura urls={[imovel.coverPhotoUrl, imovel.empreendimentoFotoUrl]} />
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-sm font-semibold ${ativo ? "text-blue-800" : "text-slate-800"}`}>
                      {imovel.title}
                    </span>
                    {nomeEmpreendimento(imovel.empreendimentoId) && (
                      <span className="block truncate text-xs text-slate-500">{nomeEmpreendimento(imovel.empreendimentoId)}</span>
                    )}
                    <span className="mt-1 flex items-center justify-between gap-2">
                      <span className={`text-sm font-bold ${preco ? "text-slate-900" : "font-normal text-slate-400"}`}>
                        {preco ?? "Preço a consultar"}
                      </span>
                      <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-medium ${status.badgeClassName}`}>
                        {status.label}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {imoveis.length > visiveis && (
          <div className="border-t border-slate-100 p-3 text-center">
            <button
              type="button"
              onClick={() => setVisiveis((v) => v + LOTE_LISTA)}
              className="rounded-lg border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Mostrar mais {Math.min(LOTE_LISTA, imoveis.length - visiveis)}
            </button>
            <p className="mt-1 text-xs text-slate-400">
              Mostrando {visiveis} de {imoveis.length}
            </p>
          </div>
        )}
      </div>

      <div className="hidden lg:block">
        {selecionado && (
          <PreviaImovel
            key={selecionado.id}
            imovel={selecionado}
            nomeEmpreendimento={nomeEmpreendimento(selecionado.empreendimentoId)}
            onAbrirFicha={() => openImovelDetailPanel(selecionado)}
          />
        )}
      </div>
    </div>
  );
}

// Cache simples entre selecoes: voltar a uma unidade ja vista nao busca de novo.
const cacheFotos = new Map<string, { fotos: FotoLightboxItem[]; doEmpreendimento: boolean }>();

function PreviaImovel({
  imovel,
  nomeEmpreendimento,
  onAbrirFicha,
}: {
  imovel: Imovel;
  nomeEmpreendimento: string | null;
  onAbrirFicha: () => void;
}) {
  const chave = `${imovel.id}:${imovel.updatedAt}`;
  const [galeria, setGaleria] = useState(cacheFotos.get(chave) ?? null);
  const [erro, setErro] = useState(false);
  const [ampliada, setAmpliada] = useState<number | null>(null);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    if (cacheFotos.has(chave)) return;
    (async () => {
      try {
        const completo = await apiRequest<Imovel>(`/imoveis/${imovel.id}`);
        let resultado = {
          fotos: (completo.photos ?? []).map((p) => ({ url: p.url })),
          doEmpreendimento: false,
        };
        // Unidade sem foto propria: mostra as do empreendimento (como no site).
        if (resultado.fotos.length === 0 && imovel.empreendimentoId) {
          const detalhe = await apiRequest<EmpreendimentoDetail>(`/empreendimentos/${imovel.empreendimentoId}`);
          resultado = { fotos: detalhe.photos.map((p) => ({ url: p.url })), doEmpreendimento: true };
        }
        cacheFotos.set(chave, resultado);
        if (montado.current) setGaleria(resultado);
      } catch {
        if (montado.current) setErro(true);
      }
    })();
    return () => {
      montado.current = false;
    };
  }, [chave, imovel.id, imovel.empreendimentoId]);

  const status = getStatusOption(imovel.status);
  const preco = precoDe(imovel);
  const local = [imovel.rua && `${imovel.rua}${imovel.numero ? `, ${imovel.numero}` : ""}`, imovel.bairro, imovel.cidade && `${imovel.cidade}${imovel.uf ? `/${imovel.uf}` : ""}`]
    .filter(Boolean)
    .join(" · ");
  const area = formatArea(imovel.area ?? imovel.areaTotal);

  const caracteristicas = useMemo(
    () =>
      [
        imovel.aceitaFinanciamento && "Aceita financiamento",
        imovel.aceitaPermuta && "Aceita permuta",
        imovel.exclusividade && "Exclusividade",
        imovel.disponivelApartirDe &&
          `Disponível a partir de ${new Intl.DateTimeFormat("pt-BR").format(new Date(imovel.disponivelApartirDe))}`,
        ...(imovel.tags ?? "")
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      ].filter((c): c is string => Boolean(c)),
    [imovel],
  );

  const fotos = galeria?.fotos ?? [];

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Galeria: 1 foto grande + ate 4 miniaturas; qualquer uma amplia. */}
      {galeria === null && !erro ? (
        <div className="flex aspect-[16/7] items-center justify-center bg-slate-100">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-label="Carregando fotos" />
        </div>
      ) : fotos.length === 0 ? (
        <div className="flex aspect-[16/7] flex-col items-center justify-center gap-1 bg-slate-100 text-slate-400">
          <ImageOff className="h-8 w-8" aria-hidden />
          <span className="text-sm">{erro ? "Não foi possível carregar as fotos" : "Sem fotos ainda"}</span>
        </div>
      ) : (
        <div className="relative grid aspect-[16/7] grid-cols-4 grid-rows-2 gap-1 bg-slate-100">
          {fotos.slice(0, 5).map((foto, i) => {
            const restantes = fotos.length - 5;
            return (
              <button
                key={`${foto.url}-${i}`}
                type="button"
                onClick={() => setAmpliada(i)}
                aria-label={`Ampliar foto ${i + 1} de ${fotos.length}`}
                className={`group relative cursor-zoom-in overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600 ${
                  i === 0
                    ? fotos.length === 1
                      ? "col-span-4 row-span-2"
                      : "col-span-2 row-span-2"
                    : fotos.length === 2
                      ? "col-span-2 row-span-2"
                      : fotos.length === 3
                        ? "col-span-2"
                        : ""
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${API_BASE_URL}${foto.url}`}
                  alt=""
                  onError={(ev) => (ev.currentTarget.style.visibility = "hidden")}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                />
                {i === 4 && restantes > 0 && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-semibold text-white">
                    +{restantes} fotos
                  </span>
                )}
              </button>
            );
          })}
          {galeria?.doEmpreendimento && (
            <span className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
              Fotos do empreendimento
            </span>
          )}
        </div>
      )}

      <div className="space-y-5 p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
              {getTipoLabel(imovel.tipo)} · {getFinalidadeLabel(imovel.finalidade)}
              {imovel.codigoInterno && (
                <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">Cód. {imovel.codigoInterno}</span>
              )}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-slate-900">{imovel.title}</h2>
            {local && (
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-500">
                <MapPin className="h-4 w-4 flex-none" aria-hidden /> {local}
              </p>
            )}
            {nomeEmpreendimento && imovel.empreendimentoId && (
              <Link
                href={`/dashboard/imoveis/empreendimentos/${imovel.empreendimentoId}`}
                className="mt-1 inline-flex items-center gap-1 text-sm text-blue-700 hover:underline"
              >
                <Building2 className="h-4 w-4" aria-hidden /> {nomeEmpreendimento}
              </Link>
            )}
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${preco ? "text-slate-900" : "text-base font-medium text-slate-400"}`}>
              {preco ?? "Preço a consultar"}
            </p>
            {(imovel.valorCondominio || imovel.iptu) && (
              <p className="mt-0.5 text-xs text-slate-500">
                {[imovel.valorCondominio && `Cond. ${moeda.format(imovel.valorCondominio)}`, imovel.iptu && `IPTU ${moeda.format(imovel.iptu)}`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
            <div className="mt-2 flex flex-wrap justify-end gap-1.5">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.badgeClassName}`}>{status.label}</span>
              {imovel.publicado && (
                <span className="flex items-center gap-1 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">
                  <Globe className="h-3 w-3" aria-hidden /> No site
                </span>
              )}
            </div>
          </div>
        </header>

        <dl className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 sm:grid-cols-4">
          <Caracteristica icone={Maximize2} rotulo="Área" valor={area} />
          <Caracteristica
            icone={Bed}
            rotulo="Quartos"
            valor={
              imovel.bedrooms != null
                ? `${imovel.bedrooms}${imovel.suites ? ` (${imovel.suites} suíte${imovel.suites > 1 ? "s" : ""})` : ""}`
                : null
            }
          />
          <Caracteristica icone={Bath} rotulo="Banheiros" valor={imovel.bathrooms != null ? String(imovel.bathrooms) : null} />
          <Caracteristica icone={Car} rotulo="Vagas" valor={imovel.parkingSpots != null ? String(imovel.parkingSpots) : null} />
        </dl>

        {imovel.description && (
          <section>
            <h3 className="mb-1 text-sm font-semibold text-slate-800">Descrição</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{imovel.description}</p>
          </section>
        )}

        {caracteristicas.length > 0 && (
          <section>
            <h3 className="mb-2 text-sm font-semibold text-slate-800">Diferenciais</h3>
            <ul className="flex flex-wrap gap-2">
              {caracteristicas.map((c) => (
                <li key={c} className="flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> {c}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onAbrirFicha}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
          >
            <PencilLine className="h-4 w-4" aria-hidden /> Abrir ficha / editar
          </button>
        </div>
      </div>

      {ampliada !== null && fotos.length > 0 && (
        <FotoLightbox fotos={fotos} indiceInicial={ampliada} onClose={() => setAmpliada(null)} />
      )}
    </article>
  );
}

function Caracteristica({
  icone: Icone,
  rotulo,
  valor,
}: {
  icone: typeof Bed;
  rotulo: string;
  valor: string | null;
}) {
  return (
    <div>
      <dt className="flex items-center gap-1 text-xs text-slate-500">
        <Icone className="h-3.5 w-3.5" aria-hidden /> {rotulo}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-slate-800">{valor ?? "—"}</dd>
    </div>
  );
}

// Capa da unidade; se o arquivo nao carregar, tenta a do empreendimento e,
// por fim, mostra o icone (mesma regra do card do Catalogo).
function Miniatura({ urls }: { urls: (string | null | undefined)[] }) {
  const [falhas, setFalhas] = useState(0);
  const candidatas = urls.filter((u, i, lista): u is string => Boolean(u) && lista.indexOf(u) === i);
  const url = candidatas[falhas];
  return (
    <span className="relative h-16 w-20 flex-none overflow-hidden rounded-lg bg-slate-100">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`${API_BASE_URL}${url}`}
          alt=""
          loading="lazy"
          onError={() => setFalhas((n) => n + 1)}
          className="h-full w-full object-cover"
        />
      ) : (
        <Home className="absolute left-1/2 top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 text-slate-300" aria-hidden />
      )}
    </span>
  );
}
