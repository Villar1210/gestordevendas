// src/modules/site_publico/site-publico.module.ts
// Site imobiliario publico (vitrine sem login, por empresa).
import { Module } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { VendasKanbanModule } from '../vendas_kanban/vendas-kanban.module';
import { SitePublicoService } from './application/site-publico.service';
import { SITE_PUBLICO_REPOSITORY } from './domain/site-publico-repository.interface';
import { PrismaSitePublicoRepository } from './infra/database/prisma-site-publico.repository';
import { SitePublicoController } from './infra/http/site-publico.controller';

@Module({
  imports: [VendasKanbanModule],
  controllers: [SitePublicoController],
  providers: [
    PrismaService,
    SitePublicoService,
    { provide: SITE_PUBLICO_REPOSITORY, useClass: PrismaSitePublicoRepository },
  ],
})
export class SitePublicoModule {}
