// src/modules/vivi_sdr/domain/repositories/construtora-do-empreendimento-repository.interface.ts
// Construtoras (Fatia B): a VIVI le a construtora do empreendimento da
// conversa por este repositorio PROPRIO do vivi_sdr (le as tabelas
// empreendimentos/construtoras direto, sem importar o gestao_imobiliaria -
// mesmo padrao de "modulo nao importa modulo" ja usado no BII).

export interface ConstrutoraDoEmpreendimento {
  nome: string;
  sobre: string | null;
  diferenciais: string | null;
}

export interface IConstrutoraDoEmpreendimentoRepository {
  // null = empreendimento inexistente neste tenant ou sem construtora vinculada.
  buscarPorEmpreendimento(tenantId: string, empreendimentoId: string): Promise<ConstrutoraDoEmpreendimento | null>;
}
