// Aba "Analise por Endereco" do BII: confere a cobertura do ITBI, mostra o
// formulario e o resultado da ultima analise feita.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Database, History, Loader2, MapPinned } from "lucide-react";
import { formatDataIso, formatNumero } from "../../constants";
import { carregarCobertura, mensagemErroAnalise, useBiiAnaliseIntegration } from "../../hooks/useBiiAnaliseIntegration";
import { useBiiAnaliseStore } from "../../store/useBiiAnaliseStore";
import type { CoberturaItbi } from "../../types-endereco";
import { EmptyState } from "../EmptyState";
import { AnaliseEnderecoForm } from "./AnaliseEnderecoForm";
import { AnaliseResultado } from "./AnaliseResultado";

function resumoCobertura(c: CoberturaItbi): string {
  const anos = [...c.anos].sort((a, b) => a - b);
  const anosTexto = anos.length === 0 ? "" : anos.length === 1 ? `${anos[0]}` : `${anos[0]}–${anos[anos.length - 1]}`;
  const pct = c.totalTransacoes > 0 ? Math.round((c.geocodificadas / c.totalTransacoes) * 100) : 0;
  return [
    anosTexto && `anos ${anosTexto}`,
    `${formatNumero(c.totalTransacoes)} transações`,
    `${formatNumero(c.geocodificadas)} com localização (${pct}%)`,
    c.ultimaImportacao && `última importação em ${formatDataIso(c.ultimaImportacao)}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function AnaliseEndereco() {
  const resultado = useBiiAnaliseStore((s) => s.resultado);
  const isLoading = useBiiAnaliseStore((s) => s.isLoading);
  const erro = useBiiAnaliseStore((s) => s.erro);
  const { analisar } = useBiiAnaliseIntegration();

  const [cobertura, setCobertura] = useState<CoberturaItbi | null>(null);
  const [coberturaErro, setCoberturaErro] = useState<string | null>(null);
  const [coberturaCarregando, setCoberturaCarregando] = useState(true);

  const buscarCobertura = useCallback(() => {
    setCoberturaCarregando(true);
    setCoberturaErro(null);
    carregarCobertura()
      .then(setCobertura)
      .catch((err) => setCoberturaErro(mensagemErroAnalise(err)))
      .finally(() => setCoberturaCarregando(false));
  }, []);

  useEffect(() => {
    buscarCobertura();
  }, [buscarCobertura]);

  if (coberturaCarregando && !cobertura) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden="true" />
        <p className="text-sm">Conferindo os dados do ITBI disponíveis...</p>
      </div>
    );
  }

  if (cobertura && cobertura.totalTransacoes === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white">
        <EmptyState
          icon={Database}
          titulo="Ainda não há dados do ITBI importados"
          texto="A análise por endereço usa as guias de ITBI da Prefeitura de São Paulo. Assim que o Super Usuário da plataforma importar a planilha, esta tela fica disponível."
        />
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {cobertura && (
        <p className="flex items-start gap-1.5 text-xs text-slate-500">
          <Database className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Base ITBI: {resumoCobertura(cobertura)}</span>
        </p>
      )}
      {coberturaErro && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs text-slate-600">
          <AlertCircle className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <span className="min-w-0 flex-1">Não foi possível conferir a cobertura do ITBI agora.</span>
          <button type="button" onClick={buscarCobertura} className="font-medium text-blue-700 hover:underline">
            Tentar de novo
          </button>
        </div>
      )}

      <AnaliseEnderecoForm onAnalisar={analisar} carregando={isLoading} />

      {isLoading && (
        <div
          role="status"
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-center text-slate-500"
        >
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" aria-hidden="true" />
          <p className="text-sm font-medium text-slate-700">Localizando o endereço e buscando vendas registradas...</p>
          <p className="text-xs">Isso pode levar alguns segundos.</p>
        </div>
      )}

      {!isLoading && erro && (
        <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">Não foi possível fazer a análise</p>
            <p className="mt-0.5">{erro}</p>
          </div>
        </div>
      )}

      {!isLoading && resultado && (
        <>
          <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
            <History className="h-3.5 w-3.5" aria-hidden="true" />
            Análise salva no{" "}
            <Link href="/dashboard/bii/historico" className="font-medium text-blue-700 hover:underline">
              Histórico
            </Link>
            .
          </p>
          <AnaliseResultado analise={resultado} />
        </>
      )}

      {!isLoading && !resultado && !erro && (
        <section className="rounded-2xl border border-dashed border-slate-200 bg-white">
          <EmptyState
            icon={MapPinned}
            titulo="Digite um endereço para começar"
            texto='Ex.: "Av. Vila Ema, 3000, Vila Ema, São Paulo". Você vê as vendas reais registradas no ITBI em volta do endereço, com preço por m² e mapa.'
          />
        </section>
      )}
    </div>
  );
}
