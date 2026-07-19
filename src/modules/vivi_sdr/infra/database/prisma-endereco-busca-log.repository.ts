// src/modules/vivi_sdr/infra/database/prisma-endereco-busca-log.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IEnderecoBuscaLogRepository,
  EnderecoBuscaLogRecord,
} from '../../domain/repositories/endereco-busca-log-repository.interface';

@Injectable()
export class PrismaEnderecoBuscaLogRepository implements IEnderecoBuscaLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: {
    tenantId: string;
    phoneNumber: string;
    enderecoBuscado: string;
    encontradoCatalogo: boolean;
    nomeEncontradoCatalogo?: string | null;
    precisouBuscaExterna: boolean;
    confirmadoExternamente?: boolean | null;
    nomeEncontradoExterno?: string | null;
    escalonado: boolean;
    motivoEscalonamento?: string | null;
  }): Promise<EnderecoBuscaLogRecord> {
    return this.prisma.enderecoBuscaLog.create({
      data: {
        tenantId: input.tenantId,
        phoneNumber: input.phoneNumber,
        enderecoBuscado: input.enderecoBuscado,
        encontradoCatalogo: input.encontradoCatalogo,
        nomeEncontradoCatalogo: input.nomeEncontradoCatalogo ?? null,
        precisouBuscaExterna: input.precisouBuscaExterna,
        confirmadoExternamente: input.confirmadoExternamente ?? null,
        nomeEncontradoExterno: input.nomeEncontradoExterno ?? null,
        escalonado: input.escalonado,
        motivoEscalonamento: input.motivoEscalonamento ?? null,
      },
    });
  }
}
