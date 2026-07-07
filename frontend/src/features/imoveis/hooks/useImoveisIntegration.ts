// src/features/imoveis/hooks/useImoveisIntegration.ts
import { useCallback } from "react";
import { apiRequest, ApiError } from "@/core/api/client";
import {
  useImoveisStore,
  Imovel,
  ImovelPhoto,
  Empreendimento,
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
  const setLoading = useImoveisStore((state) => state.setLoading);
  const addImovel = useImoveisStore((state) => state.addImovel);
  const updateImovelInPlace = useImoveisStore((state) => state.updateImovelInPlace);
  const addEmpreendimento = useImoveisStore((state) => state.addEmpreendimento);
  const closeImovelFormModal = useImoveisStore((state) => state.closeImovelFormModal);
  const closeEmpreendimentoFormModal = useImoveisStore(
    (state) => state.closeEmpreendimentoFormModal,
  );

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
  };
}
