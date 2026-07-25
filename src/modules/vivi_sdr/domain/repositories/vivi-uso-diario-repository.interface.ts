// src/modules/vivi_sdr/domain/repositories/vivi-uso-diario-repository.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Prisma ou Postgres.
export interface ViviUsoDiarioRecord {
  id: string;
  tenantId: string;
  data: Date;
  totalMensagens: number;
  alertaAtencaoEnviado: boolean;
  alertaCriticoEnviado: boolean;
  alertaConcentracaoEnviado: boolean;
}

// 3 niveis de volume (ver RegistrarUsoViviUseCase/LIMITE_CRITICO_MULTIPLICADOR)
// + a suspeita de concentracao, cada um com seu proprio flag de dedupe -
// "nivel" aqui e so a CHAVE do flag que esta sendo marcado, nao uma
// hierarquia (concentracao nao e "mais alta" que critico, e independente).
export type NivelAlertaVivi = 'atencao' | 'critico' | 'concentracao';

export interface IViviUsoDiarioRepository {
  // Upsert atomico: cria a linha do dia (tenantId+data) com totalMensagens=1
  // se ainda nao existir, ou incrementa em 1 se ja existir - nunca um SELECT
  // seguido de UPDATE, que perderia incrementos concorrentes sob volume
  // alto (varias mensagens processadas ao mesmo tempo).
  incrementAndGet(tenantId: string, dia: Date): Promise<ViviUsoDiarioRecord>;

  // Registra (idempotente - ON CONFLICT DO NOTHING) o numero/identificador
  // do remetente desta mensagem como "visto hoje" e retorna a contagem
  // ATUALIZADA de numeros distintos no dia - usado para calcular a razao
  // mensagens/numero-distinto (suspeita de uso concentrado).
  registrarNumeroDistinto(viviUsoDiarioId: string, numero: string): Promise<number>;

  // UPDATE condicional (flag do nivel: false -> true), nao um SELECT+UPDATE
  // - retorna true SOMENTE na chamada que efetivamente "venceu a corrida" e
  // virou o flag. Garante no maximo 1 notificacao por tenant por dia POR
  // NIVEL, mesmo com mensagens concorrentes cruzando o limite ao mesmo tempo.
  marcarAlertaEnviadoSeNecessario(id: string, nivel: NivelAlertaVivi): Promise<boolean>;
}
