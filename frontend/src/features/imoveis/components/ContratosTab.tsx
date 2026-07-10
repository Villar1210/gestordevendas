// src/features/imoveis/components/ContratosTab.tsx
"use client";

import { useEffect } from "react";
import { Plus } from "lucide-react";
import { useImoveisStore } from "../store/useImoveisStore";
import { useImoveisIntegration } from "../hooks/useImoveisIntegration";
import { ContratoFormModal } from "./ContratoFormModal";

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const TIPO_LABELS: Record<string, string> = {
  venda: "Venda",
  locacao: "Locacao",
};

const STATUS_BADGE: Record<string, string> = {
  ativo: "bg-green-100 text-green-700",
  encerrado: "bg-slate-100 text-slate-700",
  cancelado: "bg-red-100 text-red-700",
};

export function ContratosTab() {
  const contratos = useImoveisStore((state) => state.contratos);
  const imoveis = useImoveisStore((state) => state.imoveis);
  const proprietarios = useImoveisStore((state) => state.proprietarios);
  const inquilinosCompradores = useImoveisStore((state) => state.inquilinosCompradores);
  const openContratoFormModal = useImoveisStore((state) => state.openContratoFormModal);
  const { loadImoveis, loadProprietarios, loadInquilinosCompradores, loadContratos, handleEncerrarContrato } =
    useImoveisIntegration();

  useEffect(() => {
    loadImoveis();
    loadProprietarios();
    loadInquilinosCompradores();
    loadContratos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleEncerrarClick(contratoId: string, imovelId: string) {
    if (!confirm("Encerrar este contrato? O imovel volta a ficar disponivel.")) return;
    await handleEncerrarContrato(contratoId, imovelId);
  }

  return (
    <div className="px-6 py-4">
      <div className="mb-4 flex items-center justify-end">
        <button
          onClick={openContratoFormModal}
          className="flex items-center gap-1.5 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800"
        >
          <Plus className="h-4 w-4" /> Novo Contrato
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
              <th className="px-4 py-3 font-medium">Imovel</th>
              <th className="px-4 py-3 font-medium">Proprietario</th>
              <th className="px-4 py-3 font-medium">Inquilino/Comprador</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {contratos.map((contrato) => {
              const imovel = imoveis.find((i) => i.id === contrato.imovelId);
              const proprietario = proprietarios.find((p) => p.id === contrato.proprietarioId);
              const inquilinoComprador = inquilinosCompradores.find(
                (i) => i.id === contrato.inquilinoCompradorId,
              );
              return (
                <tr
                  key={contrato.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {imovel?.title ?? contrato.imovelId}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{proprietario?.nome ?? "-"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {inquilinoComprador?.nome ?? "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {TIPO_LABELS[contrato.tipo] ?? contrato.tipo}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {currencyFormatter.format(contrato.valor)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_BADGE[contrato.status] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {contrato.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {contrato.status === "ativo" && (
                      <button
                        onClick={() => handleEncerrarClick(contrato.id, contrato.imovelId)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        Encerrar
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {contratos.length === 0 && (
          <p className="px-4 py-10 text-center text-sm text-slate-400">
            Nenhum contrato cadastrado.
          </p>
        )}
      </div>

      <ContratoFormModal />
    </div>
  );
}
