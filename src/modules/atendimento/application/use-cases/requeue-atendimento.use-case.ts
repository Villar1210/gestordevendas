// src/modules/atendimento/application/use-cases/requeue-atendimento.use-case.ts
// Devolve o atendimento para "aguardando" na mesma fila, sem dono - mesma
// ideia do "requeue" do wacalls-chat (estudado como referencia conceitual,
// nao copiado - ver CLAUDE.md).
import { Injectable, Inject, Logger, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import {
  IAtendimentoRepository,
  AtendimentoRecord,
} from '../../domain/repositories/atendimento-repository.interface';
import { IAtendimentoEventoRepository } from '../../domain/repositories/atendimento-evento-repository.interface';

interface RequeueAtendimentoInput {
  tenantId: string;
  atendimentoId: string;
  requesterId: string;
  requesterRole: string;
}

@Injectable()
export class RequeueAtendimentoUseCase {
  private readonly logger = new Logger(RequeueAtendimentoUseCase.name);

  constructor(
    @Inject('IAtendimentoRepository')
    private readonly atendimentoRepository: IAtendimentoRepository,
    @Inject('IAtendimentoEventoRepository')
    private readonly eventoRepository: IAtendimentoEventoRepository,
  ) {}

  async execute(input: RequeueAtendimentoInput): Promise<AtendimentoRecord> {
    const atendimento = await this.atendimentoRepository.findByIdAndTenant(
      input.atendimentoId,
      input.tenantId,
    );
    if (!atendimento) {
      throw new NotFoundException('Atendimento nao encontrado.');
    }
    if (atendimento.status === 'fechado') {
      throw new ConflictException('Este atendimento ja foi fechado.');
    }
    if (input.requesterRole !== 'Administrador' && atendimento.ownerId !== input.requesterId) {
      throw new ForbiddenException('Apenas o Administrador ou o dono do atendimento pode devolve-lo.');
    }

    const updated = await this.atendimentoRepository.update(atendimento.id, {
      ownerId: null,
      status: 'aguardando',
      // Auditoria (achado I6): sem isso, um atendimento ja escalonado uma vez
      // fica permanentemente invisivel a EscalonarAtendimentosSemDonoUseCase
      // (filtro escalonamentoNotificadoEm: null, sem janela de tempo - ver
      // findAguardandoSemDonoNaoEscalonados) mesmo devolvido e ficando sem
      // dono de novo depois.
      escalonamentoNotificadoEm: null,
    });

    await this.eventoRepository.create({
      atendimentoId: atendimento.id,
      tipo: 'devolvido',
      userId: input.requesterId,
    });

    this.logger.log(`[Atendimento] Atendimento ${atendimento.id} devolvido a fila por ${input.requesterId}.`);
    return updated;
  }
}
