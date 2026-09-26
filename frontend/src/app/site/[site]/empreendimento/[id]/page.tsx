// src/app/site/[site]/empreendimento/[id]/page.tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Clock, MapPin, TrainFront } from "lucide-react";
import { listarImoveis, obterEmpreendimento, resolverSite } from "@/features/site-publico/server-api";
import { STATUS_OBRA, TIPOS, formatarPreco, localizacao, urlFoto } from "@/features/site-publico/format";
import { Galeria } from "@/features/site-publico/components/Galeria";
import { ImovelCardSite } from "@/features/site-publico/components/ImovelCardSite";
import { LeadForm } from "@/features/site-publico/components/LeadForm";

type Props = { params: Promise<{ site: string; id: string }> };

async function carregar(site: string, id: string) {
  const info = await resolverSite(site);
  const emp = await obterEmpreendimento(info.slug, id);
  if (!emp) notFound();
  return { info, emp };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { site, id } = await params;
  const { emp } = await carregar(site, id);
  const aPartir = formatarPreco(emp.precoMinimo);
  const descricao = [localizacao(emp.bairro, emp.cidade, emp.uf), aPartir ? `a partir de ${aPartir}` : null]
    .filter(Boolean)
    .join(" · ");
  const foto = urlFoto(emp.fotos[0]?.url ?? emp.fotoCapa);
  return {
    title: emp.nome,
    description: descricao,
    openGraph: { title: emp.nome, description: descricao, images: foto ? [foto] : undefined },
  };
}

function faixaPreco(min: number | null, max: number | null): string | null {
  const a = formatarPreco(min);
  const b = formatarPreco(max);
  if (a && b && a !== b) return `${a} a ${b}`;
  if (a) return `A partir de ${a}`;
  if (b) return `Até ${b}`;
  return null;
}

export default async function EmpreendimentoPage({ params }: Props) {
  const { site, id } = await params;
  const { info, emp } = await carregar(site, id);

  const q = new URLSearchParams({ empreendimentoId: emp.id, pageSize: "24" });
  const unidades = await listarImoveis(info.slug, q);

  const fotos = emp.fotos.map((f) => urlFoto(f.url)).filter((f): f is string => Boolean(f));
  const preco = faixaPreco(emp.precoMinimo, emp.precoMaximo);
  const status = emp.statusObra ? STATUS_OBRA[emp.statusObra] ?? emp.statusObra : null;
  const endereco = [emp.endereco, localizacao(emp.bairro, emp.cidade, emp.uf)].filter(Boolean).join(" – ");

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Link href={`${info.base || "/"}#empreendimentos`} className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-blue-700">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Ver todos os empreendimentos
      </Link>

      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <Galeria fotos={fotos} alt={emp.nome} />

          <div className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              {status && <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">{status}</span>}
              {emp.tipo && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{TIPOS[emp.tipo] ?? emp.tipo}</span>}
            </div>
            <h1 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{emp.nome}</h1>
            {endereco && (
              <p className="mt-2 flex items-start gap-1 text-slate-600">
                <MapPin className="mt-0.5 h-4 w-4 flex-none" aria-hidden /> {endereco}
              </p>
            )}
            {emp.construtora && <p className="mt-1 text-sm text-slate-500">Construtora: {emp.construtora}</p>}
            {preco && <p className="mt-4 text-2xl font-bold text-slate-900">{preco}</p>}
          </div>

          <ul className="mt-4 flex flex-wrap gap-2 text-sm text-slate-700">
            {emp.totalUnidades ? <li className="rounded-xl border border-slate-200 bg-white px-3 py-2">{emp.totalUnidades} unidades</li> : null}
            {emp.vagas ? <li className="rounded-xl border border-slate-200 bg-white px-3 py-2">{emp.vagas} vagas</li> : null}
            {emp.proximoMetro && (
              <li className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <TrainFront className="h-4 w-4 text-blue-700" aria-hidden /> Próximo ao metrô
              </li>
            )}
          </ul>

          {emp.descricao && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900">Sobre o empreendimento</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{emp.descricao}</p>
            </section>
          )}

          {emp.tipologias.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900">Plantas</h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                {emp.tipologias.map((t) => (
                  <li key={t.nome} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                    <p className="font-medium text-slate-900">{t.nome}</p>
                    <p className="text-sm text-slate-500">
                      {[t.dormitorios ? `${t.dormitorios} ${t.dormitorios === 1 ? "dormitório" : "dormitórios"}` : null, t.areaPrivativa ? `${t.areaPrivativa} m²` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {[
            { titulo: "Lazer", itens: emp.itensLazer },
            { titulo: "Diferenciais", itens: emp.diferenciais },
          ].map(
            (bloco) =>
              bloco.itens.length > 0 && (
                <section key={bloco.titulo} className="mt-8">
                  <h2 className="text-lg font-semibold text-slate-900">{bloco.titulo}</h2>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                    {bloco.itens.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-slate-700">
                        <Check className="h-4 w-4 flex-none text-emerald-600" aria-hidden /> {item}
                      </li>
                    ))}
                  </ul>
                </section>
              ),
          )}

          {(emp.plantaoEndereco || emp.plantaoHorario) && (
            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="text-lg font-semibold text-slate-900">Visite o plantão de vendas</h2>
              {emp.plantaoEndereco && (
                <p className="mt-2 flex items-start gap-2 text-slate-700">
                  <MapPin className="mt-0.5 h-4 w-4 flex-none text-blue-700" aria-hidden /> {emp.plantaoEndereco}
                </p>
              )}
              {emp.plantaoHorario && (
                <p className="mt-1 flex items-start gap-2 text-slate-700">
                  <Clock className="mt-0.5 h-4 w-4 flex-none text-blue-700" aria-hidden /> {emp.plantaoHorario}
                </p>
              )}
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <LeadForm
            slug={info.slug}
            base={info.base}
            empreendimentoId={emp.id}
            titulo="Quero saber mais"
            mensagemInicial={`Olá! Quero mais informações sobre o ${emp.nome}.`}
          />
        </aside>
      </div>

      {unidades.itens.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold text-slate-900">Unidades disponíveis</h2>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {unidades.itens.map((im) => (
              <ImovelCardSite key={im.id} imovel={im} base={info.base} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
