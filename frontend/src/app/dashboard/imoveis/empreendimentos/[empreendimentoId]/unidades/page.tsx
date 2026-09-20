"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Building2, Home, CheckCircle, Clock, XCircle } from "lucide-react";
import { useImoveisIntegration } from "@/features/imoveis/hooks/useImoveisIntegration";
import { useImoveisStore, Imovel } from "@/features/imoveis/store/useImoveisStore";

const STATUS_LABELS: Record<string, string> = {
  disponivel: "Disponível",
  reservado: "Reservado",
  vendido: "Vendido",
  alugado: "Alugado",
  em_obras: "Em obras",
};

const STATUS_CLASSES: Record<string, string> = {
  disponivel: "bg-green-100 text-green-800 border border-green-200",
  reservado: "bg-amber-100 text-amber-800 border border-amber-200",
  vendido: "bg-red-100 text-red-800 border border-red-200",
  alugado: "bg-gray-100 text-gray-700 border border-gray-200",
  em_obras: "bg-blue-100 text-blue-800 border border-blue-200",
};

function statusLabel(s: string) { return STATUS_LABELS[s] ?? s; }
function statusClass(s: string) { return STATUS_CLASSES[s] ?? "bg-gray-100 text-gray-700 border border-gray-200"; }

function UnitCard({ unit, onClick }: { unit: Imovel; onClick: (u: Imovel) => void }) {
  const price = unit.price
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(unit.price)
    : unit.rentPrice
    ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(unit.rentPrice) + "/mês"
    : null;

  return (
    <button
      onClick={() => onClick(unit)}
      className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-400 hover:shadow-md transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="font-semibold text-gray-900 text-sm truncate">
          {unit.codigoInterno || unit.title}
        </span>
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${statusClass(unit.status)}`}>
          {statusLabel(unit.status)}
        </span>
      </div>
      {unit.tipo && <p className="text-xs text-gray-500 mb-2">{unit.tipo}</p>}
      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600">
        {unit.area != null && <span>{unit.area} m²</span>}
        {unit.bedrooms != null && unit.bedrooms > 0 && (
          <span>{unit.bedrooms} dorm{unit.bedrooms !== 1 ? "s" : ""}</span>
        )}
        {unit.suites != null && unit.suites > 0 && (
          <span>{unit.suites} suíte{unit.suites !== 1 ? "s" : ""}</span>
        )}
        {unit.parkingSpots != null && unit.parkingSpots > 0 && (
          <span>{unit.parkingSpots} vaga{unit.parkingSpots !== 1 ? "s" : ""}</span>
        )}
      </div>
      {price && <p className="mt-2 text-sm font-semibold text-blue-700">{price}</p>}
    </button>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 animate-pulse">
      <div className="flex justify-between mb-2">
        <div className="h-4 bg-gray-200 rounded w-1/2" />
        <div className="h-4 bg-gray-200 rounded w-1/4" />
      </div>
      <div className="h-3 bg-gray-100 rounded w-1/3 mb-2" />
      <div className="flex gap-3">
        <div className="h-3 bg-gray-100 rounded w-10" />
        <div className="h-3 bg-gray-100 rounded w-10" />
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2].map((g) => (
        <div key={g}>
          <div className="h-5 bg-gray-200 rounded w-24 mb-4 animate-pulse" />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatsBar({ units }: { units: Imovel[] }) {
  const total = units.length;
  const disponivel = units.filter((u) => u.status === "disponivel").length;
  const reservado = units.filter((u) => u.status === "reservado").length;
  const vendidoAlugado = units.filter((u) => u.status === "vendido" || u.status === "alugado").length;
  const emObras = units.filter((u) => u.status === "em_obras").length;

  const stats = [
    { label: "Total", value: total, icon: <Home className="w-4 h-4" />, cls: "text-gray-700" },
    { label: "Disponíveis", value: disponivel, icon: <CheckCircle className="w-4 h-4" />, cls: "text-green-700" },
    { label: "Reservados", value: reservado, icon: <Clock className="w-4 h-4" />, cls: "text-amber-700" },
    { label: "Vendidos/Alugados", value: vendidoAlugado, icon: <XCircle className="w-4 h-4" />, cls: "text-red-700" },
    ...(emObras > 0 ? [{ label: "Em obras", value: emObras, icon: <Building2 className="w-4 h-4" />, cls: "text-blue-700" }] : []),
  ];

  return (
    <div className="flex flex-wrap gap-4 bg-white border border-gray-200 rounded-lg px-5 py-4">
      {stats.map((s) => (
        <div key={s.label} className={`flex items-center gap-2 ${s.cls}`}>
          {s.icon}
          <span className="text-sm">
            <span className="font-bold">{s.value}</span>{" "}
            <span className="text-gray-500 font-normal">{s.label}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

export default function UnidadesPage() {
  const params = useParams();
  const router = useRouter();
  const empreendimentoId = params.empreendimentoId as string;

  const { handleListImoveisByEmpreendimento, handleGetEmpreendimentoDetail } = useImoveisIntegration();
  const imoveis = useImoveisStore((s) => s.imoveis);
  const empreendimentos = useImoveisStore((s) => s.empreendimentos);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const empreendimento = empreendimentos.find((e) => e.id === empreendimentoId) ?? null;
  const units: Imovel[] = useMemo(
    () => imoveis.filter((im) => im.empreendimentoId === empreendimentoId),
    [imoveis, empreendimentoId]
  );

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        await Promise.all([
          handleGetEmpreendimentoDetail(empreendimentoId),
          handleListImoveisByEmpreendimento(empreendimentoId),
        ]);
      } catch (err) {
        setError("Erro ao carregar dados. Tente novamente.");
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empreendimentoId]);

  const grouped = useMemo(() => {
    const hasBlocos = units.some((u) => u.customFields?.bloco);
    if (!hasBlocos) return [{ bloco: null, units }];
    const map = new Map<string, Imovel[]>();
    for (const u of units) {
      const bloco = (u.customFields?.bloco as string) || "Sem Bloco";
      if (!map.has(bloco)) map.set(bloco, []);
      map.get(bloco)!.push(u);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => {
        const andA = String(a.customFields?.andar ?? "").padStart(4, "0");
        const andB = String(b.customFields?.andar ?? "").padStart(4, "0");
        if (andA !== andB) return andA.localeCompare(andB);
        const posA = String(a.customFields?.posicao ?? "").padStart(4, "0");
        const posB = String(b.customFields?.posicao ?? "").padStart(4, "0");
        return posA.localeCompare(posB);
      });
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([bloco, units]) => ({ bloco, units }));
  }, [units]);

  function handleUnitClick(unit: Imovel) {
    router.push(`/dashboard/imoveis?id=${unit.id}`);
  }

  const address = empreendimento
    ? [empreendimento.rua, empreendimento.numero, empreendimento.bairro, empreendimento.cidade, empreendimento.uf]
        .filter(Boolean).join(", ")
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-xl mx-auto px-4 py-6 space-y-6">
        <div className="flex items-start gap-4">
          <Link
            href="/dashboard/imoveis"
            className="mt-1 p-1.5 rounded-md text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <Building2 className="w-5 h-5 text-blue-600 shrink-0" />
              <h1 className="text-xl font-bold text-gray-900 truncate">
                {empreendimento?.name ?? "Empreendimento"}
              </h1>
            </div>
            {address && <p className="text-sm text-gray-500 ml-7">{address}</p>}
          </div>
          <Link
            href={`/dashboard/imoveis/empreendimentos/${empreendimentoId}`}
            className="shrink-0 text-sm text-blue-600 hover:text-blue-800 hover:underline"
          >
            Ver detalhes
          </Link>
        </div>

        <h2 className="text-base font-semibold text-gray-700 -mt-2">Unidades do empreendimento</h2>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <LoadingSkeleton />
        ) : units.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Home className="w-12 h-12 text-gray-300 mb-4" />
            <p className="text-gray-500 font-medium">Nenhuma unidade encontrada</p>
            <p className="text-gray-400 text-sm mt-1">
              Este empreendimento ainda não possui imóveis cadastrados.
            </p>
            <Link
              href={`/dashboard/imoveis/empreendimentos/${empreendimentoId}/lote`}
              className="mt-4 text-sm text-blue-600 hover:underline"
            >
              Cadastrar unidades em lote →
            </Link>
          </div>
        ) : (
          <>
            <StatsBar units={units} />
            <div className="space-y-8">
              {grouped.map(({ bloco, units: groupUnits }) => (
                <section key={bloco ?? "__all__"}>
                  {bloco && (
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                        Bloco {bloco}
                      </h3>
                      <div className="flex-1 h-px bg-gray-200" />
                      <span className="text-xs text-gray-400">
                        {groupUnits.length} unidade{groupUnits.length !== 1 ? "s" : ""}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                    {groupUnits.map((unit) => (
                      <UnitCard key={unit.id} unit={unit} onClick={handleUnitClick} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
