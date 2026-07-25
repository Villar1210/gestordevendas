// src/modules/vivi_sdr/infra/database/prisma-vivi-uso-diario.repository.ts
// Camada de INFRA: traduz o contrato do dominio para comandos reais do Prisma.
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../config/prisma.service';
import {
  IViviUsoDiarioRepository,
  NivelAlertaVivi,
  ViviUsoDiarioRecord,
} from '../../domain/repositories/vivi-uso-diario-repository.interface';

// Mapa nivel -> nome da coluna, unico lugar que conhece essa traducao -
// evita repetir um switch/ternario em cada metodo abaixo.
const FLAG_POR_NIVEL: Record<NivelAlertaVivi, 'alertaAtencaoEnviado' | 'alertaCriticoEnviado' | 'alertaConcentracaoEnviado'> = {
  atencao: 'alertaAtencaoEnviado',
  critico: 'alertaCriticoEnviado',
  concentracao: 'alertaConcentracaoEnviado',
};

@Injectable()
export class PrismaViviUsoDiarioRepository implements IViviUsoDiarioRepository {
  constructor(private readonly prisma: PrismaService) {}

  async incrementAndGet(tenantId: string, dia: Date): Promise<ViviUsoDiarioRecord> {
    return this.prisma.viviUsoDiario.upsert({
      where: { tenantId_data: { tenantId, data: dia } },
      update: { totalMensagens: { increment: 1 } },
      create: { tenantId, data: dia, totalMensagens: 1 },
    });
  }

  async registrarNumeroDistinto(viviUsoDiarioId: string, numero: string): Promise<number> {
    // ON CONFLICT DO NOTHING (skipDuplicates) - idempotente para o mesmo
    // numero no mesmo dia, sem SELECT previo.
    await this.prisma.viviUsoDiarioNumero.createMany({
      data: [{ viviUsoDiarioId, numero }],
      skipDuplicates: true,
    });
    return this.prisma.viviUsoDiarioNumero.count({ where: { viviUsoDiarioId } });
  }

  async marcarAlertaEnviadoSeNecessario(id: string, nivel: NivelAlertaVivi): Promise<boolean> {
    const campo = FLAG_POR_NIVEL[nivel];
    const result = await this.prisma.viviUsoDiario.updateMany({
      where: { id, [campo]: false },
      data: { [campo]: true },
    });
    return result.count > 0;
  }
}
