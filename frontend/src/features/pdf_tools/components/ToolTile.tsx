// src/features/pdf_tools/components/ToolTile.tsx
// Tile de icone da ferramenta: folha com canto dobrado na cor da categoria.
import type { PdfTool } from "../catalog";
import { getCategory } from "../catalog";
import { PaperSheet } from "./PaperSheet";

export function ToolTile({ tool, size = "sm" }: { tool: PdfTool; size?: "sm" | "md" }) {
  const category = getCategory(tool.category);
  const Icon = tool.icon;
  return (
    <PaperSheet tone={category.tile} size={size}>
      <Icon className={size === "sm" ? "h-5 w-5" : "h-8 w-8"} strokeWidth={1.75} />
    </PaperSheet>
  );
}
