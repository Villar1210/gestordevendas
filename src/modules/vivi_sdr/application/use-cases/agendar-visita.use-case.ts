// src/modules/vivi_sdr/application/use-cases/agendar-visita.use-case.ts
// Materializa a meta absoluta da VIVI (ver constants/vivi-prompt.ts): cria o
// Card (Caixa de Entrada, mesmo caminho de CreateQuickCardUseCase ja usado
// por transferir_para_corretor - dispara a Roleta Online normalmente) e uma
// Activity tipo "visita" com a data/horario confirmados pelo lead.
import { Injectable, Inject, Logger } from '@nestjs/common';
import { IPipelineRepository } from '../../../vendas_kanban/domain/repositories/pipeline-repository.interface';
import { CreateQuickCardUseCase } from '../../../vendas_kanban/application/use-cases/create-quick-card.use-case';
import { PromoverLeadMinimoUseCase } from '../../../vendas_kanban/application/use-cases/promover-lead-minimo.use-case';
import { CreateActivityUseCase } from '../../../vendas_kanban/application/use-cases/create-activity.use-case';
import { IActivityRepository } from '../../../vendas_kanban/domain/repositories/activity-repository.interface';
import { parseDateOnly } from '../../../../shared/utils/date-only.util';

const ACTIVITY_TYPE_VISITA = 'visita';

interface AgendarVisitaInput {
  tenantId: string;
  phoneNumber: string;
  dataVisita: string;
  horario: string;
  imovelInteresse?: string;
  // Preenchido quando a conversa ja tem um Card de uma chamada anterior de
  // agendar_visita (ver ProcessIncomingMessageUseCase) - a IA pode re-
  // confirmar/reagendar a visita em turnos seguintes (observado em teste
  // real), e sem isso cada re-confirmacao criaria um Card duplicado no
  // Kanban (e redispararia a Roleta Online a cada vez).
  existingCardId?: string | null;
  // Resumo automatico (ver domain/services/build-resumo-atendimento.ts),
  // gravado em Card.description - legivel pelo corretor sem abrir outra
  // tela. So aplicado na criacao (se o card for reaproveitado via
  // existingCardId, a description original permanece intacta).
  resumo?: string;
}

interface AgendarVisitaOutput {
  cardId: string;
  visitaAgendadaEm: Date;
}

const HORARIO_PATTERN = /^(\d{1,2}):(\d{2})$/;

@Injectable()
export class AgendarVisitaUseCase {
  private readonly logger = new Logger(AgendarVisitaUseCase.name);

  constructor(
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
    @Inject('IActivityRepository') private readonly activityRepository: IActivityRepository,
    private readonly createQuickCardUseCase: CreateQuickCardUseCase,
    private readonly promoverLeadMinimoUseCase: PromoverLeadMinimoUseCase,
    private readonly createActivityUseCase: CreateActivityUseCase,
  ) {}

  async execute(input: AgendarVisitaInput): Promise<AgendarVisitaOutput | null> {
    const pipelines = await this.pipelineRepository.findAllByTenant(input.tenantId);
    const pipeline = pipelines[0];
    if (!pipeline) {
      // Mesma situacao rara ja tratada em transferToBroker: tenant sem
      // pipeline configurado ainda.
      this.logger.error(
        `Nao foi possivel agendar visita da VIVI: tenant ${input.tenantId} nao tem pipeline.`,
      );
      return null;
    }

    // Idempotencia: se a conversa ja tem um Card de uma chamada anterior de
    // agendar_visita, reaproveita em vez de criar outro - so registra uma
    // nova Activity com a data/horario atualizados (o lead pode ter
    // reconfirmado ou trocado o horario num turno seguinte). Se NAO tem
    // ainda, tenta primeiro PROMOVER (mutar) um Card de captura automatica
    // do funil de remarketing para este telefone (ver
    // PromoverLeadMinimoUseCase) - so cria um Card novo se nao existir
    // nenhum para promover, comportamento identico ao de antes desta fatia.
    const cardId = input.existingCardId
      ? input.existingCardId
      : (
          (await this.promoverLeadMinimoUseCase.execute({
            tenantId: input.tenantId,
            phoneNumber: input.phoneNumber,
            targetPipelineId: pipeline.id,
            targetStageId: null,
            position: 0,
            title: 'Visita agendada via VIVI',
            description: input.resumo,
            origem: 'roleta_online',
          })) ??
          (await this.createQuickCardUseCase.execute({
            tenantId: input.tenantId,
            pipelineId: pipeline.id,
            // Chamada de sistema, nao humana - nunca mira o funil de
            // remarketing (ver domain/services/remarketing-pipeline.ts).
            isSystemCall: true,
            title: 'Visita agendada via VIVI',
            origem: 'roleta_online',
            phone: input.phoneNumber,
            description: input.resumo,
          }))
        ).id;

    const visitaAgendadaEm = this.buildScheduledAt(input.dataVisita, input.horario);
    const subject = this.buildSubject(input);

    // Idempotencia (upsert): a VIVI pode chamar "agendar_visita" mais de uma
    // vez para a mesma conversa mesmo com a instrucao contraria no system
    // prompt (defesa em profundidade - ver vivi-prompt.ts) - confirmado em
    // producao (card "Visita agendada via VIVI", 14/07/2026): 3 chamadas em
    // turnos diferentes geraram 3 Activities identicas. Se ja existe uma
    // Activity tipo "visita" pendente (done=false) neste card, ATUALIZA em
    // vez de criar outra - reconfirmar o mesmo horario vira um no-op
    // pratico, uma mudanca real de horario atualiza de fato.
    const activityExistente = await this.activityRepository.findPendingByCardAndType(
      input.tenantId,
      cardId,
      ACTIVITY_TYPE_VISITA,
    );
    if (activityExistente) {
      await this.activityRepository.update(activityExistente.id, { subject, scheduledAt: visitaAgendadaEm });
    } else {
      await this.createActivityUseCase.execute({
        tenantId: input.tenantId,
        cardId,
        type: ACTIVITY_TYPE_VISITA,
        subject,
        scheduledAt: visitaAgendadaEm,
      });
    }

    return { cardId, visitaAgendadaEm };
  }

  // Sempre retorna um Date - se "dataVisita" nao vier no formato AAAA-MM-DD
  // esperado (a IA pode errar o formato), cai para a data/hora atual como
  // placeholder em vez de deixar a visita sem nenhum registro de horario -
  // o corretor confirma o horario certo depois (o texto literal do lead
  // fica no subject da Activity, ver buildSubject).
  private buildScheduledAt(dataVisita: string, horario: string): Date {
    let date: Date;
    try {
      date = parseDateOnly(dataVisita);
    } catch {
      this.logger.warn(
        `agendar_visita: data "${dataVisita}" fora do formato AAAA-MM-DD - usando data/hora atual como placeholder, corretor deve confirmar.`,
      );
      date = new Date();
    }

    const match = HORARIO_PATTERN.exec(horario.trim());
    if (match) {
      date.setHours(Number(match[1]), Number(match[2]), 0, 0);
    }
    // Sem match (ex: "de manha", "depois do almoco"): a data fica na meia-
    // noite local, mas o texto exato do lead vai no subject da Activity.
    return date;
  }

  private buildSubject(input: AgendarVisitaInput): string {
    const parts = [`Visita agendada via VIVI - horario informado pelo lead: "${input.horario}"`];
    if (input.imovelInteresse) parts.push(`Interesse: ${input.imovelInteresse}`);
    return parts.join(' - ');
  }
}
