// src/features/social-media/hooks/useSocialMediaIntegration.ts
import { useCallback } from "react";
import { apiRequest, ApiError } from "@/core/api/client";
import { useSocialMediaStore, SocialAccount } from "../store/useSocialMediaStore";

export function useSocialMediaIntegration() {
  const setContas = useSocialMediaStore((state) => state.setContas);
  const setLoading = useSocialMediaStore((state) => state.setLoading);
  const setConectando = useSocialMediaStore((state) => state.setConectando);

  const loadContas = useCallback(async () => {
    setLoading(true);
    try {
      const contas = await apiRequest<SocialAccount[]>("/social/contas");
      setContas(contas);
    } finally {
      setLoading(false);
    }
  }, [setContas, setLoading]);

  // Busca a URL de autorizacao da Meta e redireciona o navegador para la -
  // nao e uma chamada que "fica" na pagina, o usuario sai do gestordevendas
  // e volta via /social/callback (backend) apos consentir.
  const handleConectar = useCallback(async () => {
    setConectando(true);
    try {
      const { url } = await apiRequest<{ url: string }>("/social/conectar/iniciar");
      window.location.href = url;
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Nao foi possivel iniciar a conexao.");
      setConectando(false);
    }
  }, [setConectando]);

  const handleDesconectar = useCallback(
    async (id: string) => {
      if (!window.confirm("Desconectar esta conta? Voce precisara autorizar novamente para reconecta-la.")) {
        return;
      }
      try {
        await apiRequest(`/social/contas/${id}`, { method: "DELETE" });
        await loadContas();
      } catch (err) {
        alert(err instanceof ApiError ? err.message : "Nao foi possivel desconectar a conta.");
      }
    },
    [loadContas],
  );

  return { loadContas, handleConectar, handleDesconectar };
}
