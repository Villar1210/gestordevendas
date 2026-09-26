// src/features/site-publico/components/FiltrosImoveis.tsx
// Formulario GET puro: funciona sem JavaScript e deixa a busca na URL
// (o visitante pode compartilhar o link da pesquisa).
import { Search } from "lucide-react";
import { TIPOS } from "../format";

interface Props {
  action: string;
  valores: Record<string, string | undefined>;
}

const campo =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600";

export function FiltrosImoveis({ action, valores }: Props) {
  return (
    <form action={action} method="get" className="grid grid-cols-2 gap-3 rounded-2xl bg-white p-4 shadow-lg md:grid-cols-6">
      <label className="col-span-2">
        <span className="sr-only">Buscar</span>
        <input name="busca" defaultValue={valores.busca} placeholder="Bairro, cidade ou empreendimento" className={campo} />
      </label>
      <label>
        <span className="sr-only">Tipo</span>
        <select name="tipo" defaultValue={valores.tipo ?? ""} className={campo}>
          <option value="">Todos os tipos</option>
          {Object.entries(TIPOS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </label>
      <label>
        <span className="sr-only">Quartos</span>
        <select name="quartosMin" defaultValue={valores.quartosMin ?? ""} className={campo}>
          <option value="">Quartos</option>
          <option value="1">1 ou mais</option>
          <option value="2">2 ou mais</option>
          <option value="3">3 ou mais</option>
        </select>
      </label>
      <label>
        <span className="sr-only">Preço máximo</span>
        <select name="precoMax" defaultValue={valores.precoMax ?? ""} className={campo}>
          <option value="">Preço até</option>
          {[250000, 350000, 500000, 750000, 1000000].map((v) => (
            <option key={v} value={v}>{v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-700 text-sm font-semibold text-white hover:bg-blue-800 md:col-span-1">
        <Search className="h-4 w-4" /> Buscar
      </button>
    </form>
  );
}
