// src/modules/plantao/plantao.module.ts
import { Module } from '@nestjs/common';
import { StandController } from './infra/http/stand.controller';
import { CreateStandUseCase } from './application/use-cases/create-stand.use-case';
import { ListStandsUseCase } from './application/use-cases/list-stands.use-case';
import { UpdateStandUseCase } from './application/use-cases/update-stand.use-case';
import { DeleteStandUseCase } from './application/use-cases/delete-stand.use-case';
import { SetEscalaUseCase } from './application/use-cases/set-escala.use-case';
import { RemoveEscalaUseCase } from './application/use-cases/remove-escala.use-case';
import { ListEscalasByStandUseCase } from './application/use-cases/list-escalas-by-stand.use-case';
import { GetCorretoresEscaladosHojeUseCase } from './application/use-cases/get-corretores-escalados-hoje.use-case';
import { GetMeuPlantaoHojeUseCase } from './application/use-cases/get-meu-plantao-hoje.use-case';
import { PrismaStandRepository } from './infra/database/prisma-stand.repository';
import { PrismaEscalaPlantaoRepository } from './infra/database/prisma-escala-plantao.repository';
import { PrismaService } from '../../config/prisma.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthModule: SetEscalaUseCase valida que o usuario escalado pertence ao
  // tenant (IUserRepository.findById), mesmo padrao ja usado por outros
  // modulos que precisam validar um usuario sem duplicar a consulta.
  imports: [AuthModule],
  controllers: [StandController],
  providers: [
    PrismaService,
    CreateStandUseCase,
    ListStandsUseCase,
    UpdateStandUseCase,
    DeleteStandUseCase,
    SetEscalaUseCase,
    RemoveEscalaUseCase,
    ListEscalasByStandUseCase,
    GetCorretoresEscaladosHojeUseCase,
    GetMeuPlantaoHojeUseCase,
    // Inversao de dependencia: o Caso de Uso pede a INTERFACE,
    // aqui entregamos a implementacao concreta (Prisma).
    { provide: 'IStandRepository', useClass: PrismaStandRepository },
    { provide: 'IEscalaPlantaoRepository', useClass: PrismaEscalaPlantaoRepository },
  ],
  // Exportado para o modulo rh (atribuir standId ao Coordenador na tela de
  // Permissoes/Cargos) e para os modulos que consomem o escopo "plantao" do
  // RBAC (vendas_kanban, atendimento - Fatia 2 do modulo Plantao/Stand):
  // GetCorretoresEscaladosHojeUseCase resolve quem esta escalado hoje num
  // stand, usado no lugar de GetSubordinadosRecursivosUseCase quando o
  // escopo resolvido e 'plantao' (Coordenador).
  exports: ['IStandRepository', GetCorretoresEscaladosHojeUseCase],
})
export class PlantaoModule {}
