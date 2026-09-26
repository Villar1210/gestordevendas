// src/middleware.ts
// Dominio proprio da empresa (ex: direcional.ivillar.com.br): toda
// requisicao que chega por um host que NAO e o da plataforma e reescrita
// internamente para a vitrine publica /site/<host>/... - o visitante
// continua vendo a URL limpa (direcional.ivillar.com.br/imovel/123).
import { NextResponse, type NextRequest } from "next/server";

// Mesmo nome de server-api.ts (CABECALHO_DOMINIO_PROPRIO); repetido aqui
// para o middleware (runtime edge) nao importar next/headers.
const CABECALHO_DOMINIO_PROPRIO = "x-vitrine-dominio-proprio";

const HOSTS_PLATAFORMA = new Set(
  ["gestordevendas.ivillar.com.br", "localhost", "127.0.0.1", ...(process.env.NEXT_PUBLIC_PLATFORM_HOSTS ?? "").split(",")]
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean),
);

// Hostname valido: letras, numeros, hifen e pontos (sem porta).
const HOST_VALIDO = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/;

export function middleware(req: NextRequest) {
  // So o Host (definido pelo nginx). X-Forwarded-Host pode vir do visitante.
  const host = (req.headers.get("host") || "").trim().toLowerCase().replace(/:\d+$/, "");

  const cabecalhos = new Headers(req.headers);
  // Nunca aceitar essa marca vinda de fora.
  cabecalhos.delete(CABECALHO_DOMINIO_PROPRIO);

  if (!host || HOSTS_PLATAFORMA.has(host) || !HOST_VALIDO.test(host)) {
    return NextResponse.next({ request: { headers: cabecalhos } });
  }

  // Tudo no dominio da empresa vira vitrine - inclusive /login, /dashboard
  // (viram 404) e /site/<outra-empresa> (nao mostra a vitrine de terceiros).
  const { pathname } = req.nextUrl;
  const url = req.nextUrl.clone();
  url.pathname = `/site/${host}${pathname === "/" ? "" : pathname}`;
  cabecalhos.set(CABECALHO_DOMINIO_PROPRIO, "1");
  return NextResponse.rewrite(url, { request: { headers: cabecalhos } });
}

export const config = {
  matcher: ["/((?!_next/|api/|favicon.ico|icon.png|logo.png).*)"],
};
