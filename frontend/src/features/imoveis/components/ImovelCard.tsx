// src/features/imoveis/components/ImovelCard.tsx
import { Home, Bed, Bath, Car, Maximize2 } from "lucide-react";
import { API_BASE_URL } from "@/core/api/client";
import { Imovel, useImoveisStore } from "../store/useImoveisStore";
import { getStatusOption, getTipoLabel, getFinalidadeLabel } from "../constants";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

interface ImovelCardProps {
  imovel: Imovel;
}

export function ImovelCard({ imovel }: ImovelCardProps) {
  const openImovelDetailPanel = useImoveisStore((state) => state.openImovelDetailPanel);
  const statusOption = getStatusOption(imovel.status);
  const coverUrl = imovel.coverPhotoUrl ? `${API_BASE_URL}${imovel.coverPhotoUrl}` : null;

  const priceDisplay = imovel.price
    ? currencyFormatter.format(imovel.price)
    : imovel.rentPrice
      ? `${currencyFormatter.format(imovel.rentPrice)}/mês`
      : null;

  const location = [imovel.bairro, imovel.cidade].filter(Boolean).join(", ");

  return (
    <div
      onClick={() => openImovelDetailPanel(imovel)}
      className="cursor-pointer overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
    >
      {/* Foto */}
      <div className="relative flex h-44 items-center justify-center bg-slate-100">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverUrl} alt={imovel.title} className="h-full w-full object-cover" />
        ) : (
          <Home className="h-10 w-10 text-slate-300" />
        )}
        {/* Badge status */}
        <span
          className={`absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium ${statusOption.badgeClassName}`}
        >
          {statusOption.label}
        </span>
        {/* Badge finalidade */}
        <span className="absolute left-2 top-2 rounded-full bg-blue-700 px-2 py-0.5 text-xs font-medium text-white">
          {getFinalidadeLabel(imovel.finalidade)}
        </span>
      </div>

      <div className="p-4">
        {/* Tipo */}
        <p className="mb-0.5 text-xs font-medium uppercase tracking-wide text-blue-600">
          {getTipoLabel(imovel.tipo)}
          {imovel.codigoInterno && (
            <span className="ml-2 font-normal normal-case tracking-normal text-slate-400">
              · Cód. {imovel.codigoInterno}
            </span>
          )}
        </p>

        {/* Título */}
        <p className="mb-1 line-clamp-2 text-sm font-semibold text-slate-800">{imovel.title}</p>

        {/* Localização */}
        {location && <p className="mb-3 text-xs text-slate-500">{location}</p>}

        {/* Ícones de características */}
        <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-500">
          {imovel.bedrooms != null && (
            <span className="flex items-center gap-1">
              <Bed className="h-3.5 w-3.5" />
              {imovel.bedrooms} qto{imovel.bedrooms !== 1 ? "s" : ""}
            </span>
          )}
          {imovel.bathrooms != null && (
            <span className="flex items-center gap-1">
              <Bath className="h-3.5 w-3.5" />
              {imovel.bathrooms} bnh
            </span>
          )}
          {imovel.parkingSpots != null && imovel.parkingSpots > 0 && (
            <span className="flex items-center gap-1">
              <Car className="h-3.5 w-3.5" />
              {imovel.parkingSpots} vaga{imovel.parkingSpots !== 1 ? "s" : ""}
            </span>
          )}
          {(imovel.area ?? imovel.areaTotal) != null && (
            <span className="flex items-center gap-1">
              <Maximize2 className="h-3.5 w-3.5" />
              {imovel.area ?? imovel.areaTotal} m²
            </span>
          )}
        </div>

        {/* Preço */}
        {priceDisplay ? (
          <p className="text-base font-bold text-slate-900">{priceDisplay}</p>
        ) : (
          <p className="text-sm text-slate-400">Preço a consultar</p>
        )}
      </div>
    </div>
  );
}
