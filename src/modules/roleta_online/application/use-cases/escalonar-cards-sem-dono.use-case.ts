// src/modules/roleta_online/application/use-cases/escalonar-cards-sem-dono.use-case.ts
// Corpo do job agendado (ver infra/scheduler/card-sem-dono-escalonamento.scheduler.ts).
// Rede de seguranca "sem corretor online" (Camada 2 - escalonamento por
// tempo): verifica TODOS os cards sem stage e sem dono, de qualquer
// tenant, criados ha mais de MINUTOS_LIMITE minutos e ainda nao
// escalonados, marca como escalonado (nunca notifica 2x o mesmo card) e
// emite um evento generico para o modulo notificacoes avisar os
// Administradores do tenant - mesmo padrao cross-tenant ja usado por
// ProcessRoletaTimeoutsUseCase.
import { Injectable, Logger, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ICardRepository } from '../../../vendas_kanban/domain/repositories/card-repository.interface';

export const ESCALONAMENTO_MINUTOS_LIMITE = 15;

@Injectable()
export class EscalonarCardsSemDonoUseCase {
  private readonly logger = new Logger(EscalonarCardsSemDonoUseCase.name);

  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(): Promise<void> {
    const cutoff = new Date(Date.now() - ESCALONAMENTO_MINUTOS_LIMITE * 60_000);
    const pendentes = await this.cardRepository.findInboxUnnotifiedOlderThan(cutoff);
    if (pendentes.length === 0) {
      return;
    }

    for (const card of pendentes) {
      try {
        await this.cardRepository.markEscalonamentoNotificado(card.id);
        const minutosAguardando = Math.floor((Date.now() - card.createdAt.getTime()) / 60_000);
        this.eventEmitter.emit('card.sem_dono.escalonado', {
          tenantId: card.tenantId,
          cardId: card.id,
          title: card.title,
          phone: card.phone,
          minutosAguardando,
        });
        this.logger.warn(
          `Card ${card.id} sem dono ha ${minutosAguardando}min - Administrador(es) notificado(s).`,
        );
      } catch (err) {
        // Um card com problema nao pode travar os demais - mesmo padrao
        // resiliente ja usado em ProcessRoletaTimeoutsUseCase.
        this.logger.error(`Erro escalonando o card ${card.id}: ${(err as Error).message}`);
      }
    }
  }
}
