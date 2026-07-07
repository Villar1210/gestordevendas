// src/features/imoveis/components/ImovelListTable.tsx
import { Imovel, useImoveisStore } from "../store/useImoveisStore";
import { getFinalidadeLabel, getStatusOption, getTipoLabel } from "../constants";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatValor(imovel: Imovel): string {
  const parts: string[] = [];
  if (imovel.price) parts.push(currencyFormatter.format(imovel.price));
  if (imovel.rentPrice) parts.push(`${currencyFormatter.format(imovel.rentPrice)}/mes`);
  return parts.length > 0 ? parts.join(" · ") : "-";
}

interface ImovelListTableProps {
  imoveis: Imovel[];
}

export function ImovelListTable({ imoveis }: ImovelListTableProps) {
  const openImovelDetailPanel = useImoveisStore((state) => state.openImovelDetailPanel);

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
            <th className="px-4 py-3 font-medium">Imovel</th>
            <th className="px-4 py-3 font-medium">Tipo</th>
            <th className="px-4 py-3 font-medium">Proprietario</th>
            <th className="px-4 py-3 font-medium">Situacao</th>
            <th className="px-4 py-3 font-medium">Finalidade</th>
            <th className="px-4 py-3 font-medium">Valor</th>
            <th className="px-4 py-3 font-medium">Tags</th>
          </tr>
        </thead>
        <tbody>
          {imoveis.map((imovel) => {
            const statusOption = getStatusOption(imovel.status);
            return (
              <tr
                key={imovel.id}
                onClick={() => openImovelDetailPanel(imovel)}
                className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
              >
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-800">{imovel.title}</p>
                  {imovel.codigoInterno && (
                    <p className="text-xs text-slate-400">Cod. {imovel.codigoInterno}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{getTipoLabel(imovel.tipo)}</td>
                <td className="px-4 py-3 text-slate-600">{imovel.proprietarioNome ?? "-"}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusOption.badgeClassName}`}
                  >
                    {statusOption.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {getFinalidadeLabel(imovel.finalidade)}
                </td>
                <td className="px-4 py-3 font-medium text-slate-800">{formatValor(imovel)}</td>
                <td className="px-4 py-3 text-slate-500">{imovel.tags ?? "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {imoveis.length === 0 && (
        <p className="px-4 py-10 text-center text-sm text-slate-400">Nenhum imovel encontrado.</p>
      )}
    </div>
  );
}
