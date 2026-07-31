// src/modules/atendimento/application/use-cases/create-fila.use-case.ts
import { Injectable, Inject, Logger, BadRequestException } from '@nestjs/common';
import { IFilaRepository, FilaRecord } from '../../domain/repositories/fila-repository.interface';

interface CreateFilaInput {
  tenantId: string;
  nome: string;
  descricao?: string | null;
}

@Injectable()
export class CreateFilaUseCase {
  private readonly logger = new Logger(CreateFilaUseCase.name);

  constructor(@Inject('IFilaRepository') private readonly filaRepository: IFilaRepository) {}

  async execute(input: CreateFilaInput): Promise<FilaRecord> {
    const nome = input.nome.trim();
    if (!nome) {
      throw new BadRequestException('Informe o nome da fila.');
    }

    const existing = await this.filaRepository.findByTenantAndNome(input.tenantId, nome);
    if (existing) {
      throw new BadRequestException('Ja existe uma fila com esse nome.');
    }

    const fila = await this.filaRepository.create({
      tenantId: input.tenantId,
      nome,
      descricao: input.descricao?.trim() || null,
    });
    this.logger.log(`[Atendimento] Fila "${fila.nome}" criada (${fila.id}) para tenant ${input.tenantId}.`);
    return fila;
  }
}
