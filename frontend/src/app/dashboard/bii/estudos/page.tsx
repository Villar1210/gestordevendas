// src/app/dashboard/bii/estudos/page.tsx
// Aba "Estudos" do BII (Fatia 5): estudos de terreno salvos + novo estudo.
"use client";

import { Suspense } from "react";
import { EstudosPage } from "@/features/bii/components/estudos/EstudosPage";

export default function BiiEstudosPage() {
  // useSearchParams exige Suspense no build estatico do Next 15
  return (
    <Suspense fallback={null}>
      <EstudosPage />
    </Suspense>
  );
}
