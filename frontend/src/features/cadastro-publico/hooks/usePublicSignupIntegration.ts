// src/features/cadastro-publico/hooks/usePublicSignupIntegration.ts
import { useCallback } from "react";
import { apiRequest, ApiError } from "@/core/api/client";

export interface PublicSignupInput {
  tipoPerfil: "comprador" | "corretor_house" | "corretor_parceiro" | "imobiliaria_parceira";
  name: string;
  email: string;
  password: string;
  telefone?: string;
  cpf?: string;
  creci?: string;
  nomeImobiliaria?: string;
  cnpj?: string;
  creciJ?: string;
  cargoNaEmpresa?: string;
  tipoCliente?: string;
  cep?: string;
  endereco?: string;
}

export function usePublicSignupIntegration() {
  const submitSignup = useCallback(async (input: PublicSignupInput) => {
    try {
      await apiRequest("/rh/cadastro-publico", {
        method: "POST",
        body: JSON.stringify(input),
      });
      return { ok: true as const };
    } catch (err) {
      return {
        ok: false as const,
        message: err instanceof ApiError ? err.message : "Nao foi possivel enviar o cadastro.",
      };
    }
  }, []);

  return { submitSignup };
}
