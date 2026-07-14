// src/features/atendimento/hooks/useAtendimentoIntegration.ts
import { useCallback } from "react";
import { apiRequest, ApiError } from "@/core/api/client";
import {
  useAtendimentoStore,
  Atendimento,
  Fila,
  AtendimentoEvento,
  AtendimentoMensagem,
} from "../store/useAtendimentoStore";

interface ListAtendimentosFilter {
  filaId?: string;
  status?: string;
  ownerId?: string;
}

export function useAtendimentoIntegration() {
  const setAtendimentos = useAtendimentoStore((state) => state.setAtendimentos);
  const setFilas = useAtendimentoStore((state) => state.setFilas);
  const updateAtendimentoInPlace = useAtendimentoStore((state) => state.updateAtendimentoInPlace);
  const setDetail = useAtendimentoStore((state) => state.setDetail);
  const setLoadingList = useAtendimentoStore((state) => state.setLoadingList);
  const setLoadingDetail = useAtendimentoStore((state) => state.setLoadingDetail);

  const loadAtendimentos = useCallback(
    async (filter?: ListAtendimentosFilter) => {
      setLoadingList(true);
      try {
        const params = new URLSearchParams();
        if (filter?.filaId) params.set("filaId", filter.filaId);
        if (filter?.status) params.set("status", filter.status);
        if (filter?.ownerId) params.set("ownerId", filter.ownerId);
        const query = params.toString();
        const atendimentos = await apiRequest<Atendimento[]>(
          `/atendimentos${query ? `?${query}` : ""}`,
        );
        setAtendimentos(atendimentos);
      } finally {
        setLoadingList(false);
      }
    },
    [setAtendimentos, setLoadingList],
  );

  const loadFilas = useCallback(async () => {
    try {
      const filas = await apiRequest<Fila[]>("/filas");
      setFilas(filas);
      return filas;
    } catch {
      return [];
    }
  }, [setFilas]);

  const loadAtendimentoDetail = useCallback(
    // silent=true (usado pelo poll em segundo plano, ver page.tsx) NAO
    // aciona isLoadingDetail - o painel de chat troca todo o conteudo por
    // um spinner enquanto essa flag fica true (ver AtendimentoChatPanel),
    // entao acionar isso a cada 5s piscava a tela inteira mesmo sem
    // nenhuma mensagem nova. So a troca manual de atendimento (handleSelect)
    // deve bloquear a tela com o spinner de carregamento inicial.
    async (atendimentoId: string, silent = false) => {
      if (!silent) setLoadingDetail(true);
      try {
        const result = await apiRequest<{
          atendimento: Atendimento;
          eventos: AtendimentoEvento[];
          mensagens: AtendimentoMensagem[];
        }>(`/atendimentos/${atendimentoId}`);
        setDetail(result.eventos, result.mensagens);
        updateAtendimentoInPlace(result.atendimento);
        return result;
      } catch (err) {
        if (!silent) {
          alert(err instanceof ApiError ? err.message : "Nao foi possivel carregar o atendimento.");
        }
        return null;
      } finally {
        if (!silent) setLoadingDetail(false);
      }
    },
    [setDetail, setLoadingDetail, updateAtendimentoInPlace],
  );

  const handleAssign = useCallback(
    async (atendimentoId: string) => {
      try {
        const updated = await apiRequest<Atendimento>(`/atendimentos/${atendimentoId}/assign`, {
          method: "POST",
        });
        updateAtendimentoInPlace(updated);
        return updated;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel assumir o atendimento.");
        return null;
      }
    },
    [updateAtendimentoInPlace],
  );

  const handleTransfer = useCallback(
    async (atendimentoId: string, input: { filaId?: string; ownerId?: string }) => {
      try {
        const updated = await apiRequest<Atendimento>(`/atendimentos/${atendimentoId}/transfer`, {
          method: "POST",
          body: JSON.stringify(input),
        });
        updateAtendimentoInPlace(updated);
        return updated;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel transferir o atendimento.");
        return null;
      }
    },
    [updateAtendimentoInPlace],
  );

  const handleRequeue = useCallback(
    async (atendimentoId: string) => {
      try {
        const updated = await apiRequest<Atendimento>(`/atendimentos/${atendimentoId}/requeue`, {
          method: "POST",
        });
        updateAtendimentoInPlace(updated);
        return updated;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel devolver o atendimento.");
        return null;
      }
    },
    [updateAtendimentoInPlace],
  );

  const handleClose = useCallback(
    async (atendimentoId: string, motivo?: string) => {
      try {
        const updated = await apiRequest<Atendimento>(`/atendimentos/${atendimentoId}/close`, {
          method: "POST",
          body: JSON.stringify({ motivo }),
        });
        updateAtendimentoInPlace(updated);
        return updated;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel fechar o atendimento.");
        return null;
      }
    },
    [updateAtendimentoInPlace],
  );

  const handleAddNota = useCallback(async (atendimentoId: string, texto: string) => {
    try {
      await apiRequest(`/atendimentos/${atendimentoId}/nota`, {
        method: "POST",
        body: JSON.stringify({ texto }),
      });
      return true;
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel adicionar a nota.");
      return false;
    }
  }, []);

  const handleEnviarMensagem = useCallback(async (atendimentoId: string, body: string) => {
    try {
      await apiRequest(`/atendimentos/${atendimentoId}/enviar-mensagem`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      return true;
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel enviar a mensagem.");
      return false;
    }
  }, []);

  const handleCreateFila = useCallback(
    async (nome: string, descricao?: string) => {
      try {
        const fila = await apiRequest<Fila>("/filas", {
          method: "POST",
          body: JSON.stringify({ nome, descricao }),
        });
        await loadFilas();
        return fila;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel criar a fila.");
        return null;
      }
    },
    [loadFilas],
  );

  const handleAddUsuarioToFila = useCallback(
    async (filaId: string, userId: string) => {
      try {
        await apiRequest(`/filas/${filaId}/usuarios`, {
          method: "POST",
          body: JSON.stringify({ userId }),
        });
        await loadFilas();
        return true;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel vincular o usuario.");
        return false;
      }
    },
    [loadFilas],
  );

  const handleRemoveUsuarioFromFila = useCallback(
    async (filaId: string, userId: string) => {
      try {
        await apiRequest(`/filas/${filaId}/usuarios/${userId}`, { method: "DELETE" });
        await loadFilas();
        return true;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel desvincular o usuario.");
        return false;
      }
    },
    [loadFilas],
  );

  const handleDeleteFila = useCallback(
    async (filaId: string) => {
      try {
        await apiRequest(`/filas/${filaId}`, { method: "DELETE" });
        await loadFilas();
        return true;
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel excluir a fila.");
        return false;
      }
    },
    [loadFilas],
  );

  return {
    loadAtendimentos,
    loadFilas,
    loadAtendimentoDetail,
    handleAssign,
    handleTransfer,
    handleRequeue,
    handleClose,
    handleAddNota,
    handleEnviarMensagem,
    handleCreateFila,
    handleAddUsuarioToFila,
    handleRemoveUsuarioFromFila,
    handleDeleteFila,
  };
}
