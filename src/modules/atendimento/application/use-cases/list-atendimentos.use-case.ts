// src/modules/atendimento/application/use-cases/list-atendimentos.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IAtendimentoRepository,
  AtendimentoWithNames,
} from '../../domain/repositories/atendimento-repository.interface';
import { IFilaRepository } from '../../domain/repositories/fila-repository.interface';
import { IWhatsAppMessageRepository } from '../../../whatsappmarketing/domain/repositories/whatsapp-message-repository.interface';
import { GetSubordinadosRecursivosUseCase } from '../../../auth/application/use-cases/get-subordinados-recursivos.use-case';
import { resolveEscopo } from '../../../../shared/domain/services/cargo-escopo';

interface ListAtendimentosInput {
  tenantId: string;
  requesterRole: string;
  requesterUserId: string;
  requesterCargo: string | null;
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
    private readonly getSubordinadosRecursivosUseCase: GetSubordinadosRecursivosUseCase,
  ) {}

  async execute(input: ListAtendimentosInput): Promise<AtendimentoListItem[]> {
    // Escopo por cargo hierarquico (RBAC) SOMADO ao escopo por fila ja
    // existente (nao substitui) - visivel se pertencer a uma fila do
    // requisitante OU se o dono estiver dentro do escopo de cargo dele
    // (proprio/equipe/todos). Administrador/Diretor ('todos') nao tem
    // restricao nenhuma, igual antes desta fatia.
    const escopo = resolveEscopo(input.requesterRole, input.requesterCargo);

    let visibleFilaIds: string[] | undefined;
    let visibleOwnerIds: string[] | undefined;

    if (escopo !== 'todos') {
      visibleFilaIds = await this.filaRepository.findFilaIdsByUsuario(input.requesterUserId);
      if (escopo === 'equipe') {
        const subordinados = await this.getSubordinadosRecursivosUseCase.execute({
          tenantId: input.tenantId,
          userId: input.requesterUserId,
        });
        visibleOwnerIds = [input.requesterUserId, ...subordinados];
      } else {
        visibleOwnerIds = [input.requesterUserId];
      }
    }

    const atendimentos = await this.atendimentoRepository.findAllByTenant(input.tenantId, {
      filaId: input.filaId,
      status: input.status,
      ownerId: input.ownerId,
      visibleFilaIds,
      visibleOwnerIds,
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
