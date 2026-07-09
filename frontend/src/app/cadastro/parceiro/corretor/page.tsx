// src/app/cadastro/parceiro/corretor/page.tsx
"use client";

import { CorretorSignupForm } from "@/features/cadastro-publico/components/CorretorSignupForm";

export default function CadastroParceiroCorretorPage() {
  return (
    <CorretorSignupForm
      tipoPerfil="corretor_parceiro"
      titulo="Cadastro de Corretor Parceiro"
      subtitulo="Corretor autonomo de outra imobiliaria."
      backHref="/cadastro/parceiro"
    />
  );
}
