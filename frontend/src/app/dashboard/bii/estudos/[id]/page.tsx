// src/app/dashboard/bii/estudos/[id]/page.tsx
// Estudo de terreno salvo (BII Fatia 5).
"use client";

import { useParams } from "next/navigation";
import { EstudoDetalhe } from "@/features/bii/components/estudos/EstudoDetalhe";

export default function BiiEstudoPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  return <EstudoDetalhe id={id} />;
}
