// src/features/site-publico/components/ImovelCardSite.tsx
import Link from "next/link";
import { Bath, BedDouble, Car, Home, Maximize2 } from "lucide-react";
import type { ImovelResumo } from "../types";
import { TIPOS, formatarPreco, localizacao, urlFoto } from "../format";

export function ImovelCardSite({ imovel, base }: { imovel: ImovelResumo; base: string }) {
  const foto = urlFoto(imovel.fotoCapa);
  const preco = formatarPreco(imovel.preco);
  const aluguel = formatarPreco(imovel.precoAluguel);
  const local = localizacao(imovel.bairro, imovel.cidade, imovel.uf);

  return (
    <Link
      href={`${base}/imovel/${imovel.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative h-48 bg-slate-100">
        {foto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={foto} alt={imovel.titulo} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center text-slate-300">
            <Home className="h-12 w-12" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-medium text-slate-700">
          {TIPOS[imovel.tipo] ?? imovel.tipo}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        {imovel.empreendimentoNome && (
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{imovel.empreendimentoNome}</p>
        )}
        <h3 className="line-clamp-2 font-semibold text-slate-900">{imovel.titulo}</h3>
        {local && <p className="text-sm text-slate-500">{local}</p>}
        <div className="flex flex-wrap gap-3 text-sm text-slate-600">
          {imovel.quartos != null && imovel.quartos > 0 && (
            <span className="flex items-center gap-1"><BedDouble className="h-4 w-4" />{imovel.quartos} quarto{imovel.quartos > 1 ? "s" : ""}</span>
          )}
          {imovel.banheiros != null && imovel.banheiros > 0 && (
            <span className="flex items-center gap-1"><Bath className="h-4 w-4" />{imovel.banheiros}</span>
          )}
          {imovel.vagas != null && imovel.vagas > 0 && (
            <span className="flex items-center gap-1"><Car className="h-4 w-4" />{imovel.vagas}</span>
          )}
          {imovel.area != null && (
            <span className="flex items-center gap-1"><Maximize2 className="h-4 w-4" />{imovel.area} m²</span>
          )}
        </div>
        <div className="mt-auto pt-2">
          {preco ? (
            <p className="text-lg font-bold text-slate-900">{preco}</p>
          ) : aluguel ? (
            <p className="text-lg font-bold text-slate-900">{aluguel}<span className="text-sm font-normal text-slate-500">/mês</span></p>
          ) : (
            <p className="text-sm font-medium text-blue-700">Consulte o valor</p>
          )}
        </div>
      </div>
    </Link>
  );
}
