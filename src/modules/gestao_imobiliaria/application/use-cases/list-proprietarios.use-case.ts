// src/modules/gestao_imobiliaria/application/use-cases/list-proprietarios.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IProprietarioRepository,
  ProprietarioRecord,
} from '../../domain/repositories/proprietario-repository.interface';

@Injectable()
export class ListProprietariosUseCase {
  constructor(
    @Inject('IProprietarioRepository')
    private readonly proprietarioRepository: IProprietarioRepository,
  ) {}

  async execute(tenantId: string): Promise<ProprietarioRecord[]> {
    return this.proprietarioRepository.findAllByTenant(tenantId);
  }
}
