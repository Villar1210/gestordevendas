// src/features/imoveis/components/book/BookImagensSelecionadas.tsx
// Imagens JPG escolhidas para o book, ANTES de analisar: miniatura, numero da
// pagina, remover e reordenar (setas acessiveis por teclado; arrastar e so um
// atalho no desktop). A ordem da lista e a ordem das paginas enviada ao backend.
"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, ImagePlus, X } from "lucide-react";
import { formatarMb, type ImagemBook } from "./arquivosBook";

interface Props {
  imagens: ImagemBook[];
  desabilitado?: boolean;
  onMover: (id: string, delta: -1 | 1) => void;
  onMoverPara: (id: string, indiceDestino: number) => void;
  onRemover: (id: string) => void;
  onDimensoes: (id: string, largura: number, altura: number) => void;
  onAdicionar: () => void;
  podeAdicionar: boolean;
}

type Foco = { id: string; botao: "antes" | "depois" } | null;

const botaoSeta =
  "flex h-11 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-200 disabled:hover:bg-white disabled:hover:text-slate-600";

export function BookImagensSelecionadas({
  imagens,
  desabilitado = false,
  onMover,
  onMoverPara,
  onRemover,
  onDimensoes,
  onAdicionar,
  podeAdicionar,
}: Props) {
  const botoes = useRef(new Map<string, HTMLButtonElement | null>());
  const focoPendente = useRef<Foco>(null);
  const [arrastando, setArrastando] = useState<string | null>(null);
  const [alvo, setAlvo] = useState<number | null>(null);
  const [anuncio, setAnuncio] = useState("");

  // Depois de mover, o foco acompanha a imagem (se a seta ficou desabilitada
  // na ponta da lista, vai para a outra seta).
  useEffect(() => {
    const f = focoPendente.current;
    if (!f) return;
    focoPendente.current = null;
    const preferido = botoes.current.get(`${f.id}:${f.botao}`);
    const outro = botoes.current.get(`${f.id}:${f.botao === "antes" ? "depois" : "antes"}`);
    (preferido && !preferido.disabled ? preferido : outro)?.focus();
  }, [imagens]);

  function mover(img: ImagemBook, indice: number, delta: -1 | 1) {
    focoPendente.current = { id: img.id, botao: delta < 0 ? "antes" : "depois" };
    onMover(img.id, delta);
    setAnuncio(`${img.arquivo.name} agora é a página ${indice + 1 + delta} de ${imagens.length}.`);
  }

  return (
    <div>
      <p aria-live="polite" className="sr-only">
        {anuncio}
      </p>
      <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Imagens do book, na ordem das páginas">
        {imagens.map((img, i) => (
          <li
            key={img.id}
            draggable={!desabilitado}
            onDragStart={(e) => {
              setArrastando(img.id);
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", img.id);
            }}
            onDragEnd={() => {
              setArrastando(null);
              setAlvo(null);
            }}
            onDragOver={(e) => {
              if (!arrastando) return;
              e.preventDefault();
              e.stopPropagation();
              if (alvo !== i) setAlvo(i);
            }}
            onDrop={(e) => {
              if (!arrastando) return;
              e.preventDefault();
              e.stopPropagation();
              onMoverPara(arrastando, i);
              setArrastando(null);
              setAlvo(null);
            }}
            className={`flex flex-col overflow-hidden rounded-xl border bg-white transition ${
              img.problema ? "border-red-300 ring-1 ring-red-200" : "border-slate-200"
            } ${arrastando === img.id ? "opacity-40" : ""} ${
              alvo === i && arrastando && arrastando !== img.id ? "ring-2 ring-blue-500" : ""
            }`}
          >
            <div className="relative aspect-[3/4] bg-slate-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={`Página ${i + 1}: ${img.arquivo.name}`}
                draggable={false}
                onLoad={(e) => onDimensoes(img.id, e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
                className="h-full w-full object-contain"
              />
              <span className="absolute left-2 top-2 rounded-full bg-slate-900/75 px-2 py-0.5 text-xs font-semibold text-white">
                Pág. {i + 1}
              </span>
              <button
                type="button"
                onClick={() => {
                  onRemover(img.id);
                  setAnuncio(`${img.arquivo.name} removida.`);
                }}
                disabled={desabilitado}
                aria-label={`Remover página ${i + 1} (${img.arquivo.name})`}
                className="absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-blue-700 disabled:opacity-40"
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/95 shadow ring-1 ring-slate-200 transition hover:bg-red-50 hover:text-red-700">
                  <X className="h-4 w-4" aria-hidden />
                </span>
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-2">
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-700" title={img.arquivo.name}>
                  {img.arquivo.name}
                </p>
                <p className="text-xs text-slate-500">{formatarMb(img.arquivo.size)}</p>
                {img.problema && (
                  <p className="mt-1 flex items-start gap-1 text-xs font-medium text-red-700">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden /> {img.problema}
                  </p>
                )}
              </div>
              <div className="mt-auto flex gap-2">
                <button
                  type="button"
                  ref={(el) => {
                    botoes.current.set(`${img.id}:antes`, el);
                  }}
                  onClick={() => mover(img, i, -1)}
                  disabled={desabilitado || i === 0}
                  aria-label={`Mover página ${i + 1} para antes`}
                  title="Mover para antes"
                  className={botaoSeta}
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden />
                </button>
                <button
                  type="button"
                  ref={(el) => {
                    botoes.current.set(`${img.id}:depois`, el);
                  }}
                  onClick={() => mover(img, i, 1)}
                  disabled={desabilitado || i === imagens.length - 1}
                  aria-label={`Mover página ${i + 1} para depois`}
                  title="Mover para depois"
                  className={botaoSeta}
                >
                  <ChevronRight className="h-5 w-5" aria-hidden />
                </button>
              </div>
            </div>
          </li>
        ))}
        {podeAdicionar && !desabilitado && (
          <li className="list-none">
            <button
              type="button"
              onClick={onAdicionar}
              className="flex h-full min-h-44 w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white px-3 py-6 text-sm font-medium text-slate-600 transition hover:border-blue-500 hover:bg-blue-50/50 hover:text-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
            >
              <ImagePlus className="h-7 w-7" aria-hidden />
              Adicionar imagens
            </button>
          </li>
        )}
      </ol>
    </div>
  );
}
