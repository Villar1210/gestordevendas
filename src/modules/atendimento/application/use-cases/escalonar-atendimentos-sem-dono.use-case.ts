// src/modules/atendimento/application/use-cases/escalonar-atendimentos-sem-dono.use-case.ts
// Corpo do job agendado (ver infra/scheduler/atendimento-sem-dono-escalonamento.scheduler.ts).
// Rede de seguranca "sem corretor online" (Camada 2 - escalonamento por
// tempo), caminho da Fila: verifica TODOS os atendimentos aguardando e sem
// dono, de qualquer tenant, criados ha mais de MINUTOS_LIMITE minutos e
// ainda nao escalonados, marca como escalonado (nunca notifica 2x o mesmo
// atendimento) e emite um evento generico para o modulo notificacoes
// avisar os Administradores do tenant - mesmo padrao cross-tenant/mesmo
// limite de tempo ja usado por EscalonarCardsSemDonoUseCase (modulo
// roleta_online, caminho do Kanban).
import { Injectable, Logger, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IAtendimentoRepository } from '../../domain/repositories/atendimento-repository.interface';

export const ESCALONAMENTO_MINUTOS_LIMITE = 15;

@Injectable()
export class EscalonarAtendimentosSemDonoUseCase {
  private readonly logger = new Logger(EscalonarAtendimentosSemDonoUseCase.name);

  constructor(
    @Inject('IAtendimentoRepository') private readonly atendimentoRepository: IAtendimentoRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(): Promise<void> {
    const cutoff = new Date(Date.now() - ESCALONAMENTO_MINUTOS_LIMITE * 60_000);
    const pendentes = await this.atendimentoRepository.findAguardandoSemDonoNaoEscalonados(cutoff);
    if (pendentes.length === 0) {
      return;
    }

    for (const atendimento of pendentes) {
      try {
        await this.atendimentoRepository.markEscalonamentoNotificado(atendimento.id);
        const minutosAguardando = Math.floor(
          (Date.now() - atendimento.createdAt.getTime()) / 60_000,
        );
        this.eventEmitter.emit('atendimento.sem_dono.escalonado', {
          tenantId: atendimento.tenantId,
          atendimentoId: atendimento.id,
          phoneNumber: atendimento.phoneNumber,
          filaNome: atendimento.filaNome,
          minutosAguardando,
        });
        this.logger.warn(
          `Atendimento ${atendimento.id} sem dono ha ${minutosAguardando}min - Administrador(es) notificado(s).`,
        );
      } catch (err) {
        // Um atendimento com problema nao pode travar os demais - mesmo
        // padrao resiliente ja usado em ProcessRoletaTimeoutsUseCase.
        this.logger.error(`Erro escalonando o atendimento ${atendimento.id}: ${(err as Error).message}`);
      }
    }
  }
}
