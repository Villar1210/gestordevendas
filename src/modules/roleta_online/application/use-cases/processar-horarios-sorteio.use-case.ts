// src/modules/roleta_online/application/use-cases/processar-horarios-sorteio.use-case.ts
// Fatia 2 (Sorteio da vez): corpo do job de 1 em 1 minuto (ver
// infra/scheduler/roleta-sorteio.scheduler.ts). Para cada roleta ativa e
// cada horario do dia ja alcancado (ate 60 min depois):
// - modo "automatico": sorteia na hora;
// - modo "botao": avisa os supervisores uma vez ("hora do sorteio") e, se
//   ninguem apertar o botao em minutosSorteioSeguranca, sorteia sozinho.
// Cada horario de cada dia e executado uma vez so (RoletaHorarioExecucao).
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IRoletaRepository, RoletaRecord } from '../../domain/repositories/roleta-repository.interface';
import { FilaRoletaService } from '../services/fila-roleta.service';
import { comTravaPorTenant } from '../../domain/services/trava-por-tenant';
import { horarioParaMinutos, horariosNaJanela, momentoSP } from '../../domain/services/fila-sorteio';

@Injectable()
export class ProcessarHorariosSorteioUseCase {
  private readonly logger = new Logger(ProcessarHorariosSorteioUseCase.name);

  constructor(
    @Inject('IRoletaRepository') private readonly roletaRepository: IRoletaRepository,
    private readonly filaRoletaService: FilaRoletaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(agora: Date = new Date()): Promise<void> {
    const roletas = await this.roletaRepository.listAtivasComHorario();
    for (const roleta of roletas) {
      try {
        await comTravaPorTenant(roleta.tenantId, () => this.processar(roleta, agora));
      } catch (err) {
        // Uma roleta com problema nao pode travar as demais.
        this.logger.error(`Erro no horario de sorteio da roleta ${roleta.id}: ${(err as Error).message}`);
      }
    }
  }

  private async processar(roleta: RoletaRecord, agora: Date): Promise<void> {
    const { dia, minutos } = momentoSP(agora);
    // So o horario mais recente da janela vale (o anterior ficaria obsoleto).
    const pendentes = horariosNaJanela(roleta.horariosSorteio, minutos);
    const horario = pendentes[pendentes.length - 1];
    if (!horario) return;

    // Roleta criada hoje DEPOIS do horario: esse horario nao vale (senao uma
    // roleta criada as 14h30 sortearia na hora por causa do horario das 14h).
    const criacao = momentoSP(roleta.createdAt);
    if (criacao.dia === dia && criacao.minutos > horarioParaMinutos(horario)) return;

    const exec = await this.roletaRepository.findExecucao(roleta.id, dia, horario);
    if (exec?.sorteadoEm) return;

    if (roleta.modoSorteio === 'automatico') {
      await this.filaRoletaService.sortear(roleta, 'automatico', null, horario, agora);
      await this.roletaRepository.marcarSorteado(roleta.id, dia, horario, agora);
      return;
    }

    // modo "botao"
    if (!exec?.avisadoEm) {
      const supervisores = await this.roletaRepository.listSupervisores(roleta.tenantId, roleta.standId);
      this.eventEmitter.emit('roleta.hora_do_sorteio', {
        tenantId: roleta.tenantId,
        roletaId: roleta.id,
        roletaNome: roleta.nome,
        horario,
        minutosSeguranca: roleta.minutosSorteioSeguranca,
        userIds: supervisores,
      });
      await this.roletaRepository.marcarAvisado(roleta.id, dia, horario, agora);
    }
    if (minutos - horarioParaMinutos(horario) >= roleta.minutosSorteioSeguranca) {
      await this.filaRoletaService.sortear(roleta, 'seguranca', null, horario, agora);
      await this.roletaRepository.marcarSorteado(roleta.id, dia, horario, agora);
    }
  }
}
