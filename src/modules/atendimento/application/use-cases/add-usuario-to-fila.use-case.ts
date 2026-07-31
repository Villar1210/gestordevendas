// src/modules/atendimento/application/use-cases/add-usuario-to-fila.use-case.ts
import { Injectable, Inject, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { IFilaRepository } from '../../domain/repositories/fila-repository.interface';
import { IUserRepository } from '../../../auth/domain/repositories/user-repository.interface';

interface AddUsuarioToFilaInput {
  tenantId: string;
  filaId: string;
  userId: string;
}

@Injectable()
export class AddUsuarioToFilaUseCase {
  private readonly logger = new Logger(AddUsuarioToFilaUseCase.name);

  constructor(
    @Inject('IFilaRepository') private readonly filaRepository: IFilaRepository,
    @Inject('IUserRepository') private readonly userRepository: IUserRepository,
  ) {}

  async execute(input: AddUsuarioToFilaInput): Promise<void> {
    const fila = await this.filaRepository.findByIdAndTenant(input.filaId, input.tenantId);
    if (!fila) {
      throw new NotFoundException('Fila nao encontrada.');
    }

    const user = await this.userRepository.findById(input.userId);
    if (!user || user.tenantId !== input.tenantId) {
      throw new BadRequestException('Usuario invalido.');
    }

    await this.filaRepository.addUsuario(input.filaId, input.userId);
    this.logger.log(`[Atendimento] Usuario ${input.userId} vinculado a fila "${fila.nome}" (${fila.id}).`);
  }
}
