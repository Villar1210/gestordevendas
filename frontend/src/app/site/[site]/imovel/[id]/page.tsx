// src/app/site/[site]/imovel/[id]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Bath, BedDouble, Building2, Car, Check, MapPin, Maximize2, Video } from "lucide-react";
import { obterImovel, resolverSite } from "@/features/site-publico/server-api";
import { TIPOS, formatarArea, formatarPreco, localizacao, urlFoto } from "@/features/site-publico/format";
import { Galeria } from "@/features/site-publico/components/Galeria";
import { LeadForm } from "@/features/site-publico/components/LeadForm";

type Props = { params: Promise<{ site: string; id: string }> };

async function carregar(site: string, id: string) {
  const info = await resolverSite(site);
  const imovel = await obterImovel(info.slug, id);
  if (!imovel) notFound();
  return { info, imovel };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { site, id } = await params;
  const { imovel } = await carregar(site, id);
  const preco = formatarPreco(imovel.preco) ?? formatarPreco(imovel.precoAluguel);
  const local = localizacao(imovel.bairro, imovel.cidade, imovel.uf);
  const descricao = [TIPOS[imovel.tipo] ?? imovel.tipo, local, preco].filter(Boolean).join(" · ");
  const foto = urlFoto(imovel.fotos[0] ?? imovel.fotoCapa);
  return {
    title: imovel.titulo,
    description: descricao,
    openGraph: { title: imovel.titulo, description: descricao, images: foto ? [foto] : undefined },
  };
}

function linkSeguro(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

export default async function ImovelPage({ params }: Props) {
  const { site, id } = await params;
  const { info, imovel } = await carregar(site, id);

  const fotos = imovel.fotos.map(urlFoto).filter((f): f is string => Boolean(f));
  const preco = formatarPreco(imovel.preco);
  const aluguel = formatarPreco(imovel.precoAluguel);
  const local = localizacao(imovel.bairro, imovel.cidade, imovel.uf);
  const tour = linkSeguro(imovel.linkTourVirtual);
  const mapa =
    imovel.latitude !== null && imovel.longitude !== null
      ? `https://www.google.com/maps/search/?api=1&query=${imovel.latitude},${imovel.longitude}`
      : null;

  const caracteristicas = [
    imovel.area ? { icone: Maximize2, texto: `${formatarArea(imovel.area)} m² úteis` } : null,
    imovel.areaTotal ? { icone: Maximize2, texto: `${formatarArea(imovel.areaTotal)} m² totais` } : null,
    imovel.quartos ? { icone: BedDouble, texto: `${imovel.quartos} ${imovel.quartos === 1 ? "quarto" : "quartos"}` } : null,
    imovel.suites ? { icone: BedDouble, texto: `${imovel.suites} ${imovel.suites === 1 ? "suíte" : "suítes"}` } : null,
    imovel.banheiros ? { icone: Bath, texto: `${imovel.banheiros} ${imovel.banheiros === 1 ? "banheiro" : "banheiros"}` } : null,
    imovel.vagas ? { icone: Car, texto: `${imovel.vagas} ${imovel.vagas === 1 ? "vaga" : "vagas"}` } : null,
  ].filter((c): c is { icone: typeof Maximize2; texto: string } => c !== null);

  const custos = [
    imovel.valorCondominio ? `Condomínio ${formatarPreco(imovel.valorCondominio)}` : null,
    imovel.iptu ? `IPTU ${formatarPreco(imovel.iptu)}` : null,
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href={`${info.base || "/"}#imoveis`} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-blue-700">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Ver todos os imóveis
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <Galeria fotos={fotos} alt={imovel.titulo} />

          <div className="mt-6">
            <p className="text-sm font-medium uppercase tracking-wide text-blue-700">{TIPOS[imovel.tipo] ?? imovel.tipo}</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900 sm:text-3xl">{imovel.titulo}</h1>
            {local && (
              <p className="mt-2 flex items-center gap-1 text-slate-600">
                <MapPin className="h-4 w-4 flex-none" aria-hidden /> {local}
              </p>
            )}
            {imovel.empreendimentoId && imovel.empreendimentoNome && (
              <Link
                href={`${info.base}/empreendimento/${imovel.empreendimentoId}`}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline"
              >
                <Building2 className="h-4 w-4" aria-hidden /> {imovel.empreendimentoNome}
              </Link>
            )}
          </div>

          <div className="mt-6 flex flex-wrap gap-x-8 gap-y-2">
            {preco && (
              <div>
                <p className="text-xs uppercase text-slate-500">Venda</p>
                <p className="text-2xl font-bold text-slate-900">{preco}</p>
              </div>
            )}
            {aluguel && (
              <div>
                <p className="text-xs uppercase text-slate-500">Aluguel</p>
                <p className="text-2xl font-bold text-slate-900">
                  {aluguel}
                  <span className="text-base font-normal text-slate-500">/mês</span>
                </p>
              </div>
            )}
            {!preco && !aluguel && <p className="text-lg font-semibold text-slate-700">Consulte o valor</p>}
          </div>
          {custos.length > 0 && <p className="mt-2 text-sm text-slate-500">{custos.join(" · ")}</p>}

          {caracteristicas.length > 0 && (
            <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {caracteristicas.map(({ icone: Icone, texto }) => (
                <li key={texto} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700">
                  <Icone className="h-4 w-4 flex-none text-blue-700" aria-hidden /> {texto}
                </li>
              ))}
            </ul>
          )}

          {(imovel.aceitaFinanciamento || imovel.aceitaPermuta) && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {imovel.aceitaFinanciamento && (
                <li className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                  <Check className="h-4 w-4" aria-hidden /> Aceita financiamento
                </li>
              )}
              {imovel.aceitaPermuta && (
                <li className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700">
                  <Check className="h-4 w-4" aria-hidden /> Aceita permuta
                </li>
              )}
            </ul>
          )}

          {imovel.descricao && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900">Sobre o imóvel</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{imovel.descricao}</p>
            </section>
          )}

          {(tour || mapa) && (
            <div className="mt-6 flex flex-wrap gap-3">
              {tour && (
                <a href={tour} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-blue-600 hover:text-blue-700">
                  <Video className="h-4 w-4" aria-hidden /> Tour virtual
                </a>
              )}
              {mapa && (
                <a href={mapa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:border-blue-600 hover:text-blue-700">
                  <MapPin className="h-4 w-4" aria-hidden /> Ver região no mapa
                </a>
              )}
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <LeadForm
            slug={info.slug}
            base={info.base}
            imovelId={imovel.id}
            mensagemInicial={`Olá! Tenho interesse no imóvel "${imovel.titulo}".`}
          />
        </aside>
      </div>
    </div>
  );
}
