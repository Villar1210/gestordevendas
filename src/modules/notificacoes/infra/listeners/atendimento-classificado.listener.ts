// src/modules/notificacoes/infra/listeners/atendimento-classificado.listener.ts
// Escuta o evento generico emitido por ClassifyAndRouteAtendimentoUseCase
// (modulo atendimento) quando a VIVI roteia uma conversa para uma fila de
// suporte. Nao ha import direto entre os dois modulos alem do que ja e
// exportado (IFilaRepository) - o unico contrato adicional e o nome do
// evento e o formato do payload, por convencao (mesmo padrao ja usado por
// CadastroPendenteCriadoListener/CardSemDonoCriadoListener). Ver CLAUDE.md
// "Decisao tecnica: Organizacao de pastas por modulo".
//
// Diferente de LeadAtribuidoListener (notifica 1 usuario - o dono ja
// decidido pela Roleta), aqui NAO existe um dono ainda (o atendimento fica
// "aguardando" ate alguem assumir) - o publico certo e todo mundo
// vinculado aquela fila, mesmo padrao de "notificar um grupo" ja usado por
// CadastroPendenteCriadoListener (que notifica todos os Administradores).
import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { IFilaRepository } from '../../../atendimento/domain/repositories/fila-repository.interface';
import { CreateNotificationUseCase } from '../../application/use-cases/create-notification.use-case';

interface AtendimentoClassificadoEvent {
  tenantId: string;
  atendimentoId: string;
  filaId: string;
  filaNome: string;
  urgente: boolean;
}

@Injectable()
export class AtendimentoClassificadoListener {
  private readonly logger = new Logger(AtendimentoClassificadoListener.name);

  constructor(
    @Inject('IFilaRepository') private readonly filaRepository: IFilaRepository,
    private readonly createNotificationUseCase: CreateNotificationUseCase,
  ) {}

  @OnEvent('atendimento.classificado')
  async handle(event: AtendimentoClassificadoEvent): Promise<void> {
    try {
      const fila = await this.filaRepository.findByIdAndTenant(event.filaId, event.tenantId);
      if (!fila) {
        this.logger.warn(`Fila ${event.filaId} nao encontrada - notificacao ignorada.`);
        return;
      }

      // findByIdAndTenant nao devolve usuarioIds (ver FilaRecord vs
      // FilaWithUsuarioIds) - findAllByTenant e o unico metodo que ja traz
      // essa lista, sem precisar de um metodo novo no repositorio so pra isso.
      const filas = await this.filaRepository.findAllByTenant(event.tenantId);
      const usuarioIds = filas.find((f) => f.id === event.filaId)?.usuarioIds ?? [];

      const mensagem = event.urgente
        ? `Atendimento URGENTE na fila "${event.filaNome}"`
        : `Novo atendimento na fila "${event.filaNome}"`;

      await Promise.all(
        usuarioIds.map((userId) =>
          this.createNotificationUseCase.execute({
            tenantId: event.tenantId,
            userId,
            tipo: 'atendimento_classificado',
            mensagem,
            link: '/dashboard/atendimento',
          }),
        ),
      );
    } catch (error) {
      // Nunca deixa uma falha de notificacao derrubar a classificacao do
      // atendimento - so registra o erro (mesmo padrao ja usado em
      // CardSemDonoCriadoListener/LeadAtribuidoListener).
      this.logger.error(
        `Falha ao notificar fila sobre atendimento classificado (atendimento ${event.atendimentoId}): ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }
}
