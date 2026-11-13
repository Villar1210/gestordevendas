// src/app/dashboard/campanhas/[id]/page.tsx
"use client";

import { useParams } from "next/navigation";
import { CampanhaDetalhePage } from "@/features/campanhas/components/CampanhaDetalhePage";

export default function CampanhaPage() {
  const params = useParams<{ id: string }>();
  return params?.id ? <CampanhaDetalhePage id={params.id} /> : null;
}
