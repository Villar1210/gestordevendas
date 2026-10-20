// Integracao da Analise por Endereco e do Historico com /bii/* (so
// Administrador): cobertura do ITBI, nova analise, lista e analise salva.
import { useCallback, useRef } from "react";
import { apiRequest, ApiError } from "@/core/api/client";
import { useBiiAnaliseStore } from "../store/useBiiAnaliseStore";
import type {
  AnaliseEnderecoInput,
  AnaliseEnderecoResponse,
  AnaliseResumoItem,
  CoberturaItbi,
} from "../types-endereco";

const ERRO_GENERICO = "Não foi possível concluir agora. Verifique sua conexão e tente de novo.";

// Traduz o erro da API para uma frase para o usuario. 422 (endereco nao
// encontrado) e 400 (validacao) trazem mensagem propria do backend.
// 429 por cota diaria da empresa (diferente do limite por minuto) e 403 do
// modo de acesso do Super Usuario: o backend manda um `code` estavel no corpo
// (BII_COTA_DIARIA / BII_SOMENTE_LEITURA) - nunca depender do texto.
function codigoErro(err: unknown): string | null {
  if (!(err instanceof ApiError) || !err.body || typeof err.body !== "object") return null;
  const code = (err.body as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

export function ehCotaDiaria(err: unknown): boolean {
  return err instanceof ApiError && err.status === 429 && codigoErro(err) === "BII_COTA_DIARIA";
}

export function ehSomenteLeitura(err: unknown): boolean {
  return err instanceof ApiError && err.status === 403 && codigoErro(err) === "BII_SOMENTE_LEITURA";
}

export function mensagemErroAnalise(err: unknown): string {
  if (!(err instanceof ApiError)) return ERRO_GENERICO;
  if (ehCotaDiaria(err)) return err.message;
  if (err.status === 429) return "Muitas análises em pouco tempo. Aguarde um minuto e tente de novo.";
  if (err.status === 503)
    return "O serviço de localização está ocupado no momento. Tente de novo em alguns instantes.";
  if (err.status === 404) return "Análise não encontrada. Ela pode ter sido feita em outra conta.";
  if (err.status === 422 || err.status === 400 || err.status === 403) return err.message;
  return ERRO_GENERICO;
}

export async function carregarCobertura(): Promise<CoberturaItbi> {
  return apiRequest<CoberturaItbi>("/bii/itbi/cobertura");
}

export async function listarAnalises(): Promise<AnaliseResumoItem[]> {
  return apiRequest<AnaliseResumoItem[]>("/bii/analises");
}

export async function carregarAnalise(id: string): Promise<AnaliseEnderecoResponse> {
  return apiRequest<AnaliseEnderecoResponse>(`/bii/analises/${encodeURIComponent(id)}`);
}

export function useBiiAnaliseIntegration() {
  const setResultado = useBiiAnaliseStore((s) => s.setResultado);
  const setLoading = useBiiAnaliseStore((s) => s.setLoading);
  const setErro = useBiiAnaliseStore((s) => s.setErro);
  const setBloqueio = useBiiAnaliseStore((s) => s.setBloqueio);
  const enviando = useRef(false);

  const analisar = useCallback(
    async (input: AnaliseEnderecoInput) => {
      if (enviando.current) return;
      enviando.current = true;
      setLoading(true);
      setErro(null);
      try {
        const resultado = await apiRequest<AnaliseEnderecoResponse>("/bii/analises/endereco", {
          method: "POST",
          body: JSON.stringify(input),
        });
        setResultado(resultado);
      } catch (err) {
        setErro(mensagemErroAnalise(err));
        // Nos dois casos tentar de novo nao adianta: trava o botao.
        if (ehCotaDiaria(err)) setBloqueio("cota");
        else if (ehSomenteLeitura(err)) setBloqueio("somente_leitura");
      } finally {
        enviando.current = false;
        setLoading(false);
      }
    },
    [setResultado, setLoading, setErro, setBloqueio],
  );

  return { analisar };
}
