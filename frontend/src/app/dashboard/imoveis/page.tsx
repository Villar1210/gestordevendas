// src/app/dashboard/imoveis/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Plus, LayoutGrid, ClipboardCheck, Globe } from "lucide-react";
import { apiRequest } from "@/core/api/client";
import { useImoveisStore } from "@/features/imoveis/store/useImoveisStore";
import { useImoveisIntegration } from "@/features/imoveis/hooks/useImoveisIntegration";
import { ImoveisFilters } from "@/features/imoveis/components/ImoveisFilters";
import { ImovelCard } from "@/features/imoveis/components/ImovelCard";
import { ImovelListTable } from "@/features/imoveis/components/ImovelListTable";
import { ImovelFormModal } from "@/features/imoveis/components/ImovelFormModal";
import { EmpreendimentoFormModal } from "@/features/imoveis/components/EmpreendimentoFormModal";
import { ImovelDetailPanel } from "@/features/imoveis/components/ImovelDetailPanel";
import { EspelhoDeVendas } from "@/features/imoveis/components/EspelhoDeVendas";
import { ProprietariosTab } from "@/features/imoveis/components/ProprietariosTab";
import { ContratosTab } from "@/features/imoveis/components/ContratosTab";
import { FinanceiroTab } from "@/features/imoveis/components/FinanceiroTab";
import { InquilinosTab } from "@/features/imoveis/components/InquilinosTab";
import { EmpreendimentosTab } from "@/features/imoveis/components/EmpreendimentosTab";
import { CatalogoVitrine } from "@/features/imoveis/components/CatalogoVitrine";
import { IMOVEIS_SECOES } from "@/features/imoveis/constants";

// Abre a secao pedida no link do menu lateral (?secao=<id>). Componente
// separado + Suspense porque useSearchParams exige isso no build; reage
// tambem a cliques no submenu com a pagina ja aberta (so a query muda).
function SincronizarSecaoPelaUrl() {
  const secao = useSearchParams().get("secao");
  const setActiveView = useImoveisStore((state) => state.setActiveView);
  useEffect(() => {
    const valida = IMOVEIS_SECOES.find((s) => s.id === secao);
    if (valida) setActiveView(valida.id);
  }, [secao, setActiveView]);
  return null;
}

// Cards desenhados por vez: com centenas de unidades, desenhar tudo de uma
// vez deixa a tela lenta (principalmente no celular).
const LOTE_CARDS = 48;

export default function ImoveisDashboardPage() {
  const imoveis = useImoveisStore((state) => state.imoveis);
  const isLoading = useImoveisStore((state) => state.isLoading);
  const activeView = useImoveisStore((state) => state.activeView);
  const catalogLayout = useImoveisStore((state) => state.catalogLayout);
  const setCatalogLayout = useImoveisStore((state) => state.setCatalogLayout);
  const busca = useImoveisStore((state) => state.busca);
  const finalidadeFilter = useImoveisStore((state) => state.finalidadeFilter);
  const statusFilter = useImoveisStore((state) => state.statusFilter);
  const empreendimentoFilter = useImoveisStore((state) => state.empreendimentoFilter);
  const setEmpreendimentoFilter = useImoveisStore((state) => state.setEmpreendimentoFilter);
  const openImovelFormModal = useImoveisStore((state) => state.openImovelFormModal);
  const empreendimentos = useImoveisStore((state) => state.empreendimentos);
  const openEmpreendimentoFormModal = useImoveisStore(
    (state) => state.openEmpreendimentoFormModal,
  );

  const { loadImoveis, loadEmpreendimentos, handlePublicarUnidadesNoSite } = useImoveisIntegration();
  const [visiveis, setVisiveis] = useState(LOTE_CARDS);
  const [publicando, setPublicando] = useState(false);
  const [avisoSite, setAvisoSite] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const secaoAtual = IMOVEIS_SECOES.find((s) => s.id === activeView);
  const hasCheckedRole = useRef(false);

  const [tipoFilter, setTipoFilter] = useState<string>("all");
  const [bedroomsFilter, setBedroomsFilter] = useState<string>("all");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");

  useEffect(() => {
    loadEmpreendimentos();
    if (!hasCheckedRole.current) {
      hasCheckedRole.current = true;
      apiRequest<{ role: string }>("/auth/me")
        .then((me) => setRole(me.role))
        .catch(() => setRole(null));
    }
    const params = new URLSearchParams(window.location.search);
    const empreendimentoIdParam = params.get("empreendimentoId");
    if (empreendimentoIdParam) {
      setEmpreendimentoFilter(empreendimentoIdParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadImoveis({
      busca,
      finalidade: finalidadeFilter,
      status: statusFilter,
      empreendimentoId: empreendimentoFilter,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca, finalidadeFilter, statusFilter, empreendimentoFilter]);

  const filteredImoveis = useMemo(() => {
    return imoveis.filter((imovel) => {
      if (tipoFilter !== "all" && imovel.tipo !== tipoFilter) return false;
      if (bedroomsFilter !== "all") {
        const min = parseInt(bedroomsFilter, 10);
        if ((imovel.bedrooms ?? 0) < min) return false;
      }
      if (minPrice !== "") {
        const min = parseFloat(minPrice);
        if (!isNaN(min) && (imovel.price ?? imovel.rentPrice ?? 0) < min) return false;
      }
      if (maxPrice !== "") {
        const max = parseFloat(maxPrice);
        if (!isNaN(max) && (imovel.price ?? imovel.rentPrice ?? 0) > max) return false;
      }
      return true;
    });
  }, [imoveis, tipoFilter, bedroomsFilter, minPrice, maxPrice]);

  // Filtro mudou: volta a mostrar so o primeiro lote.
  useEffect(() => {
    setVisiveis(LOTE_CARDS);
  }, [imoveis, tipoFilter, bedroomsFilter, minPrice, maxPrice]);

  useEffect(() => {
    setAvisoSite(null);
  }, [empreendimentoFilter]);

  // A acao em massa vale para TODAS as unidades do empreendimento. Com outro
  // filtro ativo, a lista carregada e so uma parte - os numeros mostrados
  // (e a pergunta de confirmacao) ficariam errados.
  const outrosFiltrosAtivos = busca.trim() !== "" || finalidadeFilter !== "all" || statusFilter !== "all";
  const noSite = imoveis.filter((i) => i.publicado).length;
  const nomeEmpreendimentoFiltrado =
    empreendimentoFilter !== "all"
      ? empreendimentos.find((e) => e.id === empreendimentoFilter)?.name ?? "este empreendimento"
      : null;

  async function alternarSiteEmMassa(publicar: boolean) {
    if (empreendimentoFilter === "all") return;
    const pergunta = publicar
      ? `Publicar no site TODAS as ${imoveis.length} unidades de ${nomeEmpreendimentoFiltrado}?\n\nSó as que estiverem "Disponível" aparecem para o público.`
      : `Retirar do site todas as unidades de ${nomeEmpreendimentoFiltrado}?`;
    if (!window.confirm(pergunta)) return;
    setPublicando(true);
    const atualizadas = await handlePublicarUnidadesNoSite(empreendimentoFilter, publicar);
    setPublicando(false);
    if (atualizadas === null) return;
    await loadImoveis({
      busca,
      finalidade: finalidadeFilter,
      status: statusFilter,
      empreendimentoId: empreendimentoFilter,
    });
    const u = atualizadas === 1 ? "unidade" : "unidades";
    setAvisoSite(
      atualizadas === 0
        ? "Nenhuma unidade precisou ser alterada."
        : publicar
          ? `${atualizadas} ${u} ${atualizadas === 1 ? "publicada" : "publicadas"} no site. Só as disponíveis aparecem para o público.`
          : `${atualizadas} ${u} ${atualizadas === 1 ? "retirada" : "retiradas"} do site.`,
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Suspense fallback={null}>
        <SincronizarSecaoPelaUrl />
      </Suspense>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <h1 className="text-lg font-semibold text-slate-800">
            Imóveis
            <span className="font-normal text-slate-400"> / </span>
            <span className="font-medium text-slate-600">{secaoAtual?.label ?? "Catálogo"}</span>
          </h1>
        </div>

        {(activeView === "catalogo" || activeView === "espelho" || activeView === "empreendimentos") && (
          <div className="flex items-center gap-2">
            <button
              onClick={openEmpreendimentoFormModal}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-4 w-4" /> Novo Empreendimento
            </button>
            <button
              onClick={openImovelFormModal}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800"
            >
              <Plus className="h-4 w-4" /> Novo Imóvel
            </button>
          </div>
        )}
      </header>

      {activeView === "catalogo" ? (
        <>
          <ImoveisFilters
            tipoFilter={tipoFilter}
            setTipoFilter={setTipoFilter}
            bedroomsFilter={bedroomsFilter}
            setBedroomsFilter={setBedroomsFilter}
            minPrice={minPrice}
            setMinPrice={setMinPrice}
            maxPrice={maxPrice}
            setMaxPrice={setMaxPrice}
          />

          {empreendimentoFilter !== "all" && (
            <div className="flex flex-wrap items-center gap-2 px-6 pt-3">
              <Link
                href={`/dashboard/imoveis/empreendimentos/${empreendimentoFilter}/lote`}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <LayoutGrid className="h-4 w-4" /> Cadastro em Lote
              </Link>
              <Link
                href={`/dashboard/imoveis/empreendimentos/${empreendimentoFilter}`}
                className="flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                <ClipboardCheck className="h-4 w-4" /> Revisão e Publicação
              </Link>
              {role === "Administrador" && imoveis.length > 0 && outrosFiltrosAtivos && (
                <p className="flex items-center gap-1.5 text-sm text-slate-500">
                  <Globe className="h-4 w-4" aria-hidden /> Para publicar todas no site, limpe os outros filtros.
                </p>
              )}
              {role === "Administrador" && imoveis.length > 0 && !outrosFiltrosAtivos && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm text-sky-800">
                  <Globe className="h-4 w-4" aria-hidden />
                  <span>
                    {noSite} de {imoveis.length} no site
                  </span>
                  {noSite < imoveis.length && (
                    <button
                      onClick={() => alternarSiteEmMassa(true)}
                      disabled={publicando}
                      className="rounded-md bg-blue-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                    >
                      Publicar todas
                    </button>
                  )}
                  {noSite > 0 && (
                    <button
                      onClick={() => alternarSiteEmMassa(false)}
                      disabled={publicando}
                      className="rounded-md border border-sky-300 bg-white px-2.5 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100 disabled:opacity-60"
                    >
                      Retirar todas
                    </button>
                  )}
                  {publicando && <Loader2 className="h-4 w-4 animate-spin" aria-label="Salvando" />}
                </div>
              )}
              {avisoSite && (
                <p role="status" className="text-sm text-emerald-700">
                  {avisoSite}
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between px-6 pt-3 pb-1">
            <p className="text-sm text-slate-500" aria-live="polite">
              {isLoading
                ? "Carregando..."
                : `${filteredImoveis.length} ${filteredImoveis.length !== 1 ? "imóveis encontrados" : "imóvel encontrado"}`}
            </p>
            <div className="flex rounded-lg border border-slate-200 p-0.5" role="group" aria-label="Forma de exibição">
              <button
                onClick={() => setCatalogLayout("vitrine")}
                aria-pressed={catalogLayout === "vitrine"}
                title="Lista à esquerda e prévia da unidade à direita"
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  catalogLayout === "vitrine"
                    ? "bg-blue-700 text-white"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Vitrine
              </button>
              <button
                onClick={() => setCatalogLayout("cards")}
                aria-pressed={catalogLayout === "cards"}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  catalogLayout === "cards"
                    ? "bg-blue-700 text-white"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Cards
              </button>
              <button
                onClick={() => setCatalogLayout("lista")}
                aria-pressed={catalogLayout === "lista"}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                  catalogLayout === "lista"
                    ? "bg-blue-700 text-white"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Lista
              </button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
              <p className="text-sm">Carregando imóveis...</p>
            </div>
          ) : (
            <div className="px-6 py-4">
              {catalogLayout === "vitrine" ? (
                <CatalogoVitrine imoveis={filteredImoveis} />
              ) : catalogLayout === "cards" ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredImoveis.slice(0, visiveis).map((imovel) => (
                    <ImovelCard key={imovel.id} imovel={imovel} />
                  ))}
                  {filteredImoveis.length > visiveis && (
                    <div className="col-span-full flex flex-col items-center gap-1 py-4">
                      <button
                        onClick={() => setVisiveis((v) => v + LOTE_CARDS)}
                        className="rounded-lg border border-slate-200 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Mostrar mais {Math.min(LOTE_CARDS, filteredImoveis.length - visiveis)}
                      </button>
                      <p className="text-xs text-slate-400">
                        Mostrando {visiveis} de {filteredImoveis.length}. Para achar uma unidade, use a busca ou filtre por
                        empreendimento.
                      </p>
                    </div>
                  )}
                  {filteredImoveis.length === 0 && (
                    <p className="col-span-full py-10 text-center text-sm text-slate-400">
                      Nenhum imóvel encontrado.
                    </p>
                  )}
                </div>
              ) : (
                <ImovelListTable imoveis={filteredImoveis} />
              )}
            </div>
          )}
        </>
      ) : activeView === "empreendimentos" ? (
        <EmpreendimentosTab />
      ) : activeView === "espelho" ? (
        <EspelhoDeVendas />
      ) : activeView === "proprietarios" ? (
        <ProprietariosTab />
      ) : activeView === "contratos" ? (
        <ContratosTab />
      ) : activeView === "inquilinos" ? (
        <InquilinosTab />
      ) : (
        <FinanceiroTab />
      )}

      <ImovelFormModal />
      <EmpreendimentoFormModal />
      <ImovelDetailPanel />
    </div>
  );
}
