// src/modules/gestao_imobiliaria/application/use-cases/create-inquilino-comprador.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IInquilinoCompradorRepository,
  InquilinoCompradorRecord,
  InquilinoCompradorWritableFields,
} from '../../domain/repositories/inquilino-comprador-repository.interface';

interface CreateInquilinoCompradorInput extends InquilinoCompradorWritableFields {
  tenantId: string;
  nome: string;
  telefone: string;
}

@Injectable()
export class CreateInquilinoCompradorUseCase {
  constructor(
    @Inject('IInquilinoCompradorRepository')
    private readonly inquilinoCompradorRepository: IInquilinoCompradorRepository,
  ) {}

  async execute(input: CreateInquilinoCompradorInput): Promise<InquilinoCompradorRecord> {
    return this.inquilinoCompradorRepository.create(input);
  }
}
