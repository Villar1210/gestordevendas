// src/modules/campanhas_sms/campanhas-sms.module.ts
// Campanhas por SMS: repique em massa com link curto por contato, opt-out por
// resposta e acompanhamento. Nao importa nenhum outro modulo de negocio.
// Provedor: SMS_PROVIDER=zenvia usa a Zenvia; qualquer outro valor (padrao)
// usa o simulador (nenhum SMS e enviado).
// Contrato: docs/campanhas/CONTRATO_CAMPANHA_SMS.md
import { Logger, Module } from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import { CAMPANHA_REPOSITORY } from './domain/repositories/campanha-repository.interface';
import { SMS_PROVIDER } from './domain/services/sms-provider.interface';
import { LEITOR_PLANILHA } from './domain/services/leitor-planilha.interface';
import { PrismaCampanhaRepository } from './infra/database/prisma-campanha.repository';
import { ZenviaSmsProvider, lerConfigZenvia } from './infra/providers/zenvia-sms.provider';
import { ConsoleSmsProvider } from './infra/providers/console-sms.provider';
import { LeitorPlanilhaContatos } from './infra/planilha/leitor-planilha-contatos';
import { EnvioCampanhaScheduler } from './infra/scheduler/envio-campanha.scheduler';
import { CampanhaSmsController } from './infra/http/campanha-sms.controller';
import { CampanhaSmsPublicoController } from './infra/http/campanha-sms-publico.controller';
import { CampanhaConfig } from './application/services/campanha-config';
import { GeradorCodigoService } from './application/services/gerador-codigo.service';
import { ProcessadorEnvioService } from './application/services/processador-envio.service';
import {
  AtualizarCampanhaUseCase,
  CancelarCampanhaUseCase,
  CriarCampanhaUseCase,
  EnviarTesteUseCase,
  ExportarContatosUseCase,
  ImportarContatosUseCase,
  IniciarCampanhaUseCase,
  ListarCampanhasUseCase,
  ListarContatosUseCase,
  ListarOptoutsUseCase,
  ObterCampanhaUseCase,
  PausarCampanhaUseCase,
  RegistrarOptoutManualUseCase,
} from './application/use-cases/campanhas.use-cases';
import { ProcessarEventoSmsUseCase, RegistrarCliqueUseCase } from './application/use-cases/publicos.use-cases';

export function criarSmsProvider(env: NodeJS.ProcessEnv = process.env) {
  if ((env.SMS_PROVIDER || '').trim().toLowerCase() === 'zenvia') {
    const config = lerConfigZenvia(env);
    if (!config) new Logger('CampanhasSms').warn('SMS_PROVIDER=zenvia mas ZENVIA_API_TOKEN/ZENVIA_SMS_FROM vazios: envio desligado.');
    return new ZenviaSmsProvider(config);
  }
  return new ConsoleSmsProvider();
}

@Module({
  controllers: [CampanhaSmsController, CampanhaSmsPublicoController],
  providers: [
    PrismaService,
    { provide: CAMPANHA_REPOSITORY, useClass: PrismaCampanhaRepository },
    { provide: SMS_PROVIDER, useFactory: () => criarSmsProvider() },
    { provide: LEITOR_PLANILHA, useClass: LeitorPlanilhaContatos },
    CampanhaConfig,
    GeradorCodigoService,
    ProcessadorEnvioService,
    EnvioCampanhaScheduler,
    ListarCampanhasUseCase,
    ObterCampanhaUseCase,
    CriarCampanhaUseCase,
    AtualizarCampanhaUseCase,
    ImportarContatosUseCase,
    ListarContatosUseCase,
    ExportarContatosUseCase,
    EnviarTesteUseCase,
    IniciarCampanhaUseCase,
    PausarCampanhaUseCase,
    CancelarCampanhaUseCase,
    ListarOptoutsUseCase,
    RegistrarOptoutManualUseCase,
    RegistrarCliqueUseCase,
    ProcessarEventoSmsUseCase,
  ],
})
export class CampanhasSmsModule {}
