// src/modules/roleta_online/application/use-cases/escalonar-cards-sem-dono.use-case.ts
// Corpo do job agendado (ver infra/scheduler/card-sem-dono-escalonamento.scheduler.ts).
// Rede de seguranca "sem corretor online" (Camada 2 - escalonamento por
// tempo): verifica TODOS os cards sem stage e sem dono, de qualquer
// tenant, criados ha mais de MINUTOS_LIMITE minutos e ainda nao
// escalonados, marca como escalonado (nunca notifica 2x o mesmo card) e
// emite um evento generico para o modulo notificacoes avisar os
// Administradores do tenant - mesmo padrao cross-tenant ja usado por
// ProcessRoletaTimeoutsUseCase.
import { dentroDoHorarioDeAtendimento, minutosDesdeAbertura } from '../../domain/services/horario-atendimento';
import { Injectable, Logger, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ICardRepository } from '../../../vendas_kanban/domain/repositories/card-repository.interface';

export const ESCALONAMENTO_MINUTOS_LIMITE = 15;
// Fase B (revisao): 1 evento por empresa com todos os leads parados da rodada
// (o WhatsApp da gestao manda uma mensagem so). O sino continua por card.
export const CARDS_SEM_DONO_RESUMO_EVENT = 'cards.sem_dono.resumo';

@Injectable()
export class EscalonarCardsSemDonoUseCase {
  private readonly logger = new Logger(EscalonarCardsSemDonoUseCase.name);

  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(agora: Date = new Date()): Promise<void> {
    // Fase B (27/10/2026): fora do horario das lojas ninguem e alertado (o
    // lead espera a distribuicao das 9h). Depois das 9h, so alerta a partir
    // das 9h15 - da tempo da distribuicao da abertura acontecer.
    if (!dentroDoHorarioDeAtendimento(agora) || minutosDesdeAbertura(agora) < ESCALONAMENTO_MINUTOS_LIMITE) {
      return;
    }
    const cutoff = new Date(Date.now() - ESCALONAMENTO_MINUTOS_LIMITE * 60_000);
    const pendentes = await this.cardRepository.findInboxUnnotifiedOlderThan(cutoff);
    if (pendentes.length === 0) {
      return;
    }

    // Fase B (revisao): um resumo por empresa por rodada para o WhatsApp
    // (evita uma rajada de mensagens as 9h15 pelo numero oficial).
    const resumoPorTenant = new Map<string, Array<{ cardId: string; title: string; minutosAguardando: number }>>();

    for (const card of pendentes) {
      try {
        await this.cardRepository.markEscalonamentoNotificado(card.id);
        const desde = (card.caixaEntradaDesde ?? card.createdAt).getTime();
        const minutosAguardando = Math.floor((Date.now() - desde) / 60_000);
        const lista = resumoPorTenant.get(card.tenantId) ?? [];
        lista.push({ cardId: card.id, title: card.title, minutosAguardando });
        resumoPorTenant.set(card.tenantId, lista);
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

    for (const [tenantId, cards] of resumoPorTenant) {
      this.eventEmitter.emit(CARDS_SEM_DONO_RESUMO_EVENT, { tenantId, cards });
    }
  }
}
