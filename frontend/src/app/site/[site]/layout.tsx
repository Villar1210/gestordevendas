// src/app/site/[site]/layout.tsx
// Casca da vitrine publica de cada empresa (tenant). Acessada por
// /site/<slug> (pre-visualizacao no dominio da plataforma) ou pelo
// dominio proprio da empresa (reescrito para ca pelo middleware).
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { resolverSite } from "@/features/site-publico/server-api";

type Params = { params: Promise<{ site: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { site } = await params;
  const info = await resolverSite(site);
  // URL absoluta para og:image (preview do link no WhatsApp/Facebook).
  const h = await headers();
  const host = (h.get("host") || "").toLowerCase().replace(/:\d+$/, "");
  const hostValido = /^[a-z0-9.-]{1,253}$/.test(host) && host.includes(".");
  return {
    metadataBase: hostValido ? new URL(`https://${host}`) : undefined,
    title: { default: `${info.nome} – Imóveis`, template: `%s | ${info.nome}` },
    description: `Imóveis à venda e para alugar com ${info.nome}.`,
  };
}

export default async function SiteLayout({ children, params }: Params & { children: React.ReactNode }) {
  const { site } = await params;
  const info = await resolverSite(site);
  const inicio = info.base || "/";

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <Link href={inicio} className="text-lg font-bold tracking-tight text-slate-900">
            {info.nome}
          </Link>
          <nav className="flex items-center gap-5 text-sm font-medium text-slate-600">
            <Link href={`${inicio === "/" ? "" : inicio}/#empreendimentos`} className="hidden hover:text-blue-700 sm:inline">
              Empreendimentos
            </Link>
            <Link href={`${inicio === "/" ? "" : inicio}/#imoveis`} className="hover:text-blue-700">
              Imóveis
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {new Date().getFullYear()} {info.nome}. Todos os direitos reservados.
          </p>
          <Link href={`${info.base}/privacidade`} className="hover:text-blue-700">
            Política de privacidade
          </Link>
        </div>
      </footer>
    </div>
  );
}
