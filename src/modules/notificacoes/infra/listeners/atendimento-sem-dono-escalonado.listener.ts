// src/modules/notificacoes/infra/listeners/atendimento-sem-dono-escalonado.listener.ts
// Escuta o evento generico emitido por EscalonarAtendimentosSemDonoUseCase
// (modulo atendimento) - rede de seguranca "sem corretor online" (Camada
// 2, caminho da Fila). Nao ha import direto entre os dois modulos alem do
// que ja e exportado (IUserRepository, via AuthModule) - mesmo padrao ja
// usado por CardSemDonoEscalonadoListener (caminho do Kanban).
import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IUserRepository } from '../../../auth/domain/repositories/user-repository.interface';
import { CreateNotificationUseCase } from '../../application/use-cases/create-notification.use-case';

const ADMINISTRADOR_ROLE_NAME = 'Administrador';

interface AtendimentoSemDonoEscalonadoEvent {
  tenantId: string;
  atendimentoId: string;
  phoneNumber: string;
  filaNome: string | null;
  minutosAguardando: number;
}

@Injectable()
export class AtendimentoSemDonoEscalonadoListener {
  private readonly logger = new Logger(AtendimentoSemDonoEscalonadoListener.name);

  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    private readonly createNotificationUseCase: CreateNotificationUseCase,
  ) {}

  @OnEvent('atendimento.sem_dono.escalonado')
  async handle(event: AtendimentoSemDonoEscalonadoEvent): Promise<void> {
    try {
      const administradores = await this.userRepository.findAllByTenantAndRole(
        event.tenantId,
        ADMINISTRADOR_ROLE_NAME,
      );

      const fila = event.filaNome ? ` (fila ${event.filaNome})` : ' (nao classificado)';
      const mensagem = `Atendimento de ${event.phoneNumber}${fila} esta ha ${event.minutosAguardando}min sem ninguem assumir.`;

      await Promise.all(
        administradores.map((admin) =>
          this.createNotificationUseCase.execute({
            tenantId: event.tenantId,
            userId: admin.id,
            tipo: 'atendimento_sem_dono_escalonado',
            mensagem,
            link: '/dashboard/atendimento',
          }),
        ),
      );
    } catch (error) {
      // Nunca deixa uma falha de notificacao derrubar o job de
      // escalonamento - so registra o erro (mesmo padrao ja usado em
      // CardSemDonoEscalonadoListener).
      this.logger.error(
        `Falha ao notificar Administradores sobre atendimento sem dono escalonado (atendimento ${event.atendimentoId}): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
