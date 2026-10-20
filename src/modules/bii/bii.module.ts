// src/modules/bii/bii.module.ts
// BII (Business Intelligence Imobiliario) - Fatia 1: historico de etapas
// (listener de 'card.stage.changed') + Painel de Vendas (GET /bii/painel).
// Nao importa nenhum outro modulo de negocio: le Card/Stage/Pipeline/User por
// repositorios proprios. EventEmitterModule ja e global (app.module.ts).
import { Module } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { BiiPainelController } from './infra/http/bii-painel.controller';
import { GetPainelVendasUseCase } from './application/use-cases/get-painel-vendas.use-case';
import { CardStageChangedListener } from './infra/listeners/card-stage-changed.listener';
import { PrismaPainelVendasRepository } from './infra/database/prisma-painel-vendas.repository';
import { PrismaCardStageEventoRepository } from './infra/database/prisma-card-stage-evento.repository';

@Module({
  controllers: [BiiPainelController],
  providers: [
    PrismaService,
    GetPainelVendasUseCase,
    CardStageChangedListener,
    { provide: 'IPainelVendasRepository', useClass: PrismaPainelVendasRepository },
    { provide: 'ICardStageEventoRepository', useClass: PrismaCardStageEventoRepository },
  ],
})
export class BiiModule {}
