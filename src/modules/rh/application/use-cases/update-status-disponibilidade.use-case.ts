// src/modules/rh/application/use-cases/update-status-disponibilidade.use-case.ts
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ICorretorRepository } from '../../domain/repositories/corretor-repository.interface';

const VALID_STATUSES = ['online', 'ausente', 'offline'];

interface UpdateStatusDisponibilidadeInput {
  userId: string;
  tenantId: string;
  status: string;
}

@Injectable()
export class UpdateStatusDisponibilidadeUseCase {
  constructor(
    @Inject('ICorretorRepository') private readonly corretorRepository: ICorretorRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async execute(input: UpdateStatusDisponibilidadeInput): Promise<void> {
    if (!VALID_STATUSES.includes(input.status)) {
      throw new BadRequestException(
        `Status invalido. Use um destes: ${VALID_STATUSES.join(', ')}.`,
      );
    }

    await this.corretorRepository.updateStatusDisponibilidade(
      input.userId,
      input.tenantId,
      input.status,
    );

    // Rede de seguranca "sem corretor online" (Camada 1 - retry): so
    // dispara ao FICAR online (nao em toda troca de status) - quem escuta
    // (roleta_online/notificacoes) decide o que fazer. emit() nao aguarda
    // o listener, mesmo padrao ja usado em CreateQuickCardUseCase para
    // 'card.sem_dono.criado'.
    if (input.status === 'online') {
      this.eventEmitter.emit('corretor.ficou_online', {
        tenantId: input.tenantId,
        userId: input.userId,
      });
    }
  }
}
