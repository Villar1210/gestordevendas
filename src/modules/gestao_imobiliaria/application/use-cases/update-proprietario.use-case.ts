// src/modules/gestao_imobiliaria/application/use-cases/update-proprietario.use-case.ts
import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import {
  IProprietarioRepository,
  ProprietarioRecord,
  ProprietarioWritableFields,
} from '../../domain/repositories/proprietario-repository.interface';

interface UpdateProprietarioInput extends ProprietarioWritableFields {
  proprietarioId: string;
  tenantId: string;
}

@Injectable()
export class UpdateProprietarioUseCase {
  constructor(
    @Inject('IProprietarioRepository')
    private readonly proprietarioRepository: IProprietarioRepository,
  ) {}

  async execute(input: UpdateProprietarioInput): Promise<ProprietarioRecord> {
    const { proprietarioId, tenantId, ...fields } = input;

    const proprietario = await this.proprietarioRepository.findByIdAndTenant(
      proprietarioId,
      tenantId,
    );
    if (!proprietario) {
      throw new NotFoundException('Proprietario nao encontrado.');
    }

    return this.proprietarioRepository.update(proprietarioId, fields);
  }
}
