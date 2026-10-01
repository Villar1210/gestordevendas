// src/modules/rh/domain/repositories/contrato-parceria-config-repository.interface.ts
// Camada de DOMINIO: regras de assinatura do contrato de prestacao de
// servico, por empresa (Painel de Configuracao -> "Assinaturas do Contrato").
export interface ContratoParceriaConfigDados {
  assinaturaEmpresaAtiva: boolean;
  representanteNome: string | null;
  representanteEmail: string | null;
  representanteCargo: string | null;
  quantidadeTestemunhas: number;
  testemunha1Nome: string | null;
  testemunha1Email: string | null;
  testemunha2Nome: string | null;
  testemunha2Email: string | null;
  bloquearAcessoAteAssinar: boolean;
  lembretesAtivos: boolean;
  lembreteDias: string;
}

// Sem configuracao salva = comportamento original (so o contratado assina,
// acesso liberado na aprovacao).
export const CONTRATO_PARCERIA_CONFIG_PADRAO: ContratoParceriaConfigDados = {
  assinaturaEmpresaAtiva: false,
  representanteNome: null,
  representanteEmail: null,
  representanteCargo: null,
  quantidadeTestemunhas: 0,
  testemunha1Nome: null,
  testemunha1Email: null,
  testemunha2Nome: null,
  testemunha2Email: null,
  bloquearAcessoAteAssinar: false,
  lembretesAtivos: false,
  lembreteDias: '2,5',
};

export interface IContratoParceriaConfigRepository {
  findByTenantId(tenantId: string): Promise<ContratoParceriaConfigDados | null>;
  upsert(tenantId: string, dados: ContratoParceriaConfigDados): Promise<ContratoParceriaConfigDados>;
}
