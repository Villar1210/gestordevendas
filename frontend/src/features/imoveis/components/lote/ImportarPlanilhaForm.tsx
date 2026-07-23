// src/features/imoveis/components/lote/ImportarPlanilhaForm.tsx
// Cadastro em Lote de Unidades (Fatia 3b) - caminho alternativo de entrada
// para o mesmo grid (UnidadesLoteGrid), via upload de planilha em vez de
// gerar por padrao estrutural. Fluxo em 2 passos: (1) escolher o arquivo,
// que devolve os valores distintos da coluna PRODUTO (POST
// .../listar-produtos-planilha); (2) escolher o produto e pedir o preview
// filtrado (POST .../importar-planilha) - so entao o grid e populado.
"use client";

import { useRef, useState, ChangeEvent } from "react";
import { Upload, FileSpreadsheet, X } from "lucide-react";

interface ImportarPlanilhaFormProps {
  onListarProdutos: (file: File) => Promise<string[] | null>;
  onImportar: (file: File, produto: string) => void;
  isImporting: boolean;
}

export function ImportarPlanilhaForm({
  onListarProdutos,
  onImportar,
  isImporting,
}: ImportarPlanilhaFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [produtos, setProdutos] = useState<string[]>([]);
  const [produtoEscolhido, setProdutoEscolhido] = useState("");
  const [isListing, setIsListing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const selecionado = e.target.files?.[0];
    if (!selecionado) return;

    setFile(selecionado);
    setProdutos([]);
    setProdutoEscolhido("");
    setIsListing(true);
    try {
      const resultado = await onListarProdutos(selecionado);
      if (resultado) setProdutos(resultado);
    } finally {
      setIsListing(false);
    }
  }

  function handleRemoverArquivo() {
    setFile(null);
    setProdutos([]);
    setProdutoEscolhido("");
    if (inputRef.current) inputRef.current.value = "";
  }

  function handleImportarClick() {
    if (!file || !produtoEscolhido) return;
    onImportar(file, produtoEscolhido);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-sm font-semibold text-slate-800">Importar de planilha</h2>
      <p className="mb-4 text-sm text-slate-500">
        Envie um arquivo .csv ou .xlsx exportado de outra fonte (ex: planilha da incorporadora).
        As unidades serao extraidas automaticamente para o grid abaixo.
      </p>

      {!file ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-200 px-6 py-10 text-center hover:border-blue-400 hover:bg-blue-50/40">
          <Upload className="h-6 w-6 text-slate-400" />
          <p className="text-sm text-slate-600">Clique para escolher um arquivo .csv ou .xlsx</p>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx"
            onChange={handleFileChange}
            className="hidden"
          />
        </label>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-slate-700">
              <FileSpreadsheet className="h-4 w-4 text-slate-400" />
              {file.name}
            </div>
            <button
              type="button"
              onClick={handleRemoverArquivo}
              className="text-slate-400 hover:text-red-600"
              aria-label="Remover arquivo"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {isListing ? (
            <p className="text-sm text-slate-500">Lendo planilha...</p>
          ) : produtos.length > 0 ? (
            <div>
              <label className="mb-1 block text-sm text-slate-500">
                Qual produto da planilha corresponde a este empreendimento?
              </label>
              <div className="flex flex-col gap-3 sm:flex-row">
                <select
                  value={produtoEscolhido}
                  onChange={(e) => setProdutoEscolhido(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-slate-800 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                >
                  <option value="">Selecione...</option>
                  {produtos.map((produto) => (
                    <option key={produto} value={produto}>
                      {produto}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleImportarClick}
                  disabled={!produtoEscolhido || isImporting}
                  className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-60"
                >
                  {isImporting ? "Importando..." : "Importar"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Nenhum valor de PRODUTO encontrado nessa planilha.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
