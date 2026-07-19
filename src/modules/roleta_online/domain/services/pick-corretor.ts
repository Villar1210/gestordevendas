// src/modules/roleta_online/domain/services/pick-corretor.ts
// Camada de DOMINIO: funcoes puras, sem Prisma/NestJS. Extraidas de
// DistributeLeadUseCase para serem reaproveitadas tambem por
// ProcessRoletaTimeoutsUseCase (reatribuicao apos timeout de aceite) - as
// duas precisam do EXATO mesmo criterio de escolha (round_robin/menor_fila),
// so mudam em COMO chegam na lista de corretores candidatos (online vs.
// online menos quem acabou de perder o lead por timeout).
import { CorretorRecord } from '../../../rh/domain/repositories/corretor-repository.interface';

export function pickByRoundRobin(
  onlineCorretores: CorretorRecord[],
  ultimoCorretorId: string | null,
): CorretorRecord {
  const sorted = [...onlineCorretores].sort((a, b) => a.id.localeCompare(b.id));
  if (!ultimoCorretorId) {
    return sorted[0];
  }
  const lastIndex = sorted.findIndex((corretor) => corretor.id === ultimoCorretorId);
  // ultimoCorretorId nao esta mais na lista de candidatos - recomeca do primeiro.
  if (lastIndex === -1) {
    return sorted[0];
  }
  return sorted[(lastIndex + 1) % sorted.length];
}

// Recebe as contagens ja calculadas (a busca em si depende de repositorio,
// fica no use case) - aqui so a escolha pura: quem tem menos.
export function pickByMenorFila(
  withCounts: Array<{ corretor: CorretorRecord; count: number }>,
): CorretorRecord {
  const sorted = [...withCounts].sort((a, b) => a.count - b.count);
  return sorted[0].corretor;
}
