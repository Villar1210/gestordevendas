// src/modules/notificacoes/infra/listeners/contrato-parceria-assinado.listener.ts
// Escuta 'contrato.parceria.assinado' (emitido pelo modulo rh quando o
// contrato de prestacao de servico conclui no E-doc) e avisa os
// Administradores pelo sininho e por e-mail. Mesmo padrao do
// CadastroPendenteCriadoListener: falhas so viram log.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IUserRepository } from '../../../auth/domain/repositories/user-repository.interface';
import { CreateNotificationUseCase } from '../../application/use-cases/create-notification.use-case';
import { IEmailSender } from '../../../../shared/domain/services/email-sender.interface';
import { montarEmailContratoAssinado } from '../../application/templates/novo-cadastro.email';

interface ContratoParceriaAssinadoEvent {
  tenantId: string;
  userId: string;
  nome: string;
  roleName: string;
}

const LINK_INTERNO = '/dashboard/rh/aprovacoes?aba=aprovados';

@Injectable()
export class ContratoParceriaAssinadoNotificaListener {
  private readonly logger = new Logger(ContratoParceriaAssinadoNotificaListener.name);

  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    private readonly createNotificationUseCase: CreateNotificationUseCase,
    @Inject('IEmailSender') private readonly emailSender: IEmailSender,
  ) {}

  @OnEvent('contrato.parceria.assinado')
  async handle(event: ContratoParceriaAssinadoEvent): Promise<void> {
    let administradores: { id: string }[] = [];
    try {
      administradores = await this.userRepository.findAllByTenantAndRole(event.tenantId, 'Administrador');
      await Promise.all(
        administradores.map((admin) =>
          this.createNotificationUseCase.execute({
            tenantId: event.tenantId,
            userId: admin.id,
            tipo: 'contrato_assinado',
            mensagem: `Contrato de parceria assinado: ${event.nome}`,
            link: LINK_INTERNO,
          }),
        ),
      );
    } catch (error) {
      this.logger.error(
        `Falha ao notificar contrato assinado (tenant ${event.tenantId}): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }

    const urlPlataforma = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
    await Promise.all(
      administradores.map(async (admin) => {
        try {
          const usuario = await this.userRepository.findById(admin.id);
          if (!usuario?.email) return;
          const { subject, body } = montarEmailContratoAssinado({
            nomeAdministrador: usuario.name ?? '',
            nomeContratado: event.nome,
            roleName: event.roleName,
            link: `${urlPlataforma}${LINK_INTERNO}`,
            urlPlataforma,
          });
          await this.emailSender.send({ to: usuario.email, subject, body });
        } catch (error) {
          this.logger.error(
            `Falha ao enviar e-mail de contrato assinado ao Administrador ${admin.id}: ${
              error instanceof Error ? error.message : error
            }`,
          );
        }
      }),
    );
  }
}
