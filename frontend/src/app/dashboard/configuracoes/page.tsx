// src/app/dashboard/configuracoes/page.tsx
"use client";

import { useState } from "react";
import { DadosEmpresaTab } from "@/features/configuracoes/components/DadosEmpresaTab";
import { MeuPerfilTab } from "@/features/configuracoes/components/MeuPerfilTab";
import { ContratoTemplateTab } from "@/features/configuracoes/components/ContratoTemplateTab";
import { PermissoesCargosTab } from "@/features/configuracoes/components/PermissoesCargosTab";
import { ConfiguracoesViviTab } from "@/features/configuracoes/components/ConfiguracoesViviTab";

// Fatia 1 (Dados da Empresa, Meu Perfil, Template de Contrato) + Fatia 2
// (Permissoes/Cargos) + Fatia 3 (Configuracoes da VIVI) do Painel
// Administrativo. Abas futuras (Templates de E-mail, Notificacoes) entram
// em fatias seguintes - ver BACKLOG.md.
type AbaPainelAdministrativo =
  | "dados-empresa"
  | "meu-perfil"
  | "permissoes-cargos"
  | "template-contrato"
  | "config-vivi";

const TABS: { id: AbaPainelAdministrativo; label: string; testId: string }[] = [
  { id: "dados-empresa", label: "Dados da Empresa", testId: "tab-dados-empresa" },
  { id: "meu-perfil", label: "Meu Perfil", testId: "tab-meu-perfil" },
  { id: "permissoes-cargos", label: "Permissões/Cargos", testId: "tab-permissoes-cargos" },
  { id: "template-contrato", label: "Template de Contrato", testId: "tab-template-contrato" },
  { id: "config-vivi", label: "Configurações da VIVI", testId: "tab-config-vivi" },
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
        {aba === "permissoes-cargos" && <PermissoesCargosTab />}
        {aba === "template-contrato" && <ContratoTemplateTab />}
        {aba === "config-vivi" && <ConfiguracoesViviTab />}
      </div>
    </div>
  );
}
