// src/modules/vivi_sdr/application/use-cases/get-or-create-vivi-config.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import {
  IViviConfigRepository,
  ViviConfigRecord,
} from '../../domain/repositories/vivi-config-repository.interface';

interface GetOrCreateViviConfigInput {
  tenantId: string;
}

// Evita depender de setup manual: a primeira vez que um tenant precisa da
// config da VIVI (leitura pela UI ou uso interno em ProcessIncomingMessageUseCase)
// e ainda nao existe nenhuma linha, cria uma com os defaults do schema
// (mesmo padrao ja usado por GetOrCreateContratoTemplateUseCase/RoletaConfig).
@Injectable()
export class GetOrCreateViviConfigUseCase {
  constructor(
    @Inject('IViviConfigRepository') private readonly viviConfigRepository: IViviConfigRepository,
  ) {}

  async execute(input: GetOrCreateViviConfigInput): Promise<ViviConfigRecord> {
    const existente = await this.viviConfigRepository.findByTenantId(input.tenantId);
    if (existente) {
      return existente;
    }
    return this.viviConfigRepository.create(input.tenantId);
  }
}
