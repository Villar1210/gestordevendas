// src/modules/roleta_online/application/use-cases/list-roletas.use-case.ts
// Fatia 2 (Sorteio da vez): roletas do tenant com a fila atual (ordem,
// quem esta presente), ultimo sorteio e proximo horario - para a tela de
// Atendimento (todos veem a ordem) e para a configuracao.
import { Inject, Injectable } from '@nestjs/common';
import { IRoletaRepository, RoletaRecord, SorteioRecord } from '../../domain/repositories/roleta-repository.interface';
import { FilaRoletaService } from '../services/fila-roleta.service';
import { comTravaPorTenant } from '../../domain/services/trava-por-tenant';
import { momentoSP, proximoHorario } from '../../domain/services/fila-sorteio';
import { podeSortear } from '../../domain/services/permissao-roleta';

export interface RoletaComFila extends RoletaRecord {
  fila: Array<{ posicao: number; userId: string; nome: string; presente: boolean; ultimoLeadEm: Date | null }>;
  participantes: Array<{ userId: string; nome: string; presente: boolean }>;
  ultimoSorteio: SorteioRecord | null;
  proximoHorario: string | null;
}

@Injectable()
export class ListRoletasUseCase {
  constructor(
    @Inject('IRoletaRepository') private readonly roletaRepository: IRoletaRepository,
    private readonly filaRoletaService: FilaRoletaService,
  ) {}

  async execute(input: { tenantId: string; requesterRole: string; requesterCargo: string | null }) {
    const roletas = await this.roletaRepository.listByTenant(input.tenantId);
    const { minutos } = momentoSP();
    const resultado: RoletaComFila[] = [];
    for (const roleta of roletas) {
      const fila = roleta.ativa
        ? await comTravaPorTenant(input.tenantId, () => this.filaRoletaService.sincronizar(roleta))
        : { roleta, participantes: [], posicoes: [] };
      const presentes = new Set(fila.participantes.filter((p) => p.statusDisponibilidade === 'online').map((p) => p.userId));
      const nomes = new Map(fila.participantes.map((p) => [p.userId, p.nome]));
      const faltantes = fila.posicoes.filter((p) => !nomes.has(p.userId)).map((p) => p.userId);
      for (const [id, nome] of await this.roletaRepository.nomesUsuarios(faltantes)) nomes.set(id, nome);
      const [ultimoSorteio] = await this.roletaRepository.listSorteios(roleta.id, 1);
      resultado.push({
        ...fila.roleta,
        fila: fila.posicoes.map((p, i) => ({
          posicao: i + 1,
          userId: p.userId,
          nome: nomes.get(p.userId) ?? '—',
          presente: presentes.has(p.userId),
          ultimoLeadEm: p.ultimoLeadEm,
        })),
        participantes: fila.participantes.map((p) => ({ userId: p.userId, nome: p.nome, presente: presentes.has(p.userId) })),
        ultimoSorteio: ultimoSorteio ?? null,
        proximoHorario: roleta.ativa ? proximoHorario(roleta.horariosSorteio, minutos) : null,
      });
    }
    return { roletas: resultado, podeSortear: podeSortear(input.requesterRole, input.requesterCargo) };
  }
}
