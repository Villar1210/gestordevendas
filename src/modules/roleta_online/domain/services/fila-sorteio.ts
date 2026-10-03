// src/modules/roleta_online/domain/services/fila-sorteio.ts
// Fatia 2 (Atendimento/Roleta) - Sorteio da vez. Funcoes puras (sem
// Prisma/Nest): relogio de Sao Paulo, horarios de sorteio, embaralhamento e
// escolha do proximo da fila. Ver FilaRoletaService para o uso.
import { randomInt } from 'crypto';

export const FUSO_ROLETA = 'America/Sao_Paulo';
// Um horario so e executado ate JANELA_HORARIO_MIN depois da hora marcada -
// evita que uma roleta criada as 15h dispare (e zere a fila) por causa do
// horario das 9h, ou que o servidor volte de uma queda e sorteie atrasado.
export const JANELA_HORARIO_MIN = 60;
export const SEGURANCA_MAX_MIN = 45;

const DIAS_SEMANA_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface MomentoSP {
  dia: string; // "YYYY-MM-DD"
  minutos: number; // minutos desde 00:00
  diaSemana: number; // 0=domingo..6=sabado (mesma convencao de EscalaPlantao)
}

export function momentoSP(agora: Date = new Date()): MomentoSP {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: FUSO_ROLETA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    weekday: 'short',
  }).formatToParts(agora);
  const p = (tipo: string) => partes.find((x) => x.type === tipo)?.value ?? '';
  return {
    dia: `${p('year')}-${p('month')}-${p('day')}`,
    minutos: Number(p('hour')) * 60 + Number(p('minute')),
    diaSemana: DIAS_SEMANA_EN.indexOf(p('weekday')),
  };
}

export function horarioValido(h: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(h);
}

export function horarioParaMinutos(h: string): number {
  const [hh, mm] = h.split(':').map(Number);
  return hh * 60 + mm;
}

// Horarios do dia ja alcancados e ainda dentro da janela de execucao, do
// mais antigo para o mais recente.
export function horariosNaJanela(horarios: string[], minutosAgora: number): string[] {
  return [...new Set(horarios.filter(horarioValido))]
    .sort()
    .filter((h) => {
      const diff = minutosAgora - horarioParaMinutos(h);
      return diff >= 0 && diff <= JANELA_HORARIO_MIN;
    });
}

// Proximo horario de hoje (para exibir), ou nulo se ja passaram todos.
export function proximoHorario(horarios: string[], minutosAgora: number): string | null {
  return (
    [...new Set(horarios.filter(horarioValido))]
      .sort()
      .find((h) => horarioParaMinutos(h) > minutosAgora) ?? null
  );
}

// Fisher-Yates com gerador criptografico (sorteio justo e nao previsivel).
export function embaralhar<T>(itens: T[], aleatorio: (max: number) => number = randomInt): T[] {
  const lista = [...itens];
  for (let i = lista.length - 1; i > 0; i--) {
    const j = aleatorio(i + 1);
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

// Primeiro da fila (menor posicao) que esta disponivel e nao foi excluido.
// Offline e pulado mas NAO perde o lugar (a posicao nao muda).
export function proximoDaFila(
  posicoes: Array<{ userId: string; posicao: number }>,
  disponiveis: Set<string>,
  excluir: Set<string> = new Set(),
): string | null {
  const ordenada = [...posicoes].sort((a, b) => a.posicao - b.posicao);
  return ordenada.find((p) => disponiveis.has(p.userId) && !excluir.has(p.userId))?.userId ?? null;
}
