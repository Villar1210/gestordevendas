// src/modules/gestao_imobiliaria/application/use-cases/create-proprietario.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IProprietarioRepository,
  ProprietarioRecord,
  ProprietarioWritableFields,
} from '../../domain/repositories/proprietario-repository.interface';

interface CreateProprietarioInput extends ProprietarioWritableFields {
  tenantId: string;
  nome: string;
  telefone: string;
}

@Injectable()
export class CreateProprietarioUseCase {
  constructor(
    @Inject('IProprietarioRepository')
    private readonly proprietarioRepository: IProprietarioRepository,
  ) {}

  async execute(input: CreateProprietarioInput): Promise<ProprietarioRecord> {
    return this.proprietarioRepository.create(input);
  }
}
