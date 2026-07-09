// src/features/imoveis/hooks/useImoveisIntegration.ts
import { useCallback } from "react";
import { apiRequest, ApiError } from "@/core/api/client";
import {
  useImoveisStore,
  Imovel,
  ImovelPhoto,
  Empreendimento,
  Proprietario,
  InquilinoComprador,
  Contrato,
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
  const setProprietarios = useImoveisStore((state) => state.setProprietarios);
  const setInquilinosCompradores = useImoveisStore((state) => state.setInquilinosCompradores);
  const setContratos = useImoveisStore((state) => state.setContratos);
  const setLoading = useImoveisStore((state) => state.setLoading);
  const addImovel = useImoveisStore((state) => state.addImovel);
  const updateImovelInPlace = useImoveisStore((state) => state.updateImovelInPlace);
  const addEmpreendimento = useImoveisStore((state) => state.addEmpreendimento);
  const addProprietario = useImoveisStore((state) => state.addProprietario);
  const updateProprietarioInPlace = useImoveisStore((state) => state.updateProprietarioInPlace);
  const addInquilinoComprador = useImoveisStore((state) => state.addInquilinoComprador);
  const addContrato = useImoveisStore((state) => state.addContrato);
  const updateContratoInPlace = useImoveisStore((state) => state.updateContratoInPlace);
  const closeImovelFormModal = useImoveisStore((state) => state.closeImovelFormModal);
  const closeEmpreendimentoFormModal = useImoveisStore(
    (state) => state.closeEmpreendimentoFormModal,
  );
  const closeProprietarioFormModal = useImoveisStore((state) => state.closeProprietarioFormModal);
  const closeContratoFormModal = useImoveisStore((state) => state.closeContratoFormModal);

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

  return {
    loadImoveis,
    loadEmpreendimentos,
    handleListImoveisByEmpreendimento,
    handleGetImovel,
    handleCreateImovel,
    handleUpdateImovel,
    handleCreateEmpreendimento,
    handleUploadPhoto,
    handleDeletePhoto,
    loadProprietarios,
    loadInquilinosCompradores,
    loadContratos,
    handleCreateProprietario,
    handleUpdateProprietario,
    handleCreateInquilinoComprador,
    handleCreateContrato,
    handleEncerrarContrato,
  };
}
