// src/features/roleta/types.ts
// Fatia 2 (Sorteio da vez) - espelha GET /roletas (ListRoletasUseCase).

export type TipoRoleta = "stand" | "produto";
export type ModoSorteio = "automatico" | "botao";

export interface Sorteio {
  id: string;
  roletaId: string;
  origem: "automatico" | "botao" | "seguranca";
  disparadoPorId: string | null;
  disparadoPorNome: string | null;
  horario: string | null;
  ordem: Array<{ userId: string; nome: string }>;
  createdAt: string;
}

export interface Roleta {
  id: string;
  nome: string;
  tipo: TipoRoleta;
  standId: string | null;
  padrao: boolean;
  ativa: boolean;
  modoSorteio: ModoSorteio;
  horariosSorteio: string[];
  minutosSorteioSeguranca: number;
  empreendimentoIds: string[];
  corretorIds: string[];
  fila: Array<{ posicao: number; userId: string; nome: string; presente: boolean; ultimoLeadEm: string | null }>;
  participantes: Array<{ userId: string; nome: string; presente: boolean }>;
  ultimoSorteio: Sorteio | null;
  proximoHorario: string | null;
}

export interface SalvarRoletaInput {
  nome: string;
  tipo: TipoRoleta;
  standId: string | null;
  padrao: boolean;
  ativa: boolean;
  modoSorteio: ModoSorteio;
  horariosSorteio: string[];
  minutosSorteioSeguranca: number;
  empreendimentoIds: string[];
  corretorIds: string[];
}

export const ORIGEM_SORTEIO_LABEL: Record<Sorteio["origem"], string> = {
  automatico: "automático",
  botao: "botão",
  seguranca: "automático (ninguém sorteou)",
};

export function horaCurta(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}
