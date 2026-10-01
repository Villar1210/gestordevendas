// src/modules/rh/infra/listeners/contrato-parceria-assinado.listener.ts
// Escuta o evento generico do E-doc ('edoc.envelope.concluido'). Se o
// envelope for o contrato de prestacao de servico de algum cadastro,
// libera o acesso (quando estava bloqueado) e emite
// 'contrato.parceria.assinado' para o aviso ao RH (modulo notificacoes).
// O E-doc nao conhece este modulo - so o nome do evento e o payload.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { ICadastroRepository } from '../../domain/repositories/cadastro-repository.interface';

interface EnvelopeConcluidoEvent {
  tenantId: string;
  envelopeId: string;
}

@Injectable()
export class ContratoParceriaAssinadoListener {
  private readonly logger = new Logger(ContratoParceriaAssinadoListener.name);

  constructor(
    @Inject('ICadastroRepository') private readonly cadastroRepository: ICadastroRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @OnEvent('edoc.envelope.concluido')
  async handle(event: EnvelopeConcluidoEvent): Promise<void> {
    try {
      const cadastro = await this.cadastroRepository.findByContratoEnvelopeId(event.envelopeId);
      // Envelope comum do E-doc (nao e contrato de parceria) ou de outra empresa.
      if (!cadastro || cadastro.tenantId !== event.tenantId) return;

      await this.cadastroRepository.setAguardandoAssinaturaContrato(cadastro.id, false);

      this.eventEmitter.emit('contrato.parceria.assinado', {
        tenantId: cadastro.tenantId,
        userId: cadastro.id,
        nome: cadastro.nomeImobiliaria ?? cadastro.name,
        roleName: cadastro.roleName,
      });
    } catch (error) {
      this.logger.error(
        `Falha ao processar contrato assinado (envelope ${event.envelopeId}): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
