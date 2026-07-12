// src/modules/atendimento/atendimento.module.ts
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WhatsAppMarketingModule } from '../whatsappmarketing/whatsapp-marketing.module';
import { FilaController } from './infra/http/fila.controller';
import { AtendimentoController } from './infra/http/atendimento.controller';
import { CreateFilaUseCase } from './application/use-cases/create-fila.use-case';
import { ListFilasUseCase } from './application/use-cases/list-filas.use-case';
import { AddUsuarioToFilaUseCase } from './application/use-cases/add-usuario-to-fila.use-case';
import { RemoveUsuarioFromFilaUseCase } from './application/use-cases/remove-usuario-from-fila.use-case';
import { GetOrCreateAtendimentoUseCase } from './application/use-cases/get-or-create-atendimento.use-case';
import { ClassifyAndRouteAtendimentoUseCase } from './application/use-cases/classify-and-route-atendimento.use-case';
import { AssignAtendimentoUseCase } from './application/use-cases/assign-atendimento.use-case';
import { TransferAtendimentoUseCase } from './application/use-cases/transfer-atendimento.use-case';
import { RequeueAtendimentoUseCase } from './application/use-cases/requeue-atendimento.use-case';
import { CloseAtendimentoUseCase } from './application/use-cases/close-atendimento.use-case';
import { AddNotaAtendimentoUseCase } from './application/use-cases/add-nota-atendimento.use-case';
import { ListAtendimentosUseCase } from './application/use-cases/list-atendimentos.use-case';
import { GetAtendimentoDetailUseCase } from './application/use-cases/get-atendimento-detail.use-case';
import { EnviarMensagemAtendimentoUseCase } from './application/use-cases/enviar-mensagem-atendimento.use-case';
import { PrismaFilaRepository } from './infra/database/prisma-fila.repository';
import { PrismaAtendimentoRepository } from './infra/database/prisma-atendimento.repository';
import { PrismaAtendimentoEventoRepository } from './infra/database/prisma-atendimento-evento.repository';
import { PrismaService } from '../../config/prisma.service';

@Module({
  // Dependencia de modulo (nao circular): atendimento consome
  // IUserRepository (AuthModule, para validar agentes vinculados a uma
  // fila) e SendWhatsAppMessageUseCase/IWhatsAppMessageRepository
  // (WhatsAppMarketingModule, para responder o contato e ler o historico).
  // O modulo vivi_sdr, por sua vez, importa ESTE modulo (atendimento) para
  // orquestrar a classificacao - ver CLAUDE.md sobre organizacao por modulo.
  imports: [AuthModule, WhatsAppMarketingModule],
  controllers: [FilaController, AtendimentoController],
  providers: [
    PrismaService,
    CreateFilaUseCase,
    ListFilasUseCase,
    AddUsuarioToFilaUseCase,
    RemoveUsuarioFromFilaUseCase,
    GetOrCreateAtendimentoUseCase,
    ClassifyAndRouteAtendimentoUseCase,
    AssignAtendimentoUseCase,
    TransferAtendimentoUseCase,
    RequeueAtendimentoUseCase,
    CloseAtendimentoUseCase,
    AddNotaAtendimentoUseCase,
    ListAtendimentosUseCase,
    GetAtendimentoDetailUseCase,
    EnviarMensagemAtendimentoUseCase,
    // Inversao de dependencia: o Caso de Uso pede a INTERFACE,
    // aqui entregamos a implementacao concreta (Prisma).
    { provide: 'IFilaRepository', useClass: PrismaFilaRepository },
    { provide: 'IAtendimentoRepository', useClass: PrismaAtendimentoRepository },
    { provide: 'IAtendimentoEventoRepository', useClass: PrismaAtendimentoEventoRepository },
  ],
  // Exportado para o modulo vivi_sdr: o listener de mensagens (sessao sem
  // VIVI) e o processamento da tool "transferir_para_fila" (sessao com
  // VIVI) precisam criar/classificar Atendimentos.
  exports: [GetOrCreateAtendimentoUseCase, ClassifyAndRouteAtendimentoUseCase],
})
export class AtendimentoModule {}
