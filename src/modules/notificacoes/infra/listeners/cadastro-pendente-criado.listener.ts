// src/modules/notificacoes/infra/listeners/cadastro-pendente-criado.listener.ts
// Escuta o evento generico emitido pelo PublicSignupUseCase (modulo rh).
// Nao ha import direto entre os dois modulos - o unico contrato adicional
// e o nome do evento e o formato do payload, por convencao (mesmo padrao
// ja usado por CardSemDonoCriadoListener no modulo roleta_online). Ver
// CLAUDE.md "Decisao tecnica: Organizacao de pastas por modulo".
import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IUserRepository } from '../../../auth/domain/repositories/user-repository.interface';
import { CreateNotificationUseCase } from '../../application/use-cases/create-notification.use-case';

const ADMINISTRADOR_ROLE_NAME = 'Administrador';

interface CadastroPendenteCriadoEvent {
  tenantId: string;
  nome: string;
  roleName: string;
}

@Injectable()
export class CadastroPendenteCriadoListener {
  private readonly logger = new Logger(CadastroPendenteCriadoListener.name);

  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    private readonly createNotificationUseCase: CreateNotificationUseCase,
  ) {}

  @OnEvent('cadastro.pendente.criado')
  async handle(event: CadastroPendenteCriadoEvent): Promise<void> {
    try {
      const administradores = await this.userRepository.findAllByTenantAndRole(
        event.tenantId,
        ADMINISTRADOR_ROLE_NAME,
      );

      await Promise.all(
        administradores.map((admin) =>
          this.createNotificationUseCase.execute({
            tenantId: event.tenantId,
            userId: admin.id,
            tipo: 'cadastro_pendente',
            mensagem: `Novo cadastro pendente de aprovação: ${event.nome} (${event.roleName})`,
            link: '/dashboard/rh/aprovacoes',
          }),
        ),
      );
    } catch (error) {
      // Nunca deixa uma falha de notificacao derrubar o cadastro publico -
      // so registra o erro (mesmo padrao ja usado em CardSemDonoCriadoListener).
      this.logger.error(
        `Falha ao notificar Administradores sobre novo cadastro pendente (tenant ${event.tenantId}): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
