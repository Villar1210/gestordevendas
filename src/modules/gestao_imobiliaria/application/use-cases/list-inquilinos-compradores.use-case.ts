// src/modules/gestao_imobiliaria/application/use-cases/list-inquilinos-compradores.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IInquilinoCompradorRepository,
  InquilinoCompradorRecord,
} from '../../domain/repositories/inquilino-comprador-repository.interface';

@Injectable()
export class ListInquilinosCompradoresUseCase {
  constructor(
    @Inject('IInquilinoCompradorRepository')
    private readonly inquilinoCompradorRepository: IInquilinoCompradorRepository,
  ) {}

  async execute(tenantId: string): Promise<InquilinoCompradorRecord[]> {
    return this.inquilinoCompradorRepository.findAllByTenant(tenantId);
  }
}
