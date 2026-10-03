// src/features/roleta/hooks/useRoletas.ts
// Fatia 2 (Sorteio da vez): acesso a /roletas.
import { useCallback, useState } from "react";
import { apiRequest, ApiError } from "@/core/api/client";
import type { Roleta, SalvarRoletaInput, Sorteio } from "../types";

function mensagem(err: unknown, padrao: string) {
  return err instanceof ApiError ? err.message : padrao;
}

export function useRoletas() {
  const [roletas, setRoletas] = useState<Roleta[]>([]);
  const [podeSortear, setPodeSortear] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const resp = await apiRequest<{ roletas: Roleta[]; podeSortear: boolean }>("/roletas");
      setRoletas(resp.roletas);
      setPodeSortear(resp.podeSortear);
    } catch {
      // mantem o ultimo estado em falha pontual de rede
    } finally {
      setCarregando(false);
    }
  }, []);

  const salvar = useCallback(
    async (input: SalvarRoletaInput, id?: string) => {
      setOcupado(true);
      try {
        await apiRequest(id ? `/roletas/${id}` : "/roletas", {
          method: id ? "PATCH" : "POST",
          body: JSON.stringify(input),
        });
        await carregar();
        return true;
      } catch (err) {
        alert(mensagem(err, "Não foi possível salvar a roleta."));
        return false;
      } finally {
        setOcupado(false);
      }
    },
    [carregar],
  );

  const excluir = useCallback(
    async (id: string) => {
      setOcupado(true);
      try {
        await apiRequest(`/roletas/${id}`, { method: "DELETE" });
        await carregar();
      } catch (err) {
        alert(mensagem(err, "Não foi possível excluir a roleta."));
      } finally {
        setOcupado(false);
      }
    },
    [carregar],
  );

  const sortear = useCallback(
    async (id: string) => {
      setOcupado(true);
      try {
        const sorteio = await apiRequest<Sorteio>(`/roletas/${id}/sortear`, { method: "POST" });
        await carregar();
        return sorteio;
      } catch (err) {
        alert(mensagem(err, "Não foi possível sortear."));
        return null;
      } finally {
        setOcupado(false);
      }
    },
    [carregar],
  );

  const historico = useCallback(async (id: string) => {
    try {
      return await apiRequest<Sorteio[]>(`/roletas/${id}/sorteios`);
    } catch {
      return [];
    }
  }, []);

  return { roletas, podeSortear, carregando, ocupado, carregar, salvar, excluir, sortear, historico };
}
