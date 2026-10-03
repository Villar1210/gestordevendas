// src/modules/rh/application/use-cases/marcar-inativos-offline.use-case.ts
// Presenca automatica (Fatia 1 - Atendimento/Roleta): corpo do job de 1 em 1
// minuto (ver infra/scheduler/presenca-inatividade.scheduler.ts). Derruba
// para "offline" quem esta "online" mas parou de mandar sinal de vida (ver
// RegistrarAtividadeUseCase). O limite e por tenant:
// RoletaConfig.minutosInatividadeOffline (default 15, 0 = desligado).
import { Injectable, Inject, Logger } from '@nestjs/common';
import { ICorretorRepository } from '../../domain/repositories/corretor-repository.interface';

@Injectable()
export class MarcarInativosOfflineUseCase {
  private readonly logger = new Logger(MarcarInativosOfflineUseCase.name);

  constructor(
    @Inject('ICorretorRepository') private readonly corretorRepository: ICorretorRepository,
  ) {}

  async execute(): Promise<number> {
    const derrubados = await this.corretorRepository.marcarOfflinePorInatividade();
    for (const u of derrubados) {
      this.logger.log(`Usuario ${u.name} (${u.id}, tenant ${u.tenantId}) marcado como offline por inatividade.`);
    }
    return derrubados.length;
  }
}
