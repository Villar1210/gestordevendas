// src/modules/vivi_sdr/application/use-cases/registrar-uso-vivi.use-case.ts
// Controle de volume/custo da VIVI (Fatia B). Chamado nos DOIS pontos onde a
// VIVI processa uma mensagem recebida - ProcessIncomingMessageUseCase
// (WhatsApp, "numero" = phoneNumber) e ProcessIncomingSocialMessageUseCase
// (Instagram/Facebook DM, "numero" = identificadorExterno) - somando no
// MESMO total diario do tenant, ja que o custo na Anthropic nao distingue
// canal. So existe alerta nesta fatia (ver Tenant.acaoLimiteVivi/
// AcaoLimiteVivi em schema.prisma): "PAUSAR" e rejeitado na escrita
// (UpdateTenantConfigUseCase) e nao tem nenhuma logica de bloqueio aqui
// ainda - o ponto de extensao para isso fica marcado abaixo, para virar uma
// mudanca pequena quando houver multiplos tenants.
//
// Duas checagens INDEPENDENTES a cada mensagem (confirmado com o usuario
// antes de implementar):
// 1. Nivel de VOLUME (Normal implicito/Atencao/Critico, ver
//    LIMITE_CRITICO_MULTIPLICADOR) - Atencao dispara ao cruzar >100% do
//    limite, Critico ao cruzar >200%, cada um no maximo 1x/dia/tenant (flags
//    separados). Como o contador so incrementa de 1 em 1, uma mensagem
//    sempre passa por Atencao antes de chegar em Critico no mesmo dia -
//    exceto se o Administrador BAIXAR o limite no meio do dia com o total ja
//    acima do novo limiteCritico, caso em que Atencao pode nunca disparar
//    (aceito, edge case raro, nao vale complicar a logica por isso).
// 2. SUSPEITA DE CONCENTRACAO (poucos numeros distintos gerando muitas
//    mensagens) - independente do nivel de volume acima, avaliada todo dia
//    (mesmo com volume Normal).
import { Injectable, Inject, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  IViviUsoDiarioRepository,
  ViviUsoDiarioRecord,
} from '../../domain/repositories/vivi-uso-diario-repository.interface';
import { ITenantConfigRepository } from '../../../configuracoes/domain/repositories/tenant-config-repository.interface';
import { getUsageDay } from '../../domain/services/usage-day';
import {
  DEFAULT_LIMITE_MENSAGENS_VIVI_DIA,
  LIMITE_CRITICO_MULTIPLICADOR,
  RAZAO_SUSPEITA_CONCENTRACAO_MSGS_POR_NUMERO,
} from '../../domain/constants/limite-vivi';

interface RegistrarUsoViviInput {
  tenantId: string;
  numero: string;
}

export const VIVI_LIMITE_ATENCAO_EVENT = 'vivi.limite_atencao.atingido';
export const VIVI_LIMITE_CRITICO_EVENT = 'vivi.limite_critico.atingido';
export const VIVI_USO_CONCENTRADO_SUSPEITO_EVENT = 'vivi.uso_concentrado.suspeito';

export interface ViviLimiteNivelEvent {
  tenantId: string;
  totalMensagens: number;
  limite: number;
}

export interface ViviUsoConcentradoSuspeitoEvent {
  tenantId: string;
  totalMensagens: number;
  numerosDistintos: number;
}

@Injectable()
export class RegistrarUsoViviUseCase {
  private readonly logger = new Logger(RegistrarUsoViviUseCase.name);

  constructor(
    @Inject('IViviUsoDiarioRepository')
    private readonly viviUsoDiarioRepository: IViviUsoDiarioRepository,
    @Inject('ITenantConfigRepository')
    private readonly tenantConfigRepository: ITenantConfigRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Contador de custo/volume, NUNCA deve bloquear ou atrasar a resposta da
  // VIVI ao lead - qualquer falha aqui (banco, config ausente) so e
  // registrada em log, nunca propagada para quem chamou. Por isso
  // ProcessIncomingMessageUseCase/ProcessIncomingSocialMessageUseCase chamam
  // este metodo sem try/catch proprio, confiando nessa garantia.
  async execute(input: RegistrarUsoViviInput): Promise<void> {
    try {
      const dia = getUsageDay();
      const uso = await this.viviUsoDiarioRepository.incrementAndGet(input.tenantId, dia);
      const numerosDistintos = await this.viviUsoDiarioRepository.registrarNumeroDistinto(
        uso.id,
        input.numero,
      );

      const tenantConfig = await this.tenantConfigRepository.findByTenantId(input.tenantId);
      const limite = tenantConfig?.limiteMensagensViviDia ?? DEFAULT_LIMITE_MENSAGENS_VIVI_DIA;

      await this.avaliarNivelDeVolume(input.tenantId, uso, limite);
      await this.avaliarConcentracao(input.tenantId, uso, numerosDistintos);
    } catch (error) {
      this.logger.error(
        `Falha ao registrar uso diario da VIVI para tenant ${input.tenantId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }
  }

  private async avaliarNivelDeVolume(
    tenantId: string,
    uso: ViviUsoDiarioRecord,
    limite: number,
  ): Promise<void> {
    // PONTO DE EXTENSAO para o bloqueio automatico futuro (quando
    // tenantConfig?.acaoLimiteVivi === 'PAUSAR' passar a ter logica
    // associada): entraria aqui, decidindo se a mensagem atual deveria ser
    // processada ou nao. Hoje esse enum so aceita "ALERTAR" na escrita (ver
    // UpdateTenantConfigUseCase) - nenhum bloqueio acontece.
    const limiteCritico = limite * LIMITE_CRITICO_MULTIPLICADOR;

    if (uso.totalMensagens > limiteCritico) {
      await this.dispararSeNecessario(uso.id, 'critico', VIVI_LIMITE_CRITICO_EVENT, {
        tenantId,
        totalMensagens: uso.totalMensagens,
        limite,
      });
      return;
    }

    if (uso.totalMensagens > limite) {
      await this.dispararSeNecessario(uso.id, 'atencao', VIVI_LIMITE_ATENCAO_EVENT, {
        tenantId,
        totalMensagens: uso.totalMensagens,
        limite,
      });
    }
  }

  private async avaliarConcentracao(
    tenantId: string,
    uso: ViviUsoDiarioRecord,
    numerosDistintos: number,
  ): Promise<void> {
    const razao = uso.totalMensagens / numerosDistintos;
    if (razao <= RAZAO_SUSPEITA_CONCENTRACAO_MSGS_POR_NUMERO) {
      return;
    }

    const disparado = await this.viviUsoDiarioRepository.marcarAlertaEnviadoSeNecessario(
      uso.id,
      'concentracao',
    );
    if (!disparado) {
      return;
    }

    const event: ViviUsoConcentradoSuspeitoEvent = {
      tenantId,
      totalMensagens: uso.totalMensagens,
      numerosDistintos,
    };
    this.eventEmitter.emit(VIVI_USO_CONCENTRADO_SUSPEITO_EVENT, event);
  }

  private async dispararSeNecessario(
    viviUsoDiarioId: string,
    nivel: 'atencao' | 'critico',
    eventName: string,
    event: ViviLimiteNivelEvent,
  ): Promise<void> {
    const disparadoAgora = await this.viviUsoDiarioRepository.marcarAlertaEnviadoSeNecessario(
      viviUsoDiarioId,
      nivel,
    );
    if (!disparadoAgora) {
      // Alerta deste nivel, para este tenant, hoje, ja foi disparado por
      // uma mensagem anterior - nao reenviar a cada mensagem nova.
      return;
    }
    this.eventEmitter.emit(eventName, event);
  }
}
