// src/modules/notificacoes/infra/listeners/roleta-sorteio.listener.ts
// Fatia 2 (Sorteio da vez). Escuta eventos genericos do modulo
// roleta_online (sem import entre os modulos, mesmo padrao dos demais
// listeners daqui):
// - 'roleta.sorteada': avisa cada participante sorteado da sua posicao;
// - 'roleta.hora_do_sorteio': avisa os supervisores (modo botao) que esta
//   na hora de apertar "Sortear".
import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { CreateNotificationUseCase } from '../../application/use-cases/create-notification.use-case';

interface RoletaSorteadaEvent {
  tenantId: string;
  roletaId: string;
  roletaNome: string;
  ordem: Array<{ userId: string; nome: string }>;
}

interface HoraDoSorteioEvent {
  tenantId: string;
  roletaId: string;
  roletaNome: string;
  horario: string;
  minutosSeguranca: number;
  userIds: string[];
}

const LINK_ATENDIMENTO = '/dashboard/atendimento';

@Injectable()
export class RoletaSorteioListener {
  private readonly logger = new Logger(RoletaSorteioListener.name);

  constructor(private readonly createNotificationUseCase: CreateNotificationUseCase) {}

  @OnEvent('roleta.sorteada')
  async onSorteada(event: RoletaSorteadaEvent): Promise<void> {
    try {
      await Promise.all(
        event.ordem.map((o, i) =>
          this.createNotificationUseCase.execute({
            tenantId: event.tenantId,
            userId: o.userId,
            tipo: 'roleta_sorteada',
            mensagem: `Sorteio da roleta "${event.roletaNome}": voce e o ${i + 1}º da fila.`,
            link: LINK_ATENDIMENTO,
          }),
        ),
      );
    } catch (error) {
      this.logger.error(`Falha ao notificar sorteio da roleta ${event.roletaId}: ${(error as Error).message}`);
    }
  }

  @OnEvent('roleta.hora_do_sorteio')
  async onHoraDoSorteio(event: HoraDoSorteioEvent): Promise<void> {
    try {
      await Promise.all(
        event.userIds.map((userId) =>
          this.createNotificationUseCase.execute({
            tenantId: event.tenantId,
            userId,
            tipo: 'roleta_hora_sorteio',
            mensagem: `Hora do sorteio (${event.horario}) da roleta "${event.roletaNome}". Se ninguem sortear em ${event.minutosSeguranca} min, o sistema sorteia sozinho.`,
            link: LINK_ATENDIMENTO,
          }),
        ),
      );
    } catch (error) {
      this.logger.error(`Falha ao avisar hora do sorteio da roleta ${event.roletaId}: ${(error as Error).message}`);
    }
  }
}
