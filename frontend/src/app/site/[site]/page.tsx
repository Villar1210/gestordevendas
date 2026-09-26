// src/app/site/[site]/page.tsx
// Pagina inicial da vitrine: busca, empreendimentos e imoveis publicados.
import { Home } from "lucide-react";
import {
  listarEmpreendimentos,
  listarImoveis,
  resolverSite,
} from "@/features/site-publico/server-api";
import { FiltrosImoveis } from "@/features/site-publico/components/FiltrosImoveis";
import { EmpreendimentoCardSite } from "@/features/site-publico/components/EmpreendimentoCardSite";
import { ImovelCardSite } from "@/features/site-publico/components/ImovelCardSite";
import { Paginacao } from "@/features/site-publico/components/Paginacao";
import { TIPOS } from "@/features/site-publico/format";

const PAGE_SIZE = 12;
// So estes parametros sao repassados para a API: o backend rejeita
// qualquer parametro desconhecido (ex: utm_source de anuncios).
const FILTROS = ["busca", "tipo", "quartosMin", "precoMax", "finalidade"] as const;

type Props = {
  params: Promise<{ site: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function valido(chave: (typeof FILTROS)[number], v: string): boolean {
  switch (chave) {
    case "quartosMin":
      return /^\d{1,2}$/.test(v) && Number(v) <= 10;
    case "precoMax":
      return /^\d{1,12}$/.test(v);
    case "tipo":
      return Object.hasOwn(TIPOS, v);
    case "finalidade":
      return v === "venda" || v === "aluguel";
    case "busca":
      return v.length <= 100;
  }
}

function primeiro(v: string | string[] | undefined): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s?.trim() ? s.trim() : undefined;
}

export default async function SiteInicio({ params, searchParams }: Props) {
  const { site } = await params;
  const sp = await searchParams;
  const info = await resolverSite(site);

  const valores: Record<string, string | undefined> = {};
  const query = new URLSearchParams();
  for (const chave of FILTROS) {
    const v = primeiro(sp[chave]);
    if (!v) continue;
    // Valores invalidos (link editado a mao) sao ignorados em vez de a API
    // responder 400 e a pagina inteira cair.
    if (!valido(chave, v)) continue;
    valores[chave] = v;
    query.set(chave, v);
  }
  const pagina = Math.min(1000, Math.max(1, Number.parseInt(primeiro(sp.page) ?? "1", 10) || 1));
  query.set("page", String(pagina));
  query.set("pageSize", String(PAGE_SIZE));

  const temFiltro = Object.keys(valores).length > 0;
  const [imoveis, empreendimentos] = await Promise.all([
    listarImoveis(info.slug, query),
    temFiltro || pagina > 1 ? Promise.resolve([]) : listarEmpreendimentos(info.slug),
  ]);

  const inicio = info.base || "/";
  const hrefPara = (p: number) => {
    const q = new URLSearchParams(valores as Record<string, string>);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return `${inicio}${s ? `?${s}` : ""}#imoveis`;
  };

  return (
    <>
      <section className="bg-gradient-to-br from-[#142f4b] to-[#0f74c5] px-4 pb-16 pt-12 text-white">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">Encontre o imóvel ideal para você</h1>
          <p className="mt-2 max-w-xl text-blue-100">
            Imóveis selecionados por {info.nome}. Fale com um corretor sem compromisso.
          </p>
          <div className="mt-8">
            <FiltrosImoveis action={inicio} valores={valores} />
          </div>
        </div>
      </section>

      {empreendimentos.length > 0 && (
        <section id="empreendimentos" className="mx-auto max-w-6xl scroll-mt-20 px-4 pt-12">
          <h2 className="text-2xl font-bold text-slate-900">Empreendimentos</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {empreendimentos.map((emp) => (
              <EmpreendimentoCardSite key={emp.id} emp={emp} base={info.base} />
            ))}
          </div>
        </section>
      )}

      <section id="imoveis" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-2xl font-bold text-slate-900">{temFiltro ? "Resultado da busca" : "Imóveis disponíveis"}</h2>
          <p className="text-sm text-slate-500">
            {imoveis.total} {imoveis.total === 1 ? "imóvel encontrado" : "imóveis encontrados"}
          </p>
        </div>

        {imoveis.itens.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
            <Home className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
            <p className="mt-3">
              {temFiltro ? "Nenhum imóvel com esses filtros. Tente ampliar a busca." : "Em breve novos imóveis por aqui."}
            </p>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {imoveis.itens.map((im) => (
              <ImovelCardSite key={im.id} imovel={im} base={info.base} />
            ))}
          </div>
        )}

        <Paginacao page={imoveis.page} total={imoveis.total} pageSize={imoveis.pageSize} hrefPara={hrefPara} />
      </section>
    </>
  );
}
