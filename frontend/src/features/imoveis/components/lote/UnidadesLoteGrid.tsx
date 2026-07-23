// src/features/imoveis/components/lote/UnidadesLoteGrid.tsx
// Grid editavel do Cadastro em Lote (Fatia 2b) - uma linha por unidade,
// edicao inline (sem modal). Totalmente controlado pelo componente pai
// (page.tsx): este componente so renderiza "rows" e chama os callbacks,
// nao guarda estado proprio das unidades.
"use client";

import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { ENQUADRAMENTO_OPTIONS, STATUS_OPTIONS } from "../../constants";

export interface UnidadeLoteRow {
  key: string;
  identificadorExterno: string;
  bloco: string;
  andar: string;
  numeroNoAndar: string;
  tipologia: string;
  area: string;
  dormitorios: string;
  enquadramento: string;
  pcd: boolean;
  valorTabela: string;
  valorComDesconto: string;
  status: string;
  // true quando o backend (gerar-lote, ou a resposta 409 de salvar-lote)
  // sinalizou que esse identificador ja existe no banco para este tenant -
  // so um aviso visual, nunca bloqueia a edicao (ver CLAUDE.md/enunciado
  // desta fatia).
  identificadorJaExiste: boolean;
}

const inputClassName =
  "w-full rounded-md border border-slate-200 px-2 py-1.5 text-sm text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

interface UnidadesLoteGridProps {
  rows: UnidadeLoteRow[];
  onUpdateRow: (key: string, patch: Partial<UnidadeLoteRow>) => void;
  onRemoveRow: (key: string) => void;
  onAddRow: () => void;
}

export function UnidadesLoteGrid({
  rows,
  onUpdateRow,
  onRemoveRow,
  onAddRow,
}: UnidadesLoteGridProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
        <h2 className="text-sm font-semibold text-slate-800">
          Unidades {rows.length > 0 && <span className="text-slate-400">({rows.length})</span>}
        </h2>
        <button
          type="button"
          onClick={onAddRow}
          className="flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-800"
        >
          <Plus className="h-4 w-4" /> Adicionar linha manual
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-slate-400">
          Nenhuma unidade ainda. Gere a partir do padrao acima ou adicione uma linha manual.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
                <th className="px-3 py-3 font-medium">Identificador</th>
                <th className="px-3 py-3 font-medium">Bloco</th>
                <th className="px-3 py-3 font-medium">Andar</th>
                <th className="px-3 py-3 font-medium">Posicao</th>
                <th className="px-3 py-3 font-medium">Tipologia</th>
                <th className="px-3 py-3 font-medium">Area (m2)</th>
                <th className="px-3 py-3 font-medium">Dorm.</th>
                <th className="px-3 py-3 font-medium">Enquadramento</th>
                <th className="px-3 py-3 text-center font-medium">PCD</th>
                <th className="px-3 py-3 font-medium">Valor tabela</th>
                <th className="px-3 py-3 font-medium">Valor c/ desconto</th>
                <th className="px-3 py-3 font-medium">Status</th>
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className={`border-b border-slate-100 last:border-0 ${
                    row.identificadorJaExiste ? "bg-red-50" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.identificadorExterno}
                      onChange={(e) =>
                        onUpdateRow(row.key, {
                          identificadorExterno: e.target.value,
                          // O aviso valia para o identificador ANTERIOR - uma
                          // vez editado, so uma nova checagem no backend (ao
                          // salvar) pode confirmar se o novo valor colide.
                          identificadorJaExiste: false,
                        })
                      }
                      className={`${inputClassName} ${row.identificadorJaExiste ? "border-red-300" : ""}`}
                    />
                    {row.identificadorJaExiste && (
                      <p className="mt-1 flex items-center gap-1 text-xs text-red-600">
                        <AlertTriangle className="h-3 w-3" /> Ja existe
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.bloco}
                      onChange={(e) => onUpdateRow(row.key, { bloco: e.target.value })}
                      className={`${inputClassName} w-20`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={row.andar}
                      onChange={(e) => onUpdateRow(row.key, { andar: e.target.value })}
                      className={`${inputClassName} w-16`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={row.numeroNoAndar}
                      onChange={(e) => onUpdateRow(row.key, { numeroNoAndar: e.target.value })}
                      className={`${inputClassName} w-16`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.tipologia}
                      onChange={(e) => onUpdateRow(row.key, { tipologia: e.target.value })}
                      className={`${inputClassName} w-40`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={row.area}
                      onChange={(e) => onUpdateRow(row.key, { area: e.target.value })}
                      className={`${inputClassName} w-24`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      value={row.dormitorios}
                      onChange={(e) => onUpdateRow(row.key, { dormitorios: e.target.value })}
                      className={`${inputClassName} w-16`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={row.enquadramento}
                      onChange={(e) => onUpdateRow(row.key, { enquadramento: e.target.value })}
                      className={`${inputClassName} w-28`}
                    >
                      {ENQUADRAMENTO_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input
                      type="checkbox"
                      checked={row.pcd}
                      onChange={(e) => onUpdateRow(row.key, { pcd: e.target.checked })}
                      className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={row.valorTabela}
                      onChange={(e) => onUpdateRow(row.key, { valorTabela: e.target.value })}
                      className={`${inputClassName} w-28`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="number"
                      step="0.01"
                      value={row.valorComDesconto}
                      onChange={(e) =>
                        onUpdateRow(row.key, { valorComDesconto: e.target.value })
                      }
                      className={`${inputClassName} w-28`}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={row.status}
                      onChange={(e) => onUpdateRow(row.key, { status: e.target.value })}
                      className={`${inputClassName} w-40`}
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => onRemoveRow(row.key)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-red-600"
                      aria-label="Remover unidade"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
