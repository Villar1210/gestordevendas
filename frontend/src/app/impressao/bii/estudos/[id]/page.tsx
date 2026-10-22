// src/app/impressao/bii/estudos/[id]/page.tsx
// Versao para impressao do Estudo de terreno (BII Fatia 5): fora do layout do
// dashboard (sem menu/barra, que cortariam a pagina ao imprimir). So
// Administrador - o guard e conveniencia; a protecao real e o backend.
"use client";

import { useParams } from "next/navigation";
import { SomenteAdminGuard } from "@/features/imoveis/components/SomenteAdminGuard";
import { EstudoImpressao } from "@/features/bii/components/estudos/EstudoImpressao";

export default function ImpressaoEstudoPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === "string" ? params.id : "";
  return (
    <SomenteAdminGuard destino="/dashboard/inicio">
      <EstudoImpressao id={id} />
    </SomenteAdminGuard>
  );
}
