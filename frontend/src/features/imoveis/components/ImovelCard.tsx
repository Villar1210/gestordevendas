// src/features/imoveis/components/ImovelCard.tsx
import { Home } from "lucide-react";
import { API_BASE_URL } from "@/core/api/client";
import { Imovel, useImoveisStore } from "../store/useImoveisStore";
import { getStatusOption, getTipoLabel } from "../constants";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatPrice(imovel: Imovel): string {
  const parts: string[] = [];
  if (imovel.price) parts.push(`${currencyFormatter.format(imovel.price)} (venda)`);
  if (imovel.rentPrice) parts.push(`${currencyFormatter.format(imovel.rentPrice)}/mes`);
  return parts.length > 0 ? parts.join(" · ") : "Sem preco definido";
}

interface ImovelCardProps {
  imovel: Imovel;
}

export function ImovelCard({ imovel }: ImovelCardProps) {
  const openImovelDetailPanel = useImoveisStore((state) => state.openImovelDetailPanel);
  const statusOption = getStatusOption(imovel.status);
  const coverUrl = imovel.coverPhotoUrl ? `${API_BASE_URL}${imovel.coverPhotoUrl}` : null;

  return (
    <div
      onClick={() => openImovelDetailPanel(imovel)}
      className="cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="flex h-40 items-center justify-center bg-slate-100">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={imovel.title} className="h-full w-full object-cover" />
        ) : (
          <Home className="h-10 w-10 text-slate-300" />
        )}
      </div>

      <div className="p-4">
        <div className="mb-1 flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-slate-800">{imovel.title}</p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusOption.badgeClassName}`}
          >
            {statusOption.label}
          </span>
        </div>

        {imovel.codigoInterno && (
          <p className="mb-1 text-xs text-slate-400">Cod. {imovel.codigoInterno}</p>
        )}

        <p className="mb-2 text-xs text-slate-500">{getTipoLabel(imovel.tipo)}</p>

        <p className="text-sm font-semibold text-slate-800">{formatPrice(imovel)}</p>
      </div>
    </div>
  );
}
