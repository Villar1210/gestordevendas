// src/modules/roleta_online/application/use-cases/sortear-roleta.use-case.ts
// Fatia 2 (Sorteio da vez): botao "Sortear agora" (Administrador, gerentes,
// diretores e coordenadores). Se houver um horario do dia pendente (modo
// botao aguardando), ele fica marcado como sorteado - o job nao sorteia de
// novo por seguranca.
import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { IRoletaRepository, SorteioRecord } from '../../domain/repositories/roleta-repository.interface';
import { FilaRoletaService } from '../services/fila-roleta.service';
import { comTravaPorTenant } from '../../domain/services/trava-por-tenant';
import { horariosNaJanela, momentoSP } from '../../domain/services/fila-sorteio';
import { podeSortear } from '../../domain/services/permissao-roleta';

@Injectable()
export class SortearRoletaUseCase {
  constructor(
    @Inject('IRoletaRepository') private readonly roletaRepository: IRoletaRepository,
    private readonly filaRoletaService: FilaRoletaService,
  ) {}

  async execute(input: {
    tenantId: string;
    roletaId: string;
    userId: string;
    requesterRole: string;
    requesterCargo: string | null;
  }): Promise<SorteioRecord> {
    if (!podeSortear(input.requesterRole, input.requesterCargo)) {
      throw new ForbiddenException('Apenas Administrador, gerentes e coordenadores podem sortear.');
    }
    const roleta = await this.roletaRepository.findById(input.roletaId, input.tenantId);
    if (!roleta) throw new NotFoundException('Roleta nao encontrada.');
    if (!roleta.ativa) throw new BadRequestException('Esta roleta esta desativada.');

    return comTravaPorTenant(input.tenantId, async () => {
      const agora = new Date();
      const { dia, minutos } = momentoSP(agora);
      let pendente: string | null = null;
      for (const h of horariosNaJanela(roleta.horariosSorteio, minutos).reverse()) {
        const exec = await this.roletaRepository.findExecucao(roleta.id, dia, h);
        if (!exec?.sorteadoEm) {
          pendente = h;
          break;
        }
      }
      const sorteio = await this.filaRoletaService.sortear(roleta, 'botao', input.userId, pendente, agora);
      if (pendente) await this.roletaRepository.marcarSorteado(roleta.id, dia, pendente, agora);
      return sorteio;
    });
  }
}
