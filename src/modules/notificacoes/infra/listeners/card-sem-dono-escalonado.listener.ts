// src/modules/notificacoes/infra/listeners/card-sem-dono-escalonado.listener.ts
// Escuta o evento generico emitido por EscalonarCardsSemDonoUseCase
// (modulo roleta_online) - rede de seguranca "sem corretor online" (Camada
// 2, caminho do Kanban). Nao ha import direto entre os dois modulos alem
// do que ja e exportado (IUserRepository, via AuthModule) - o unico
// contrato adicional e o nome do evento e o formato do payload, por
// convencao (mesmo padrao ja usado por CadastroPendenteCriadoListener,
// que tambem notifica todos os Administradores do tenant).
import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IUserRepository } from '../../../auth/domain/repositories/user-repository.interface';
import { CreateNotificationUseCase } from '../../application/use-cases/create-notification.use-case';

const ADMINISTRADOR_ROLE_NAME = 'Administrador';

interface CardSemDonoEscalonadoEvent {
  tenantId: string;
  cardId: string;
  title: string;
  phone: string | null;
  minutosAguardando: number;
}

@Injectable()
export class CardSemDonoEscalonadoListener {
  private readonly logger = new Logger(CardSemDonoEscalonadoListener.name);

  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    private readonly createNotificationUseCase: CreateNotificationUseCase,
  ) {}

  @OnEvent('card.sem_dono.escalonado')
  async handle(event: CardSemDonoEscalonadoEvent): Promise<void> {
    try {
      const administradores = await this.userRepository.findAllByTenantAndRole(
        event.tenantId,
        ADMINISTRADOR_ROLE_NAME,
      );

      const telefone = event.phone ? ` (${event.phone})` : '';
      const mensagem = `Lead "${event.title}"${telefone} esta ha ${event.minutosAguardando}min sem corretor - ninguem assumiu.`;

      await Promise.all(
        administradores.map((admin) =>
          this.createNotificationUseCase.execute({
            tenantId: event.tenantId,
            userId: admin.id,
            tipo: 'card_sem_dono_escalonado',
            mensagem,
            link: `/dashboard/kanban?cardId=${event.cardId}`,
          }),
        ),
      );
    } catch (error) {
      // Nunca deixa uma falha de notificacao derrubar o job de
      // escalonamento - so registra o erro (mesmo padrao ja usado em
      // CadastroPendenteCriadoListener).
      this.logger.error(
        `Falha ao notificar Administradores sobre card sem dono escalonado (card ${event.cardId}): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
