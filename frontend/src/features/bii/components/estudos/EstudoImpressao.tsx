// Versao para impressao do Estudo de terreno (BII Fatia 5): A4, sem menu.
// "Imprimir" abre o dialogo do navegador (la da para "Salvar como PDF").
"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Loader2, Printer } from "lucide-react";
import { carregarEstudo, mensagemErroEstudo } from "../../hooks/useBiiEstudosIntegration";
import type { Estudo } from "../../types-estudo";
import { RelatorioEstudo } from "./RelatorioEstudo";

export function EstudoImpressao({ id }: { id: string }) {
  const [estudo, setEstudo] = useState<Estudo | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    carregarEstudo(id)
      .then((e) => {
        setEstudo(e);
        document.title = `${e.nome} — Estudo de terreno`;
      })
      .catch((err) => setErro(mensagemErroEstudo(err)));
  }, [id]);

  return (
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <style>{`@page { size: A4; margin: 12mm; } @media print { html, body { background: #fff !important; } }`}</style>
      <div className="mx-auto max-w-[1000px] p-4 sm:p-6 print:max-w-none print:p-0">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <p className="text-sm text-slate-600">
            Versão para impressão. No diálogo do navegador escolha <b>Salvar como PDF</b> para gerar o arquivo.
          </p>
          <button
            type="button"
            disabled={!estudo}
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
          >
            <Printer className="h-4 w-4" aria-hidden="true" /> Imprimir
          </button>
        </div>
        {erro ? (
          <p role="alert" className="flex items-center gap-2 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" aria-hidden="true" /> {erro}
          </p>
        ) : !estudo ? (
          <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
            <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden="true" /> Carregando estudo...
          </div>
        ) : (
          <RelatorioEstudo estudo={estudo} />
        )}
      </div>
    </div>
  );
}
