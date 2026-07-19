// src/features/configuracoes/components/PainelConfiguracaoTab.tsx
// Reestruturacao de menu: o antigo "Painel Administrativo" (pagina propria
// em /dashboard/configuracoes) foi renomeado para "Painel de Configuracao"
// e movido pra dentro do modulo RH, como a 3a aba de
// /dashboard/rh/aprovacoes (ao lado de Pendentes/Aprovados) - ver
// app/dashboard/rh/aprovacoes/page.tsx. Este componente e so o conteudo
// (sub-abas + telas) - o cabecalho/titulo agora e responsabilidade da
// pagina de RH que o hospeda.
"use client";

import { useState } from "react";
import { DadosEmpresaTab } from "./DadosEmpresaTab";
import { MeuPerfilTab } from "./MeuPerfilTab";
import { ContratoTemplateTab } from "./ContratoTemplateTab";
import { PermissoesCargosTab } from "./PermissoesCargosTab";
import { ConfiguracoesViviTab } from "./ConfiguracoesViviTab";
import { EmailTemplatesTab } from "./EmailTemplatesTab";
import { StandsPlantaoTab } from "./StandsPlantaoTab";

type AbaPainelConfiguracao =
  | "dados-empresa"
  | "meu-perfil"
  | "permissoes-cargos"
  | "template-contrato"
  | "config-vivi"
  | "templates-email"
  | "stands-plantao";

const TABS: { id: AbaPainelConfiguracao; label: string; testId: string }[] = [
  { id: "dados-empresa", label: "Dados da Empresa", testId: "tab-dados-empresa" },
  { id: "meu-perfil", label: "Meu Perfil", testId: "tab-meu-perfil" },
  { id: "permissoes-cargos", label: "Permissões/Cargos", testId: "tab-permissoes-cargos" },
  { id: "template-contrato", label: "Template de Contrato", testId: "tab-template-contrato" },
  { id: "config-vivi", label: "Configurações da VIVI", testId: "tab-config-vivi" },
  { id: "templates-email", label: "Templates de E-mail", testId: "tab-templates-email" },
  { id: "stands-plantao", label: "Stands/Plantão", testId: "tab-stands-plantao" },
];

export function PainelConfiguracaoTab() {
  const [aba, setAba] = useState<AbaPainelConfiguracao>("dados-empresa");

  return (
    <div>
      <div className="mb-6 flex rounded-lg border border-slate-200 p-0.5 w-fit">
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

      {aba === "dados-empresa" && <DadosEmpresaTab />}
      {aba === "meu-perfil" && <MeuPerfilTab />}
      {aba === "permissoes-cargos" && <PermissoesCargosTab />}
      {aba === "template-contrato" && <ContratoTemplateTab />}
      {aba === "config-vivi" && <ConfiguracoesViviTab />}
      {aba === "templates-email" && <EmailTemplatesTab />}
      {aba === "stands-plantao" && <StandsPlantaoTab />}
    </div>
  );
}
