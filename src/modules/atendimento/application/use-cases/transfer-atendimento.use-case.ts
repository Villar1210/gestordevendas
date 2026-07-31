// src/modules/atendimento/application/use-cases/transfer-atendimento.use-case.ts
import { Injectable, Inject, Logger, NotFoundException, ConflictException, ForbiddenException, BadRequestException } from '@nestjs/common';
import {
  IAtendimentoRepository,
  AtendimentoRecord,
} from '../../domain/repositories/atendimento-repository.interface';
import { IAtendimentoEventoRepository } from '../../domain/repositories/atendimento-evento-repository.interface';
import { IFilaRepository } from '../../domain/repositories/fila-repository.interface';
import { IUserRepository } from '../../../auth/domain/repositories/user-repository.interface';

interface TransferAtendimentoInput {
  tenantId: string;
  atendimentoId: string;
  requesterId: string;
  requesterRole: string;
  // Pelo menos um dos dois deve ser informado.
  novoFilaId?: string;
  novoOwnerId?: string;
}

@Injectable()
export class TransferAtendimentoUseCase {
  private readonly logger = new Logger(TransferAtendimentoUseCase.name);

  constructor(
    @Inject('IAtendimentoRepository')
    private readonly atendimentoRepository: IAtendimentoRepository,
    @Inject('IAtendimentoEventoRepository')
    private readonly eventoRepository: IAtendimentoEventoRepository,
    @Inject('IFilaRepository')
    private readonly filaRepository: IFilaRepository,
    @Inject('IUserRepository')
    private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: TransferAtendimentoInput): Promise<AtendimentoRecord> {
    if (!input.novoFilaId && !input.novoOwnerId) {
      throw new BadRequestException('Informe a nova fila e/ou o novo agente.');
    }

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
      throw new ForbiddenException('Apenas o Administrador ou o dono do atendimento pode transferi-lo.');
    }

    // Auditoria de seguranca (achado I1): sem isso, um dono de atendimento
    // (nao-Admin) podia transferir para qualquer UUID arbitrario, inclusive
    // de outro tenant - quebrando isolamento multitenant a nivel de dado
    // (Atendimento.ownerId/filaId nao tem FK formal, ver schema.prisma).
    // Mesmo padrao de validacao ja usado em AddUsuarioToFilaUseCase.
    if (input.novoFilaId) {
      const fila = await this.filaRepository.findByIdAndTenant(input.novoFilaId, input.tenantId);
      if (!fila) {
        throw new NotFoundException('Fila de destino nao encontrada.');
      }
    }
    if (input.novoOwnerId) {
      const novoOwner = await this.userRepository.findById(input.novoOwnerId);
      if (!novoOwner || novoOwner.tenantId !== input.tenantId) {
        throw new NotFoundException('Agente de destino nao encontrado.');
      }
    }

    const updated = await this.atendimentoRepository.update(atendimento.id, {
      ...(input.novoFilaId ? { filaId: input.novoFilaId } : {}),
      ...(input.novoOwnerId ? { ownerId: input.novoOwnerId, status: 'em_atendimento' } : {}),
    });

    const detalheParts: string[] = [];
    if (input.novoFilaId) detalheParts.push(`fila=${input.novoFilaId}`);
    if (input.novoOwnerId) detalheParts.push(`agente=${input.novoOwnerId}`);

    await this.eventoRepository.create({
      atendimentoId: atendimento.id,
      tipo: 'transferido',
      userId: input.requesterId,
      detalhe: detalheParts.join(' · '),
    });

    this.logger.log(
      `[Atendimento] Atendimento ${atendimento.id} transferido por ${input.requesterId} (${detalheParts.join(', ')}).`,
    );
    return updated;
  }
}
