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
import { IEmailSender } from '../../../../shared/domain/services/email-sender.interface';
import { montarEmailNovoCadastro } from '../../application/templates/novo-cadastro.email';

const ADMINISTRADOR_ROLE_NAME = 'Administrador';

interface CadastroPendenteCriadoEvent {
  tenantId: string;
  // Opcional so por compatibilidade: sem ele o link cai na lista geral.
  cadastroId?: string;
  nome: string;
  roleName: string;
}

@Injectable()
export class CadastroPendenteCriadoListener {
  private readonly logger = new Logger(CadastroPendenteCriadoListener.name);

  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    private readonly createNotificationUseCase: CreateNotificationUseCase,
    @Inject('IEmailSender') private readonly emailSender: IEmailSender,
  ) {}

  @OnEvent('cadastro.pendente.criado')
  async handle(event: CadastroPendenteCriadoEvent): Promise<void> {
    // Link direto para o cadastro: a tela de Aprovacoes le ?cadastro= e ja
    // abre o painel de aprovar/rejeitar daquele cadastro.
    const linkInterno = event.cadastroId
      ? `/dashboard/rh/aprovacoes?cadastro=${encodeURIComponent(event.cadastroId)}`
      : '/dashboard/rh/aprovacoes';

    let administradores: { id: string }[] = [];
    try {
      administradores = await this.userRepository.findAllByTenantAndRole(
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
            link: linkInterno,
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

    // E-mail, alem do sininho: o Administrador fica sabendo mesmo sem estar
    // logado. Cada envio e independente - um e-mail que falha nao impede os
    // outros (nem a notificacao interna, ja gravada acima).
    const urlPlataforma = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
    await Promise.all(
      administradores.map(async (admin) => {
        try {
          const usuario = await this.userRepository.findById(admin.id);
          if (!usuario?.email) return;
          const { subject, body } = montarEmailNovoCadastro({
            nomeAdministrador: usuario.name ?? '',
            nomeCadastro: event.nome,
            roleName: event.roleName,
            link: `${urlPlataforma}${linkInterno}`,
            urlPlataforma,
          });
          await this.emailSender.send({ to: usuario.email, subject, body });
        } catch (error) {
          this.logger.error(
            `Falha ao enviar e-mail de novo cadastro ao Administrador ${admin.id}: ${
              error instanceof Error ? error.message : error
            }`,
          );
        }
      }),
    );
  }
}
