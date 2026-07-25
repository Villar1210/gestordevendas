// src/modules/notificacoes/infra/listeners/vivi-uso-anomalo.listener.ts
// Escuta os eventos genericos emitidos por RegistrarUsoViviUseCase (modulo
// vivi_sdr, Fatia B - controle de volume/custo) quando o uso diario da VIVI
// (WhatsApp + Instagram/Facebook somados) entra num dos 3 niveis de volume
// (Atencao/Critico) ou aciona a suspeita de uso concentrado (poucos
// numeros/contatos distintos gerando muitas mensagens). Mesmo padrao ja
// usado por CadastroPendenteCriadoListener/CardSemDonoEscalonadoListener:
// nenhum import direto de vivi_sdr, o unico contrato e o nome do evento e o
// formato do payload, por convencao.
import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IUserRepository } from '../../../auth/domain/repositories/user-repository.interface';
import { CreateNotificationUseCase } from '../../application/use-cases/create-notification.use-case';

const ADMINISTRADOR_ROLE_NAME = 'Administrador';

interface ViviLimiteNivelEvent {
  tenantId: string;
  totalMensagens: number;
  limite: number;
}

interface ViviUsoConcentradoSuspeitoEvent {
  tenantId: string;
  totalMensagens: number;
  numerosDistintos: number;
}

@Injectable()
export class ViviUsoAnomaloListener {
  private readonly logger = new Logger(ViviUsoAnomaloListener.name);

  constructor(
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
    private readonly createNotificationUseCase: CreateNotificationUseCase,
  ) {}

  @OnEvent('vivi.limite_atencao.atingido')
  async handleAtencao(event: ViviLimiteNivelEvent): Promise<void> {
    await this.notificarAdministradores(
      event.tenantId,
      'vivi_limite_atencao_atingido',
      `Atencao: a VIVI ja processou ${event.totalMensagens} mensagens hoje, acima do limite ` +
        `configurado (${event.limite}/dia). Ainda dentro do esperado, mas vale acompanhar.`,
    );
  }

  @OnEvent('vivi.limite_critico.atingido')
  async handleCritico(event: ViviLimiteNivelEvent): Promise<void> {
    await this.notificarAdministradores(
      event.tenantId,
      'vivi_limite_critico_atingido',
      `Critico: a VIVI ja processou ${event.totalMensagens} mensagens hoje, mais que o dobro do ` +
        `limite configurado (${event.limite}/dia). Recomendado verificar o uso o quanto antes.`,
    );
  }

  @OnEvent('vivi.uso_concentrado.suspeito')
  async handleConcentracaoSuspeita(event: ViviUsoConcentradoSuspeitoEvent): Promise<void> {
    await this.notificarAdministradores(
      event.tenantId,
      'vivi_uso_concentrado_suspeito',
      `Suspeita de uso concentrado: ${event.totalMensagens} mensagens hoje vindas de apenas ` +
        `${event.numerosDistintos} numero(s)/contato(s) distinto(s). Pode indicar spam ou loop, ` +
        `nao uso legitimo distribuido entre varios leads.`,
    );
  }

  private async notificarAdministradores(tenantId: string, tipo: string, mensagem: string): Promise<void> {
    try {
      const administradores = await this.userRepository.findAllByTenantAndRole(
        tenantId,
        ADMINISTRADOR_ROLE_NAME,
      );

      await Promise.all(
        administradores.map((admin) =>
          this.createNotificationUseCase.execute({
            tenantId,
            userId: admin.id,
            tipo,
            mensagem,
          }),
        ),
      );
    } catch (error) {
      // Nunca deixa uma falha de notificacao derrubar o processamento da
      // mensagem que disparou o alerta - mesmo padrao ja usado nos demais
      // listeners deste modulo.
      this.logger.error(
        `Falha ao notificar Administradores sobre uso anomalo da VIVI (tenant ${tenantId}, tipo ${tipo}): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
