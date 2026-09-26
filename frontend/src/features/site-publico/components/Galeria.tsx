"use client";
// src/features/site-publico/components/Galeria.tsx
import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";

export function Galeria({ fotos, alt }: { fotos: string[]; alt: string }) {
  const [atual, setAtual] = useState(0);

  if (fotos.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <ImageOff className="h-12 w-12" aria-hidden />
        <span className="sr-only">Sem fotos</span>
      </div>
    );
  }

  const ir = (delta: number) => setAtual((i) => (i + delta + fotos.length) % fotos.length);

  return (
    <div>
      <div
        className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-slate-900 outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        tabIndex={fotos.length > 1 ? 0 : -1}
        role="region"
        aria-roledescription="galeria"
        aria-label={`Fotos de ${alt}. Use as setas do teclado para navegar.`}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") ir(-1);
          if (e.key === "ArrowRight") ir(1);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={fotos[atual]} alt={`${alt} - foto ${atual + 1} de ${fotos.length}`} className="h-full w-full object-contain" />
        {fotos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => ir(-1)}
              aria-label="Foto anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-800 shadow hover:bg-white"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => ir(1)}
              aria-label="Próxima foto"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-slate-800 shadow hover:bg-white"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <span aria-live="polite" className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
              {atual + 1} / {fotos.length}
            </span>
          </>
        )}
      </div>
      {fotos.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {fotos.map((f, i) => (
            <button
              key={f + i}
              type="button"
              onClick={() => setAtual(i)}
              aria-label={`Ver foto ${i + 1}`}
              aria-current={i === atual}
              className={`h-16 w-24 flex-none overflow-hidden rounded-lg border-2 ${i === atual ? "border-blue-600" : "border-transparent opacity-70 hover:opacity-100"}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
