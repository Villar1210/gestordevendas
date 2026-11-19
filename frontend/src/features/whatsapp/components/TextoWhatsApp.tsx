// src/features/whatsapp/components/TextoWhatsApp.tsx
// Etapa 3 (19/11/2026): mostra o texto como o WhatsApp mostra -
// *negrito*, _italico_, ~riscado~ e quebras de linha - sem asteriscos.
// Monta elementos React (nada de innerHTML): o texto vem do cliente.
import { Fragment, type ReactNode } from "react";

const MARCA = /(\*[^*\n]+\*|_[^_\n]+_|~[^~\n]+~)/g;

export function partesWhatsApp(texto: string): Array<{ tipo: "texto" | "negrito" | "italico" | "riscado"; valor: string }> {
  const partes: Array<{ tipo: "texto" | "negrito" | "italico" | "riscado"; valor: string }> = [];
  let ultimo = 0;
  for (const m of texto.matchAll(MARCA)) {
    const i = m.index ?? 0;
    if (i > ultimo) partes.push({ tipo: "texto", valor: texto.slice(ultimo, i) });
    const bruto = m[0];
    const tipo = bruto[0] === "*" ? "negrito" : bruto[0] === "_" ? "italico" : "riscado";
    partes.push({ tipo, valor: bruto.slice(1, -1) });
    ultimo = i + bruto.length;
  }
  if (ultimo < texto.length) partes.push({ tipo: "texto", valor: texto.slice(ultimo) });
  return partes;
}

export function TextoWhatsApp({ texto }: { texto: string }) {
  const nos: ReactNode[] = partesWhatsApp(texto).map((p, i) =>
    p.tipo === "negrito" ? (
      <strong key={i}>{p.valor}</strong>
    ) : p.tipo === "italico" ? (
      <em key={i}>{p.valor}</em>
    ) : p.tipo === "riscado" ? (
      <s key={i}>{p.valor}</s>
    ) : (
      <Fragment key={i}>{p.valor}</Fragment>
    ),
  );
  return <span className="whitespace-pre-line break-words">{nos}</span>;
}
