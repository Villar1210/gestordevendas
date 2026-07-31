// src/modules/whatsappmarketing/application/use-cases/send-whatsapp-message.use-case.ts
import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IWhatsAppSessionRepository } from '../../domain/repositories/whatsapp-session-repository.interface';
import { IWhatsAppProvider } from '../../domain/services/whatsapp-provider.interface';

interface SendWhatsAppMessageInput {
  sessionId: string;
  tenantId: string;
  // Preferencialmente o JID completo (remoteJid) da conversa, para
  // sobreviver a numeros @lid (ver IWhatsAppProvider.sendMessage). O envio
  // manual via formulario ainda pode passar so digitos - o provider trata
  // os dois casos.
  to: string;
  body: string;
  // Numero real do destinatario, quando quem chama ja o resolveu de forma
  // confiavel (responder a uma mensagem recebida) - ver
  // IWhatsAppProvider.sendMessage para o porque disso importar quando "to"
  // e um JID @lid.
  phoneNumber?: string;
}

@Injectable()
export class SendWhatsAppMessageUseCase {
  constructor(
    @Inject('IWhatsAppSessionRepository')
    private readonly sessionRepository: IWhatsAppSessionRepository,
    @Inject('IWhatsAppProvider') private readonly whatsAppProvider: IWhatsAppProvider,
  ) {}

  async execute(input: SendWhatsAppMessageInput): Promise<void> {
    const session = await this.sessionRepository.findByIdAndTenant(
      input.sessionId,
      input.tenantId,
    );
    if (!session) {
      throw new NotFoundException('Sessao WhatsApp nao encontrada.');
    }

    if (session.status !== 'CONNECTED') {
      throw new BadRequestException('Sessao WhatsApp nao esta conectada.');
    }

    // session.status e so um filtro rapido (evita a chamada ao provider
    // quando ja se sabe que a sessao esta desconectada) - pode ficar STALE
    // apos um restart do processo (o socket em memoria some, mas o ultimo
    // valor gravado no banco continua "CONNECTED" ate o proximo evento
    // 'open'/'close' do Baileys). isConnected() e a checagem real, contra o
    // estado do socket em memoria (ver IWhatsAppProvider.isConnected).
    if (!this.whatsAppProvider.isConnected(session.id)) {
      throw new BadRequestException(
        'Sessao WhatsApp nao esta conectada (socket real desconectado, apesar do status gravado).',
      );
    }

    await this.whatsAppProvider.sendMessage(session.id, input.to, input.body, input.phoneNumber);
  }
}
