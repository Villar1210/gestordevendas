// src/modules/rh/rh.module.ts
import { Module } from '@nestjs/common';
import { RhController } from './infra/http/rh.controller';
import { CreateCorretorUseCase } from './application/use-cases/create-corretor.use-case';
import { ListCorretoresUseCase } from './application/use-cases/list-corretores.use-case';
import { UpdateStatusDisponibilidadeUseCase } from './application/use-cases/update-status-disponibilidade.use-case';
import { PublicSignupUseCase } from './application/use-cases/public-signup.use-case';
import { ListCadastrosPendentesUseCase } from './application/use-cases/list-cadastros-pendentes.use-case';
import { AprovarCadastroUseCase } from './application/use-cases/aprovar-cadastro.use-case';
import { RejeitarCadastroUseCase } from './application/use-cases/rejeitar-cadastro.use-case';
import { ListPossiveisSuperioresUseCase } from './application/use-cases/list-possiveis-superiores.use-case';
import { PrismaCorretorRepository } from './infra/database/prisma-corretor.repository';
import { PrismaRoleRepository } from './infra/database/prisma-role.repository';
import { PrismaCadastroRepository } from './infra/database/prisma-cadastro.repository';
import { PrismaService } from '../../config/prisma.service';
import { ConsoleEmailSender } from '../../shared/infra/services/console-email-sender';

@Module({
  controllers: [RhController],
  providers: [
    PrismaService,
    CreateCorretorUseCase,
    ListCorretoresUseCase,
    UpdateStatusDisponibilidadeUseCase,
    PublicSignupUseCase,
    ListCadastrosPendentesUseCase,
    AprovarCadastroUseCase,
    RejeitarCadastroUseCase,
    ListPossiveisSuperioresUseCase,
    // Inversao de dependencia: o Caso de Uso pede a INTERFACE,
    // aqui entregamos a implementacao concreta (Prisma).
    { provide: 'ICorretorRepository', useClass: PrismaCorretorRepository },
    { provide: 'IRoleRepository', useClass: PrismaRoleRepository },
    { provide: 'ICadastroRepository', useClass: PrismaCadastroRepository },
    // ConsoleEmailSender (nao Resend) por enquanto: cadastro de corretor e
    // uma fatia minima ainda em teste, sem dominio de e-mail transacional
    // dedicado configurado para esse fluxo. Trocar para ResendEmailSender
    // quando o modulo RH sair de teste (ver PENDENCIA CRITICA no CLAUDE.md -
    // vale tambem para o e-mail de aprovacao/rejeicao do cadastro publico).
    { provide: 'IEmailSender', useClass: ConsoleEmailSender },
  ],
  // Exportados para o modulo roleta_online: DistributeLeadUseCase precisa
  // encontrar o Role "Corretor" e listar corretores online do tenant.
  exports: ['ICorretorRepository', 'IRoleRepository'],
})
export class RhModule {}
