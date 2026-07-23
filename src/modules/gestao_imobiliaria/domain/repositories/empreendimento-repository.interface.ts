// src/modules/gestao_imobiliaria/domain/repositories/empreendimento-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.

export interface EmpreendimentoRecord {
  id: string;
  tenantId: string;
  name: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  description: string | null;
  createdAt: Date;
  // Fatia 1 (schema) + Fatia 3a (importacao de planilha, primeiro consumidor
  // real): publicado controla se o empreendimento aparece no site publico
  // (fora do escopo ainda); origemImportacao registra como os dados
  // chegaram (ex: "planilha") - nulo para empreendimentos cadastrados a mao.
  publicado: boolean;
  origemImportacao: string | null;
  // Ficha tecnica (Fatia 3c) - preenchidos so pelo fluxo de importacao de
  // PDF (ConfirmarFichaTecnicaUseCase), nulos/vazio ate la.
  areaTerreno: number | null;
  totalUnidades: number | null;
  numeroTorres: number | null;
  unidadesPorAndar: number | null;
  gabarito: number | null;
  vagas: number | null;
  itensLazer: string[];
}

export interface FichaTecnicaPatch {
  description?: string | null;
  areaTerreno?: number | null;
  totalUnidades?: number | null;
  numeroTorres?: number | null;
  unidadesPorAndar?: number | null;
  gabarito?: number | null;
  vagas?: number | null;
  itensLazer?: string[];
  origemImportacao?: string | null;
}

export interface IEmpreendimentoRepository {
  create(input: {
    tenantId: string;
    name: string;
    rua: string;
    numero: string;
    bairro: string;
    cidade: string;
    uf: string;
    cep: string;
    description?: string | null;
  }): Promise<EmpreendimentoRecord>;
  findByIdAndTenant(id: string, tenantId: string): Promise<EmpreendimentoRecord | null>;
  // filters.publicado opcional (Fatia 4): ausente = todos (Catalogo/Cadastro
  // em Lote, que precisam ver tambem os pendentes); true = so publicados
  // (Espelho de Vendas, ver EspelhoDeVendas.tsx no frontend).
  findAllByTenant(tenantId: string, filters?: { publicado?: boolean }): Promise<EmpreendimentoRecord[]>;
  update(
    id: string,
    patch: { publicado?: boolean; origemImportacao?: string | null },
  ): Promise<EmpreendimentoRecord>;
  // Fatia 3c: grava os campos da ficha tecnica extraida/revisada. Separado
  // de update() acima (que so mexe em publicado/origemImportacao) para nao
  // misturar o contrato ja usado pelo fluxo de planilha (Fatia 3a) com o
  // novo conjunto de campos desta fatia.
  updateFichaTecnica(id: string, patch: FichaTecnicaPatch): Promise<EmpreendimentoRecord>;
}
