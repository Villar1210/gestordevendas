// src/modules/atendimento/application/use-cases/enviar-mensagem-atendimento.use-case.ts
// Envia uma mensagem de resposta dentro de um Atendimento - reaproveita
// SendWhatsAppMessageUseCase (modulo whatsappmarketing), que ja cuida de
// checar a sessao/enviar via Baileys/persistir o WhatsAppMessage OUT.
import { Injectable, Inject, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { IAtendimentoRepository } from '../../domain/repositories/atendimento-repository.interface';
import { SendWhatsAppMessageUseCase } from '../../../whatsappmarketing/application/use-cases/send-whatsapp-message.use-case';

interface EnviarMensagemAtendimentoInput {
  tenantId: string;
  atendimentoId: string;
  requesterId: string;
  requesterRole: string;
  body: string;
}

@Injectable()
export class EnviarMensagemAtendimentoUseCase {
  constructor(
    @Inject('IAtendimentoRepository')
    private readonly atendimentoRepository: IAtendimentoRepository,
    private readonly sendWhatsAppMessageUseCase: SendWhatsAppMessageUseCase,
  ) {}

  async execute(input: EnviarMensagemAtendimentoInput): Promise<void> {
    const body = input.body.trim();
    if (!body) {
      throw new BadRequestException('Informe o texto da mensagem.');
    }

    const atendimento = await this.atendimentoRepository.findByIdAndTenant(
      input.atendimentoId,
      input.tenantId,
    );
    if (!atendimento) {
      throw new NotFoundException('Atendimento nao encontrado.');
    }
    // Auditoria de seguranca (achado I2): mesmo padrao ja usado em
    // CloseAtendimentoUseCase/TransferAtendimentoUseCase/RequeueAtendimentoUseCase -
    // so o dono do atendimento ou o Administrador podem agir.
    if (input.requesterRole !== 'Administrador' && atendimento.ownerId !== input.requesterId) {
      throw new ForbiddenException('Apenas o Administrador ou o dono do atendimento pode enviar mensagem.');
    }

    await this.sendWhatsAppMessageUseCase.execute({
      sessionId: atendimento.whatsappSessionId,
      tenantId: input.tenantId,
      to: atendimento.remoteJid,
      phoneNumber: atendimento.phoneNumber,
      body,
    });
  }
}
