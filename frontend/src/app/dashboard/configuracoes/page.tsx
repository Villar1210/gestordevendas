// src/app/dashboard/configuracoes/page.tsx
"use client";

import { useState } from "react";
import { DadosEmpresaTab } from "@/features/configuracoes/components/DadosEmpresaTab";
import { MeuPerfilTab } from "@/features/configuracoes/components/MeuPerfilTab";
import { ContratoTemplateTab } from "@/features/configuracoes/components/ContratoTemplateTab";

// Fatia 1 do Painel Administrativo: 3 abas (Dados da Empresa, Meu Perfil,
// Template de Contrato - migrada de RH/Aprovacoes). Abas futuras
// (Permissoes/Cargos, Configuracoes da VIVI, Templates de E-mail,
// Notificacoes) entram em fatias seguintes - ver BACKLOG.md.
type AbaPainelAdministrativo = "dados-empresa" | "meu-perfil" | "template-contrato";

const TABS: { id: AbaPainelAdministrativo; label: string; testId: string }[] = [
  { id: "dados-empresa", label: "Dados da Empresa", testId: "tab-dados-empresa" },
  { id: "meu-perfil", label: "Meu Perfil", testId: "tab-meu-perfil" },
  { id: "template-contrato", label: "Template de Contrato", testId: "tab-template-contrato" },
];

export default function ConfiguracoesPage() {
  const [aba, setAba] = useState<AbaPainelAdministrativo>("dados-empresa");

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <h1 className="text-lg font-semibold text-slate-800">Painel Administrativo</h1>
        <div className="mt-3 flex rounded-lg border border-slate-200 p-0.5 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setAba(tab.id)}
              data-testid={tab.testId}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                aba === tab.id ? "bg-blue-700 text-white" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      <div className="p-6">
        {aba === "dados-empresa" && <DadosEmpresaTab />}
        {aba === "meu-perfil" && <MeuPerfilTab />}
        {aba === "template-contrato" && <ContratoTemplateTab />}
      </div>
    </div>
  );
}
