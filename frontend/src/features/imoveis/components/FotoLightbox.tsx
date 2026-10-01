// src/features/imoveis/components/FotoLightbox.tsx
// Visualizador de fotos em tela cheia: clicar numa miniatura abre a foto
// grande, com setas (tela e teclado), contador, miniaturas para pular
// direto e Esc/clique fora para fechar. Usado nas fotos do empreendimento,
// da unidade e na vitrine do Catalogo.
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { API_BASE_URL } from "@/core/api/client";

export interface FotoLightboxItem {
  url: string; // caminho relativo (/uploads/...), como vem da API
  legenda?: string;
}

interface FotoLightboxProps {
  fotos: FotoLightboxItem[];
  indiceInicial: number;
  onClose: () => void;
}

export function FotoLightbox({ fotos, indiceInicial, onClose }: FotoLightboxProps) {
  const [indice, setIndice] = useState(indiceInicial);
  const fecharRef = useRef<HTMLButtonElement>(null);
  const toqueInicioX = useRef<number | null>(null);
  const total = fotos.length;
  const atual = fotos[indice];

  const anterior = useCallback(() => setIndice((i) => (i - 1 + total) % total), [total]);
  const proxima = useCallback(() => setIndice((i) => (i + 1) % total), [total]);

  useEffect(() => {
    const focoAnterior = document.activeElement as HTMLElement | null;
    fecharRef.current?.focus();
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      } else if (e.key === "ArrowLeft") anterior();
      else if (e.key === "ArrowRight") proxima();
    }
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      document.body.style.overflow = overflowAnterior;
      focoAnterior?.focus?.();
    };
  }, [onClose, anterior, proxima]);

  if (!atual) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visualizar foto"
      className="fixed inset-0 z-[70] flex flex-col bg-black/95"
      onClick={onClose}
      onTouchStart={(e) => (toqueInicioX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (toqueInicioX.current === null || total < 2) return;
        const dx = e.changedTouches[0].clientX - toqueInicioX.current;
        toqueInicioX.current = null;
        if (Math.abs(dx) > 50) (dx > 0 ? anterior : proxima)();
      }}
    >
      <div className="flex items-center justify-between px-4 py-3 text-sm text-white/80">
        <span aria-live="polite">
          {total > 1 && `${indice + 1} / ${total}`}
          {atual.legenda && <span className="ml-3 text-white">{atual.legenda}</span>}
        </span>
        <button
          ref={fecharRef}
          type="button"
          onClick={onClose}
          aria-label="Fechar"
          className="rounded-full p-2 text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 sm:px-16">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`${API_BASE_URL}${atual.url}`}
          alt={atual.legenda ?? `Foto ${indice + 1} de ${total}`}
          onClick={(e) => e.stopPropagation()}
          className="max-h-full max-w-full select-none rounded-lg object-contain shadow-2xl"
        />
        {total > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                anterior();
              }}
              aria-label="Foto anterior"
              className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-4"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                proxima();
              }}
              aria-label="Próxima foto"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-4"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      {total > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto px-4 py-3" onClick={(e) => e.stopPropagation()}>
          {fotos.map((foto, i) => (
            <button
              key={`${foto.url}-${i}`}
              type="button"
              onClick={() => setIndice(i)}
              aria-label={`Ver foto ${i + 1}`}
              aria-current={i === indice}
              className={`h-14 w-20 flex-none overflow-hidden rounded-md border-2 transition ${
                i === indice ? "border-white" : "border-transparent opacity-60 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`${API_BASE_URL}${foto.url}`} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
