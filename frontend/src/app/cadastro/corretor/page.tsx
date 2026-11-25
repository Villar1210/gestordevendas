// src/app/cadastro/corretor/page.tsx
// 25/11/2026: o cadastro de corretor da equipe passou a ser a ficha completa
// (RH). Mantida esta rota para links antigos.
"use client";

import { CadastroEquipeForm } from "@/features/cadastro-equipe/components/CadastroEquipeForm";

export default function CadastroCorretorPage() {
  return <CadastroEquipeForm />;
}
