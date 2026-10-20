// src/features/bii/components/SourceBadge.tsx
// Selo de fonte do dado (honestidade do numero). Fatia 1 so tem "CRM".
export function SourceBadge({ fonte = "CRM", detalhe }: { fonte?: "CRM"; detalhe?: string }) {
  const titulo =
    fonte === "CRM" ? "Dado do CRM (Kanban: cards, etapas, ganho e perda)" : undefined;
  return (
    <span
      title={titulo}
      className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-blue-100 bg-blue-50 px-2 py-px text-[10px] font-semibold tracking-wide text-blue-700"
    >
      {detalhe ? `${fonte} · ${detalhe}` : fonte}
    </span>
  );
}
