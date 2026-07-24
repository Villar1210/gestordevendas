// src/modules/notificacoes/infra/listeners/corretor-online-notifica-fila.listener.ts
// Escuta o evento generico emitido por UpdateStatusDisponibilidadeUseCase
// (modulo rh) quando um corretor muda o proprio status para "online" -
// mesmo evento que o modulo roleta_online usa para o retry automatico do
// Kanban (ver CorretorFicouOnlineListener). Aqui, caminho da Fila: rede de
// seguranca "sem corretor online" (Camada 1) - decisao confirmada com o
// usuario e SOMENTE NOTIFICAR o corretor que acabou de ficar online sobre
// atendimentos aguardando nas proprias filas, SEM auto-atribuir (o
// caminho da Fila nunca teve distribuicao automatica - ver CLAUDE.md).
import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IFilaRepository } from '../../../atendimento/domain/repositories/fila-repository.interface';
import { IAtendimentoRepository } from '../../../atendimento/domain/repositories/atendimento-repository.interface';
import { CreateNotificationUseCase } from '../../application/use-cases/create-notification.use-case';

interface CorretorFicouOnlineEvent {
  tenantId: string;
  userId: string;
}

@Injectable()
export class CorretorOnlineNotificaFilaListener {
  private readonly logger = new Logger(CorretorOnlineNotificaFilaListener.name);

  constructor(
    @Inject('IFilaRepository') private readonly filaRepository: IFilaRepository,
    @Inject('IAtendimentoRepository') private readonly atendimentoRepository: IAtendimentoRepository,
    private readonly createNotificationUseCase: CreateNotificationUseCase,
  ) {}

  @OnEvent('corretor.ficou_online')
  async handle(event: CorretorFicouOnlineEvent): Promise<void> {
    try {
      const filaIds = await this.filaRepository.findFilaIdsByUsuario(event.userId);
      if (filaIds.length === 0) {
        return;
      }

      const aguardando = await this.atendimentoRepository.findAllByTenant(event.tenantId, {
        status: 'aguardando',
      });
      const pendentesDasFilas = aguardando.filter(
        (atendimento) => atendimento.ownerId === null && filaIds.includes(atendimento.filaId ?? ''),
      );
      if (pendentesDasFilas.length === 0) {
        return;
      }

      const mensagem =
        pendentesDasFilas.length === 1
          ? `Voce esta online: 1 atendimento aguardando na sua fila.`
          : `Voce esta online: ${pendentesDasFilas.length} atendimentos aguardando nas suas filas.`;

      await this.createNotificationUseCase.execute({
        tenantId: event.tenantId,
        userId: event.userId,
        tipo: 'atendimento_aguardando_fila',
        mensagem,
        link: '/dashboard/atendimento',
      });
    } catch (error) {
      // Nunca deixa uma falha de notificacao derrubar a troca de status do
      // corretor - so registra o erro (mesmo padrao ja usado em
      // CardSemDonoEscalonadoListener).
      this.logger.error(
        `Falha ao notificar corretor sobre atendimentos aguardando (usuario ${event.userId}): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
