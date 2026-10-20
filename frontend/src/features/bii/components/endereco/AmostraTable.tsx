// Tabela da amostra de transacoes do ITBI no raio, ordenavel por coluna.
// Rola na horizontal dentro do proprio card (a pagina nunca rola de lado).
"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { formatMoeda, formatNumero } from "../../constants";
import {
  corDoPreco,
  formatArea,
  formatDataTransacao,
  formatDistancia,
  formatEnderecoTransacao,
  formatPrecoM2,
} from "../../constants-endereco";
import type { AnaliseEnderecoResponse, TransacaoAmostra } from "../../types-endereco";

type Coluna = "data" | "endereco" | "areaConstruida" | "valor" | "precoM2" | "distanciaMetros";

const COLUNAS: { id: Coluna; label: string; numerica: boolean }[] = [
  { id: "data", label: "Data", numerica: false },
  { id: "endereco", label: "Endereço", numerica: false },
  { id: "areaConstruida", label: "Área", numerica: true },
  { id: "valor", label: "Valor", numerica: true },
  { id: "precoM2", label: "R$/m²", numerica: true },
  { id: "distanciaMetros", label: "Distância", numerica: true },
];

const LIMITE_INICIAL = 50;

function valorOrdenacao(t: TransacaoAmostra, coluna: Coluna): string | number | null {
  if (coluna === "endereco") return formatEnderecoTransacao(t).toLocaleLowerCase("pt-BR");
  return t[coluna];
}

interface AmostraTableProps {
  analise: AnaliseEnderecoResponse;
}

export function AmostraTable({ analise }: AmostraTableProps) {
  const { amostra, resumo } = analise;
  const [ordem, setOrdem] = useState<{ coluna: Coluna; asc: boolean }>({ coluna: "distanciaMetros", asc: true });
  const [mostrarTodas, setMostrarTodas] = useState(false);

  const ordenada = useMemo(() => {
    const copia = [...amostra];
    copia.sort((a, b) => {
      const va = valorOrdenacao(a, ordem.coluna);
      const vb = valorOrdenacao(b, ordem.coluna);
      // Vazios sempre no fim, independente da direcao.
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      const cmp = typeof va === "number" && typeof vb === "number" ? va - vb : String(va).localeCompare(String(vb), "pt-BR");
      return ordem.asc ? cmp : -cmp;
    });
    return copia;
  }, [amostra, ordem]);

  const visiveis = mostrarTodas ? ordenada : ordenada.slice(0, LIMITE_INICIAL);

  function alternar(coluna: Coluna) {
    setOrdem((o) =>
      o.coluna === coluna ? { coluna, asc: !o.asc } : { coluna, asc: coluna === "distanciaMetros" || coluna === "endereco" },
    );
  }

  return (
    <div>
      <div className="-mx-4 overflow-x-auto sm:mx-0">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-100 text-xs text-slate-500">
            <tr>
              {COLUNAS.map((c) => {
                const ativa = ordem.coluna === c.id;
                const Icone = ativa ? (ordem.asc ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <th
                    key={c.id}
                    scope="col"
                    aria-sort={ativa ? (ordem.asc ? "ascending" : "descending") : "none"}
                    className={`px-4 py-2 font-medium ${c.numerica ? "text-right" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => alternar(c.id)}
                      className={`inline-flex items-center gap-1 rounded hover:text-slate-800 ${ativa ? "text-slate-800" : ""}`}
                    >
                      {c.label}
                      <Icone className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visiveis.map((t, i) => (
              <tr key={`${t.lat}-${t.lng}-${t.data}-${i}`} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-2 text-slate-600">{formatDataTransacao(t.data)}</td>
                <td className="px-4 py-2">
                  <p className="font-medium text-slate-800">{formatEnderecoTransacao(t)}</p>
                  {t.bairro && <p className="text-xs text-slate-500">{t.bairro}</p>}
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-slate-600">{formatArea(t.areaConstruida)}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-slate-800">{formatMoeda(t.valor)}</td>
                <td className="whitespace-nowrap px-4 py-2 text-right">
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-800">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{
                        backgroundColor: corDoPreco(t.precoM2, resumo.precoM2P25, resumo.precoM2Mediano, resumo.precoM2P75),
                      }}
                      aria-hidden="true"
                    />
                    {formatPrecoM2(t.precoM2)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-2 text-right text-slate-600">{formatDistancia(t.distanciaMetros)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {ordenada.length > LIMITE_INICIAL && (
        <button
          type="button"
          onClick={() => setMostrarTodas((v) => !v)}
          className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          {mostrarTodas ? "Mostrar menos" : `Mostrar todas (${formatNumero(ordenada.length)})`}
        </button>
      )}
    </div>
  );
}
