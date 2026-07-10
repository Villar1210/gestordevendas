// src/features/imoveis/components/InquilinosTab.tsx
"use client";

import { useEffect } from "react";
import { useImoveisStore } from "../store/useImoveisStore";
import { useImoveisIntegration } from "../hooks/useImoveisIntegration";
import { getStatusAnaliseCreditoOption } from "../constants";
import { InquilinoDetailPanel } from "./InquilinoDetailPanel";

export function InquilinosTab() {
  const inquilinosCompradores = useImoveisStore((state) => state.inquilinosCompradores);
  const openInquilinoDetailPanel = useImoveisStore((state) => state.openInquilinoDetailPanel);
  const { loadInquilinosCompradores } = useImoveisIntegration();

  useEffect(() => {
    loadInquilinosCompradores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="px-6 py-4">
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <th className="px-4 py-3 font-medium">Nome</th>
              <th className="px-4 py-3 font-medium">Documento</th>
              <th className="px-4 py-3 font-medium">Telefone</th>
              <th className="px-4 py-3 font-medium">Analise de Credito</th>
            </tr>
          </thead>
          <tbody>
            {inquilinosCompradores.map((inquilino) => {
              const statusOption = getStatusAnaliseCreditoOption(inquilino.statusAnaliseCredito);
              return (
                <tr
                  key={inquilino.id}
                  onClick={() => openInquilinoDetailPanel(inquilino)}
                  className="cursor-pointer border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{inquilino.nome}</p>
                    {inquilino.email && (
                      <p className="text-xs text-slate-400">{inquilino.email}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{inquilino.cpfCnpj ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600">{inquilino.telefone}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusOption.badgeClassName}`}
                    >
                      {statusOption.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {inquilinosCompradores.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            Nenhum inquilino/comprador cadastrado ainda. Eles sao criados a partir de um Contrato,
            na aba Contratos.
          </p>
        )}
      </div>

      <InquilinoDetailPanel />
    </div>
  );
}
