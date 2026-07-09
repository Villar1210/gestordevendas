// src/app/cadastro/corretor/page.tsx
"use client";

import { CorretorSignupForm } from "@/features/cadastro-publico/components/CorretorSignupForm";

export default function CadastroCorretorPage() {
  return (
    <CorretorSignupForm
      tipoPerfil="corretor_house"
      titulo="Cadastro de Corretor"
      subtitulo="Quero fazer parte da equipe de corretores."
      backHref="/cadastro"
    />
  );
}
