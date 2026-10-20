// src/app/dashboard/bii/historico/[id]/page.tsx
// Analise por endereco salva, aberta a partir do Historico.
"use client";

import { useParams } from "next/navigation";
import { AnaliseSalva } from "@/features/bii/components/endereco/AnaliseSalva";

export default function BiiAnaliseSalvaPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  return <AnaliseSalva id={id} />;
}
