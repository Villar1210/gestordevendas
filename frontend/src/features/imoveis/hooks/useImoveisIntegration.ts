// src/features/imoveis/hooks/useImoveisIntegration.ts
import { useCallback } from "react";
import { apiRequest, ApiError } from "@/core/api/client";
import {
  useImoveisStore,
  Imovel,
  ImovelPhoto,
  Empreendimento,
  Tipologia,
  Proprietario,
  InquilinoComprador,
  InquilinoDocumento,
  Contrato,
  LancamentoFinanceiro,
  FinalidadeFilter,
} from "../store/useImoveisStore";

export interface ListImoveisFilters {
  busca?: string;
  finalidade?: FinalidadeFilter;
  status?: string;
  empreendimentoId?: string;
}

export interface CreateImovelInput {
  empreendimentoId?: string;
  title: string;
  codigoInterno?: string;
  tipo: string;
  uso?: string;
  finalidade: string;
  tags?: string;
  price?: number;
  rentPrice?: number;
  area?: number;
  bedrooms?: number;
  bathrooms?: number;
  parkingSpots?: number;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  description?: string;
  status?: string;
  disponivelApartirDe?: string;
  localChaves?: string;
  exclusividade?: boolean;
  proprietarioNome?: string;
  proprietarioTelefone?: string;
}

export type UpdateImovelInput = Partial<CreateImovelInput>;

export interface CreateEmpreendimentoInput {
  name: string;
  rua: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
  description?: string;
}

export interface CreateProprietarioInput {
  nome: string;
  cpfCnpj?: string;
  telefone: string;
  email?: string;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
  banco?: string;
  agencia?: string;
  conta?: string;
  pix?: string;
}

export type UpdateProprietarioInput = Partial<CreateProprietarioInput>;

export interface CreateInquilinoCompradorInput {
  nome: string;
  cpfCnpj?: string;
  telefone: string;
  email?: string;
}

export interface UpdateInquilinoCompradorInput {
  nome?: string;
  cpfCnpj?: string;
  telefone?: string;
  email?: string;
  profissao?: string;
  rendaDeclarada?: number;
  statusAnaliseCredito?: string;
  observacoesAnalise?: string;
}

export interface NovoContratoParteInput {
  nome: string;
  telefone: string;
  cpfCnpj?: string;
  email?: string;
}

export interface CreateContratoInput {
  imovelId: string;
  proprietarioId?: string;
  proprietario?: NovoContratoParteInput;
  inquilinoCompradorId?: string;
  inquilinoComprador?: NovoContratoParteInput;
  tipo: string;
  valor: number;
  dataInicio: string;
  dataFim?: string;
  diaVencimento?: number;
}

export interface CreateLancamentoInput {
  contratoId?: string;
  tipo: string;
  categoria: string;
  valor: number;
  vencimento: string;
  descricao?: string;
}

// Cadastro em Lote de Unidades (Fatia 2b) - espelha o contrato dos 2
// endpoints da Fatia 2a (ver gerar-lote-imoveis.dto.ts / criar-imoveis-lote.dto.ts
// no backend).
export interface UnidadePadraoInput {
  posicao: number;
  tipologia: string;
  area?: number;
  dormitorios?: number;
}

export interface PadraoLoteInput {
  bloco: string;
  andarInicial: number;
  andarFinal: number;
  unidadesPorAndar: UnidadePadraoInput[];
}

export interface UnidadeGeradaLote {
  identificadorExterno: string;
  // Nulos para VAGA_AVULSA (Fatia 3a, importacao de planilha). O gerar-lote
  // manual (Fatia 2b, so gera UNIDADE) nunca produz nulo aqui.
  bloco: string | null;
  andar: number | null;
  numeroNoAndar: number | null;
  title: string;
  tipo: string;
  finalidade: string;
  status: string;
  tipoItem: string;
  enquadramento: string;
  pcd: boolean;
  area: number | null;
  bedrooms: number | null;
  vagasIncluidas: number;
  // Preenchidos so pela importacao de planilha (Fatia 3a/3b) - o gerar-lote
  // manual nunca os popula (o usuario preenche depois no grid).
  valorTabela?: number | null;
  valorComDesconto?: number | null;
  // Record<string, unknown> (nao { tipologia: string } fixo) porque a
  // importacao de planilha pode gerar uma unidade sem coluna TIPOLOGIA.
  customFields: Record<string, unknown>;
  identificadorJaExiste: boolean;
}

export interface GerarLoteResult {
  unidades: UnidadeGeradaLote[];
  identificadoresDuplicados: string[];
}

// Importacao de planilha (Fatia 3a/3b) - mesmo formato do GerarLoteResult +
// as linhas que falharam no parsing.
export interface LinhaPlanilhaErro {
  linha: number;
  identificador: string;
  motivo: string;
}

export interface ImportarPlanilhaResult extends GerarLoteResult {
  erros: LinhaPlanilhaErro[];
}

export interface CriarImovelLoteItemInput {
  title: string;
  tipo: string;
  finalidade: string;
  status?: string;
  tipoItem?: string;
  identificadorExterno?: string;
  bloco?: string;
  andar?: number;
  numeroNoAndar?: number;
  enquadramento?: string;
  pcd?: boolean;
  valorTabela?: number;
  valorComDesconto?: number;
  vagasIncluidas?: number;
  area?: number;
  bedrooms?: number;
  customFields?: Record<string, unknown>;
}

// Fatia 4 (Revisao e Publicacao) - resposta de GET /empreendimentos/:id.
export interface EmpreendimentoDetail {
  empreendimento: Empreendimento;
  tipologias: Tipologia[];
  unidadesCadastradas: number;
}

export interface TipologiaInput {
  nome: string;
  areaPrivativa?: number | null;
  dormitorios?: number | null;
}

// Fatia 4 - edicao inline da ficha tecnica JA confirmada ao menos uma vez
// via PDF (origemImportacao="ia_pdf"). Reaproveita o mesmo endpoint da
// Fatia 3c (POST .../confirmar-ficha-tecnica) - nome/endereco do
// Empreendimento nao entram aqui de proposito (esse endpoint nunca mexe
// neles, ver ConfirmarFichaTecnicaUseCase no backend).
export interface ConfirmarFichaTecnicaInput {
  descricao?: string | null;
  areaTerreno?: number | null;
  totalUnidades?: number | null;
  numeroTorres?: number | null;
  unidadesPorAndar?: number | null;
  gabarito?: number | null;
  vagas?: number | null;
  itensLazer: string[];
  tipologias: TipologiaInput[];
}

export interface ListLancamentosFilters {
  tipo?: string;
  status?: string;
  contratoId?: string;
  vencimentoDe?: string;
  vencimentoAte?: string;
}

function buildLancamentosQueryString(filters?: ListLancamentosFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.tipo) params.set("tipo", filters.tipo);
  if (filters.status) params.set("status", filters.status);
  if (filters.contratoId) params.set("contratoId", filters.contratoId);
  if (filters.vencimentoDe) params.set("vencimentoDe", filters.vencimentoDe);
  if (filters.vencimentoAte) params.set("vencimentoAte", filters.vencimentoAte);
  const query = params.toString();
  return query ? `?${query}` : "";
}

function buildQueryString(filters?: ListImoveisFilters): string {
  if (!filters) return "";
  const params = new URLSearchParams();
  if (filters.busca?.trim()) params.set("busca", filters.busca.trim());
  if (filters.finalidade && filters.finalidade !== "all") {
    params.set("finalidade", filters.finalidade);
  }
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.empreendimentoId && filters.empreendimentoId !== "all") {
    params.set("empreendimentoId", filters.empreendimentoId);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function useImoveisIntegration() {
  const setImoveis = useImoveisStore((state) => state.setImoveis);
  const setEmpreendimentos = useImoveisStore((state) => state.setEmpreendimentos);
  const setEmpreendimentosPublicados = useImoveisStore(
    (state) => state.setEmpreendimentosPublicados,
  );
  const setProprietarios = useImoveisStore((state) => state.setProprietarios);
  const setInquilinosCompradores = useImoveisStore((state) => state.setInquilinosCompradores);
  const setContratos = useImoveisStore((state) => state.setContratos);
  const setLoading = useImoveisStore((state) => state.setLoading);
  const addImovel = useImoveisStore((state) => state.addImovel);
  const updateImovelInPlace = useImoveisStore((state) => state.updateImovelInPlace);
  const addEmpreendimento = useImoveisStore((state) => state.addEmpreendimento);
  const updateEmpreendimentoInPlace = useImoveisStore((state) => state.updateEmpreendimentoInPlace);
  const addProprietario = useImoveisStore((state) => state.addProprietario);
  const updateProprietarioInPlace = useImoveisStore((state) => state.updateProprietarioInPlace);
  const addInquilinoComprador = useImoveisStore((state) => state.addInquilinoComprador);
  const updateInquilinoCompradorInPlace = useImoveisStore(
    (state) => state.updateInquilinoCompradorInPlace,
  );
  const addContrato = useImoveisStore((state) => state.addContrato);
  const updateContratoInPlace = useImoveisStore((state) => state.updateContratoInPlace);
  const setLancamentos = useImoveisStore((state) => state.setLancamentos);
  const addLancamento = useImoveisStore((state) => state.addLancamento);
  const updateLancamentoInPlace = useImoveisStore((state) => state.updateLancamentoInPlace);
  const closeImovelFormModal = useImoveisStore((state) => state.closeImovelFormModal);
  const closeEmpreendimentoFormModal = useImoveisStore(
    (state) => state.closeEmpreendimentoFormModal,
  );
  const closeProprietarioFormModal = useImoveisStore((state) => state.closeProprietarioFormModal);
  const closeContratoFormModal = useImoveisStore((state) => state.closeContratoFormModal);
  const closeLancamentoFormModal = useImoveisStore((state) => state.closeLancamentoFormModal);

  const loadImoveis = useCallback(
    async (filters?: ListImoveisFilters) => {
      setLoading(true);
      try {
        const imoveis = await apiRequest<Imovel[]>(`/imoveis${buildQueryString(filters)}`);
        setImoveis(imoveis);
      } finally {
        setLoading(false);
      }
    },
    [setImoveis, setLoading],
  );

  const loadEmpreendimentos = useCallback(async () => {
    const empreendimentos = await apiRequest<Empreendimento[]>("/empreendimentos");
    setEmpreendimentos(empreendimentos);
  }, [setEmpreendimentos]);

  // Fatia 4: usado exclusivamente pelo Espelho de Vendas - filtro
  // publicado=true aplicado no BACKEND (nao so no frontend), para que uma
  // chamada direta a API com esse mesmo parametro tambem nunca devolva
  // empreendimentos pendentes de revisao.
  const loadEmpreendimentosPublicados = useCallback(async () => {
    const empreendimentos = await apiRequest<Empreendimento[]>("/empreendimentos?publicado=true");
    setEmpreendimentosPublicados(empreendimentos);
  }, [setEmpreendimentosPublicados]);

  // Usado pelo Espelho de Vendas: busca as unidades de um empreendimento sem
  // afetar a lista filtrada do Catalogo (estado local do componente, nao a store).
  const handleListImoveisByEmpreendimento = useCallback(async (empreendimentoId: string) => {
    try {
      return await apiRequest<Imovel[]>(`/imoveis?empreendimentoId=${empreendimentoId}`);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar as unidades.");
      return [];
    }
  }, []);

  const handleGetImovel = useCallback(async (imovelId: string) => {
    try {
      return await apiRequest<Imovel>(`/imoveis/${imovelId}`);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar o imovel.");
      return null;
    }
  }, []);

  const handleCreateImovel = useCallback(
    async (input: CreateImovelInput) => {
      try {
        const imovel = await apiRequest<Imovel>("/imoveis", {
          method: "POST",
          body: JSON.stringify(input),
        });
        addImovel(imovel);
        closeImovelFormModal();
        return imovel;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel criar o imovel.");
        return null;
      }
    },
    [addImovel, closeImovelFormModal],
  );

  const handleUpdateImovel = useCallback(
    async (imovelId: string, input: UpdateImovelInput) => {
      try {
        const imovel = await apiRequest<Imovel>(`/imoveis/${imovelId}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        });
        updateImovelInPlace(imovel);
        return imovel;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel salvar o imovel.");
        return null;
      }
    },
    [updateImovelInPlace],
  );

  // Cadastro em Lote de Unidades (Fatia 2b).
  const handleGerarLoteImoveis = useCallback(
    async (empreendimentoId: string, padrao: PadraoLoteInput) => {
      try {
        return await apiRequest<GerarLoteResult>(
          `/empreendimentos/${empreendimentoId}/imoveis/gerar-lote`,
          { method: "POST", body: JSON.stringify(padrao) },
        );
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel gerar as unidades.");
        return null;
      }
    },
    [],
  );

  // Diferente dos demais handlers deste hook: NAO engole o erro com alert()
  // e nao retorna null - deixa o ApiError propagar. A tela de Cadastro em
  // Lote (fatia 2b) precisa diferenciar uma colisao de identificador (409,
  // com a lista exata em err.body.identificadoresColidindo) de qualquer
  // outro erro, e manter o grid preenchido em vez de resetar - o caller e
  // quem decide como exibir cada caso.
  const handleCriarImoveisLote = useCallback(
    async (
      empreendimentoId: string,
      imoveis: CriarImovelLoteItemInput[],
      origemImportacao?: string,
    ) => {
      const result = await apiRequest<{ imoveis: Imovel[] }>(
        `/empreendimentos/${empreendimentoId}/imoveis/lote`,
        { method: "POST", body: JSON.stringify({ imoveis, origemImportacao }) },
      );
      return result.imoveis;
    },
    [],
  );

  // Importacao de planilha (Fatia 3b) - passo 1: le o arquivo e devolve os
  // valores distintos da coluna PRODUTO, para o usuario escolher qual
  // corresponde ao empreendimento atual antes de pedir o preview filtrado.
  const handleListarProdutosPlanilha = useCallback(
    async (empreendimentoId: string, file: File) => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        const result = await apiRequest<{ produtos: string[] }>(
          `/empreendimentos/${empreendimentoId}/imoveis/listar-produtos-planilha`,
          { method: "POST", body: formData },
        );
        return result.produtos;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel ler a planilha.");
        return null;
      }
    },
    [],
  );

  // Importacao de planilha (Fatia 3b) - passo 2: preview filtrado pelo
  // produto escolhido, no mesmo formato do gerar-lote manual + erros de
  // parsing.
  const handleImportarPlanilhaImoveis = useCallback(
    async (empreendimentoId: string, file: File, produto: string) => {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("produto", produto);
        return await apiRequest<ImportarPlanilhaResult>(
          `/empreendimentos/${empreendimentoId}/imoveis/importar-planilha`,
          { method: "POST", body: formData },
        );
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel importar a planilha.");
        return null;
      }
    },
    [],
  );

  const handleCreateEmpreendimento = useCallback(
    async (input: CreateEmpreendimentoInput) => {
      try {
        const empreendimento = await apiRequest<Empreendimento>("/empreendimentos", {
          method: "POST",
          body: JSON.stringify(input),
        });
        addEmpreendimento(empreendimento);
        closeEmpreendimentoFormModal();
        return empreendimento;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel criar o empreendimento.");
        return null;
      }
    },
    [addEmpreendimento, closeEmpreendimentoFormModal],
  );

  // Fatia 4 (tela de Revisao e Publicacao) - detalhe de 1 empreendimento.
  // Diferente da maioria dos handlers deste hook, NAO engole o erro com
  // alert(): a pagina de detalhe precisa distinguir "nao encontrado" (404,
  // ex: id invalido na URL) de qualquer outro erro para mostrar um estado
  // vazio claro, em vez de um alert generico.
  const handleGetEmpreendimentoDetail = useCallback(async (empreendimentoId: string) => {
    return apiRequest<EmpreendimentoDetail>(`/empreendimentos/${empreendimentoId}`);
  }, []);

  const handlePublicarEmpreendimento = useCallback(
    async (empreendimentoId: string) => {
      try {
        const empreendimento = await apiRequest<Empreendimento>(
          `/empreendimentos/${empreendimentoId}/publicar`,
          { method: "PATCH" },
        );
        updateEmpreendimentoInPlace(empreendimento);
        return empreendimento;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel publicar o empreendimento.");
        return null;
      }
    },
    [updateEmpreendimentoInPlace],
  );

  const handleDespublicarEmpreendimento = useCallback(
    async (empreendimentoId: string) => {
      try {
        const empreendimento = await apiRequest<Empreendimento>(
          `/empreendimentos/${empreendimentoId}/despublicar`,
          { method: "PATCH" },
        );
        updateEmpreendimentoInPlace(empreendimento);
        return empreendimento;
      } catch (err) {
        alert(
          err instanceof ApiError ? err.message : "Nao foi possivel despublicar o empreendimento.",
        );
        return null;
      }
    },
    [updateEmpreendimentoInPlace],
  );

  const handleConfirmarFichaTecnica = useCallback(
    async (empreendimentoId: string, input: ConfirmarFichaTecnicaInput) => {
      try {
        const result = await apiRequest<{ empreendimento: Empreendimento; tipologias: Tipologia[] }>(
          `/empreendimentos/${empreendimentoId}/confirmar-ficha-tecnica`,
          { method: "POST", body: JSON.stringify(input) },
        );
        updateEmpreendimentoInPlace(result.empreendimento);
        return result;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel salvar a ficha tecnica.");
        return null;
      }
    },
    [updateEmpreendimentoInPlace],
  );

  const handleUploadPhoto = useCallback(async (imovelId: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      return await apiRequest<ImovelPhoto>(`/imoveis/${imovelId}/photos`, {
        method: "POST",
        body: formData,
      });
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel enviar a foto.");
      return null;
    }
  }, []);

  const handleDeletePhoto = useCallback(async (imovelId: string, photoId: string) => {
    try {
      await apiRequest(`/imoveis/${imovelId}/photos/${photoId}`, { method: "DELETE" });
      return true;
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel remover a foto.");
      return false;
    }
  }, []);

  const loadProprietarios = useCallback(async () => {
    const proprietarios = await apiRequest<Proprietario[]>("/proprietarios");
    setProprietarios(proprietarios);
  }, [setProprietarios]);

  const loadInquilinosCompradores = useCallback(async () => {
    const inquilinosCompradores = await apiRequest<InquilinoComprador[]>(
      "/inquilinos-compradores",
    );
    setInquilinosCompradores(inquilinosCompradores);
  }, [setInquilinosCompradores]);

  const loadContratos = useCallback(async () => {
    setLoading(true);
    try {
      const contratos = await apiRequest<Contrato[]>("/contratos");
      setContratos(contratos);
    } finally {
      setLoading(false);
    }
  }, [setContratos, setLoading]);

  const handleCreateProprietario = useCallback(
    async (input: CreateProprietarioInput) => {
      try {
        const proprietario = await apiRequest<Proprietario>("/proprietarios", {
          method: "POST",
          body: JSON.stringify(input),
        });
        addProprietario(proprietario);
        closeProprietarioFormModal();
        return proprietario;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel criar o proprietario.");
        return null;
      }
    },
    [addProprietario, closeProprietarioFormModal],
  );

  const handleUpdateProprietario = useCallback(
    async (proprietarioId: string, input: UpdateProprietarioInput) => {
      try {
        const proprietario = await apiRequest<Proprietario>(`/proprietarios/${proprietarioId}`, {
          method: "PATCH",
          body: JSON.stringify(input),
        });
        updateProprietarioInPlace(proprietario);
        return proprietario;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel salvar o proprietario.");
        return null;
      }
    },
    [updateProprietarioInPlace],
  );

  const handleCreateInquilinoComprador = useCallback(
    async (input: CreateInquilinoCompradorInput) => {
      try {
        const inquilinoComprador = await apiRequest<InquilinoComprador>(
          "/inquilinos-compradores",
          { method: "POST", body: JSON.stringify(input) },
        );
        addInquilinoComprador(inquilinoComprador);
        return inquilinoComprador;
      } catch (err) {
        alert(
          err instanceof ApiError ? err.message : "Nao foi possivel criar o inquilino/comprador.",
        );
        return null;
      }
    },
    [addInquilinoComprador],
  );

  const handleUpdateInquilinoComprador = useCallback(
    async (inquilinoId: string, input: UpdateInquilinoCompradorInput) => {
      try {
        const inquilinoComprador = await apiRequest<InquilinoComprador>(
          `/inquilinos-compradores/${inquilinoId}`,
          { method: "PATCH", body: JSON.stringify(input) },
        );
        updateInquilinoCompradorInPlace(inquilinoComprador);
        return inquilinoComprador;
      } catch (err) {
        alert(
          err instanceof ApiError ? err.message : "Nao foi possivel salvar o inquilino/comprador.",
        );
        return null;
      }
    },
    [updateInquilinoCompradorInPlace],
  );

  const handleListInquilinoDocumentos = useCallback(async (inquilinoId: string) => {
    try {
      return await apiRequest<InquilinoDocumento[]>(
        `/inquilinos-compradores/${inquilinoId}/documentos`,
      );
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar os documentos.");
      return [];
    }
  }, []);

  const handleUploadInquilinoDocumento = useCallback(
    async (inquilinoId: string, tipo: string, file: File) => {
      try {
        const formData = new FormData();
        formData.append("tipo", tipo);
        formData.append("file", file);
        return await apiRequest<InquilinoDocumento>(
          `/inquilinos-compradores/${inquilinoId}/documentos`,
          { method: "POST", body: formData },
        );
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel enviar o documento.");
        return null;
      }
    },
    [],
  );

  const handleDeleteInquilinoDocumento = useCallback(
    async (inquilinoId: string, documentoId: string) => {
      try {
        await apiRequest(`/inquilinos-compradores/${inquilinoId}/documentos/${documentoId}`, {
          method: "DELETE",
        });
        return true;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel remover o documento.");
        return false;
      }
    },
    [],
  );

  const handleCreateContrato = useCallback(
    async (input: CreateContratoInput) => {
      try {
        const contrato = await apiRequest<Contrato>("/contratos", {
          method: "POST",
          body: JSON.stringify(input),
        });
        addContrato(contrato);
        closeContratoFormModal();
        // O status do Imovel muda automaticamente no backend
        // (vendido/ocupado) - busca o registro atualizado para refletir na UI.
        const imovel = await handleGetImovel(input.imovelId);
        if (imovel) updateImovelInPlace(imovel);
        // Se o proprietario e/ou inquilino/comprador foram criados na hora
        // (dados inline, nao um ID existente), o backend os criou junto com
        // o contrato - a lista local ainda nao os conhece. Recarrega para o
        // nome aparecer certo na tabela em vez de "-".
        if (input.proprietario) await loadProprietarios();
        if (input.inquilinoComprador) await loadInquilinosCompradores();
        return contrato;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel criar o contrato.");
        return null;
      }
    },
    [
      addContrato,
      closeContratoFormModal,
      handleGetImovel,
      updateImovelInPlace,
      loadProprietarios,
      loadInquilinosCompradores,
    ],
  );

  const handleEncerrarContrato = useCallback(
    async (contratoId: string, imovelId: string) => {
      try {
        const contrato = await apiRequest<Contrato>(`/contratos/${contratoId}/encerrar`, {
          method: "POST",
        });
        updateContratoInPlace(contrato);
        // Mesmo motivo do handleCreateContrato: o status do Imovel volta
        // automaticamente (disponivel/vago) no backend.
        const imovel = await handleGetImovel(imovelId);
        if (imovel) updateImovelInPlace(imovel);
        return contrato;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel encerrar o contrato.");
        return null;
      }
    },
    [updateContratoInPlace, handleGetImovel, updateImovelInPlace],
  );

  const loadLancamentos = useCallback(
    async (filters?: ListLancamentosFilters) => {
      setLoading(true);
      try {
        const lancamentos = await apiRequest<LancamentoFinanceiro[]>(
          `/financeiro/lancamentos${buildLancamentosQueryString(filters)}`,
        );
        setLancamentos(lancamentos);
      } finally {
        setLoading(false);
      }
    },
    [setLancamentos, setLoading],
  );

  const handleCreateLancamento = useCallback(
    async (input: CreateLancamentoInput) => {
      try {
        const lancamento = await apiRequest<LancamentoFinanceiro>("/financeiro/lancamentos", {
          method: "POST",
          body: JSON.stringify(input),
        });
        addLancamento(lancamento);
        closeLancamentoFormModal();
        return lancamento;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel criar o lancamento.");
        return null;
      }
    },
    [addLancamento, closeLancamentoFormModal],
  );

  const handleMarcarComoPago = useCallback(
    async (lancamentoId: string) => {
      try {
        const lancamento = await apiRequest<LancamentoFinanceiro>(
          `/financeiro/lancamentos/${lancamentoId}/marcar-pago`,
          { method: "POST" },
        );
        updateLancamentoInPlace(lancamento);
        return lancamento;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel marcar como pago.");
        return null;
      }
    },
    [updateLancamentoInPlace],
  );

  const handleGerarCobrancasDoMes = useCallback(async () => {
    try {
      const result = await apiRequest<{ criados: number }>("/financeiro/gerar-cobrancas-mes", {
        method: "POST",
      });
      await loadLancamentos();
      return result;
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel gerar as cobrancas do mes.");
      return null;
    }
  }, [loadLancamentos]);

  return {
    loadImoveis,
    loadEmpreendimentos,
    loadEmpreendimentosPublicados,
    handleListImoveisByEmpreendimento,
    handleGetImovel,
    handleCreateImovel,
    handleUpdateImovel,
    handleCreateEmpreendimento,
    handleGetEmpreendimentoDetail,
    handlePublicarEmpreendimento,
    handleDespublicarEmpreendimento,
    handleConfirmarFichaTecnica,
    handleGerarLoteImoveis,
    handleCriarImoveisLote,
    handleListarProdutosPlanilha,
    handleImportarPlanilhaImoveis,
    handleUploadPhoto,
    handleDeletePhoto,
    loadProprietarios,
    loadInquilinosCompradores,
    loadContratos,
    handleCreateProprietario,
    handleUpdateProprietario,
    handleCreateInquilinoComprador,
    handleUpdateInquilinoComprador,
    handleListInquilinoDocumentos,
    handleUploadInquilinoDocumento,
    handleDeleteInquilinoDocumento,
    handleCreateContrato,
    handleEncerrarContrato,
    loadLancamentos,
    handleCreateLancamento,
    handleMarcarComoPago,
    handleGerarCobrancasDoMes,
  };
}
