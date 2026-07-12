// src/modules/atendimento/application/use-cases/list-atendimentos.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IAtendimentoRepository,
  AtendimentoWithNames,
} from '../../domain/repositories/atendimento-repository.interface';
import { IFilaRepository } from '../../domain/repositories/fila-repository.interface';
import { IWhatsAppMessageRepository } from '../../../whatsappmarketing/domain/repositories/whatsapp-message-repository.interface';

interface ListAtendimentosInput {
  tenantId: string;
  requesterRole: string;
  requesterUserId: string;
  filaId?: string;
  status?: string;
  ownerId?: string;
}

export interface AtendimentoListItem extends AtendimentoWithNames {
  lastMessageBody: string | null;
  lastMessageAt: Date | null;
}

@Injectable()
export class ListAtendimentosUseCase {
  constructor(
    @Inject('IAtendimentoRepository')
    private readonly atendimentoRepository: IAtendimentoRepository,
    @Inject('IFilaRepository') private readonly filaRepository: IFilaRepository,
    @Inject('IWhatsAppMessageRepository')
    private readonly whatsAppMessageRepository: IWhatsAppMessageRepository,
  ) {}

  async execute(input: ListAtendimentosInput): Promise<AtendimentoListItem[]> {
    const isAdmin = input.requesterRole === 'Administrador';

    // Corretor/Agente so ve o que pertence as proprias filas + o que ja
    // assumiu - Administrador nao tem restricao de escopo (ve tudo, inclusive
    // atendimentos ainda "nao classificados" para poder atribui-los).
    const visibleFilaIds = isAdmin
      ? undefined
      : await this.filaRepository.findFilaIdsByUsuario(input.requesterUserId);
    const visibleOwnerId = isAdmin ? undefined : input.requesterUserId;

    const atendimentos = await this.atendimentoRepository.findAllByTenant(input.tenantId, {
      filaId: input.filaId,
      status: input.status,
      ownerId: input.ownerId,
      visibleFilaIds,
      visibleOwnerId,
    });

    // Preview da ultima mensagem para a lista da Central de Atendimento -
    // 1 consulta por atendimento visivel (WhatsAppMessage nao tem FK para
    // Atendimento de proposito, ver schema.prisma). Aceitavel na escala
    // atual (dezenas de atendimentos abertos por tenant); se crescer muito,
    // avaliar desnormalizar um "lastMessageAt" no proprio Atendimento.
    return Promise.all(
      atendimentos.map(async (atendimento) => {
        const recent = await this.whatsAppMessageRepository.findRecentBySessionAndNumber(
          atendimento.whatsappSessionId,
          atendimento.phoneNumber,
          1,
        );
        const last = recent[recent.length - 1] ?? null;
        return {
          ...atendimento,
          lastMessageBody: last?.body ?? null,
          lastMessageAt: last?.timestamp ?? null,
        };
      }),
    );
  }
}
