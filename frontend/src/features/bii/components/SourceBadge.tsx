// Selo de fonte do dado (honestidade do numero): CRM (Fatia 1) e
// ITBI/Prefeitura (Fatia 2), com cor propria por fonte.
export type FonteDado = "CRM" | "ITBI";

const FONTES: Record<FonteDado, { rotulo: string; titulo: string; classe: string }> = {
  CRM: {
    rotulo: "CRM",
    titulo: "Dado do CRM (Kanban: cards, etapas, ganho e perda)",
    classe: "border-blue-100 bg-blue-50 text-blue-700",
  },
  ITBI: {
    rotulo: "ITBI/Prefeitura",
    titulo: "Guias de ITBI pagas — Prefeitura de São Paulo (base aberta). Valores declarados na guia.",
    classe: "border-green-100 bg-green-50 text-green-700",
  },
};

export function SourceBadge({ fonte = "CRM", detalhe }: { fonte?: FonteDado; detalhe?: string }) {
  const f = FONTES[fonte];
  return (
    <span
      title={f.titulo}
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2 py-px text-[10px] font-semibold tracking-wide ${f.classe}`}
    >
      {detalhe ? `${f.rotulo} · ${detalhe}` : f.rotulo}
    </span>
  );
}
