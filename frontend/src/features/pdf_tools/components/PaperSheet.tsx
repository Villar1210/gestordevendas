// src/features/pdf_tools/components/PaperSheet.tsx
// Motivo visual do modulo: uma folha com o canto dobrado, tingida pela cor
// da categoria. Aparece na dropzone, no resultado e no estado vazio.
import type { ReactNode } from "react";

interface PaperSheetProps {
  children?: ReactNode;
  tone?: string; // classes de fundo/cor (ex.: "bg-violet-50 text-violet-600")
  size?: "sm" | "md" | "lg";
  stacked?: boolean;
  className?: string;
}

const SIZES = {
  sm: { box: "h-14 w-11", fold: "14px", radius: "rounded-md" },
  md: { box: "h-24 w-[4.5rem]", fold: "20px", radius: "rounded-lg" },
  lg: { box: "h-32 w-24", fold: "26px", radius: "rounded-xl" },
} as const;

export function PaperSheet({ children, tone = "bg-white text-slate-500", size = "md", stacked, className = "" }: PaperSheetProps) {
  const s = SIZES[size];
  const clip = { clipPath: `polygon(0 0, calc(100% - ${s.fold}) 0, 100% ${s.fold}, 100% 100%, 0 100%)` };
  return (
    <div className={`relative ${s.box} ${className}`} aria-hidden="true">
      {stacked && (
        <>
          <div className={`absolute inset-0 translate-x-2.5 translate-y-1.5 rotate-6 ${s.radius} bg-slate-200`} style={clip} />
          <div className={`absolute inset-0 translate-x-1 translate-y-0.5 rotate-[2.5deg] ${s.radius} bg-slate-100`} style={clip} />
        </>
      )}
      <div className={`absolute inset-0 ${s.radius} ${tone} flex items-center justify-center`} style={clip}>
        {children}
      </div>
      {/* canto dobrado */}
      <div
        className="absolute right-0 top-0 rounded-bl-[4px] bg-black/10"
        style={{ width: s.fold, height: s.fold, clipPath: "polygon(0 0, 0 100%, 100% 100%)" }}
      />
    </div>
  );
}
