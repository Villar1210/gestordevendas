// src/modules/vendas_kanban/application/use-cases/disparar-repique-manual.use-case.ts
// Corretor dispara manualmente o proximo envio de campanha do Repique para
// um card da propria carteira, sem esperar o job automatico de 2 em 2 dias
// (ver ProcessarCampanhaRepiqueUseCase). Reaproveita RepiqueEnvioService -
// mesma logica de canal/template/registro do job, so pula a espera de 2
// dias (ver PROGRESS.md).
import { Injectable, Inject, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { IStageRepository } from '../../domain/repositories/stage-repository.interface';
import { IWhatsAppSessionRepository } from '../../../whatsappmarketing/domain/repositories/whatsapp-session-repository.interface';
import { RepiqueCampanhaEnvioRecord } from '../../domain/repositories/repique-campanha-envio-repository.interface';
import { REPIQUE_STAGE_NAME } from '../../domain/services/protected-stages';
import { RepiqueEnvioService } from '../services/repique-envio.service';
import { resolveEscopo } from '../../../../shared/domain/services/cargo-escopo';
import { GetSubordinadosRecursivosUseCase } from '../../../auth/application/use-cases/get-subordinados-recursivos.use-case';

interface DispararRepiqueManualInput {
  cardId: string;
  tenantId: string;
  requesterUserId: string;
  requesterRole: string;
  requesterCargo: string | null;
}

@Injectable()
export class DispararRepiqueManualUseCase {
  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IStageRepository') private readonly stageRepository: IStageRepository,
    @Inject('IWhatsAppSessionRepository')
    private readonly whatsAppSessionRepository: IWhatsAppSessionRepository,
    private readonly repiqueEnvioService: RepiqueEnvioService,
    private readonly getSubordinadosRecursivosUseCase: GetSubordinadosRecursivosUseCase,
  ) {}

  async execute(input: DispararRepiqueManualInput): Promise<RepiqueCampanhaEnvioRecord> {
    const card = await this.cardRepository.findByIdAndTenant(input.cardId, input.tenantId);
    if (!card) {
      throw new NotFoundException('Card nao encontrado.');
    }

    await this.checarPermissao(input, card.ownerId);

    if (!card.stageId) {
      throw new BadRequestException('Este card nao esta na stage Repique.');
    }
    const stage = await this.stageRepository.findByIdAndTenant(card.stageId, input.tenantId);
    if (!stage || stage.name !== REPIQUE_STAGE_NAME) {
      throw new BadRequestException('Este card nao esta na stage Repique.');
    }

    if (card.repiqueOptOut) {
      throw new BadRequestException(
        'Este lead ja solicitou descadastro das campanhas de Repique - nao e possivel disparar manualmente.',
      );
    }

    const sessoesConectadas = await this.whatsAppSessionRepository.findAllConnected();
    const sessao = sessoesConectadas.find((s) => s.tenantId === input.tenantId);

    return this.repiqueEnvioService.enviarProximo(card, sessao?.id ?? null);
  }

  // Mesmo criterio de escopo (RBAC por cargo hierarquico) ja usado em
  // GetBoardUseCase: 'todos' (Administrador/Diretor) dispara para qualquer
  // card; 'equipe' (Gerente) dispara para os proprios cards + toda a
  // arvore de subordinados; 'proprio'/'plantao' (Corretor/Coordenador) so
  // dispara para os proprios cards.
  private async checarPermissao(
    input: DispararRepiqueManualInput,
    cardOwnerId: string | null,
  ): Promise<void> {
    if (cardOwnerId === input.requesterUserId) {
      return;
    }

    const escopo = resolveEscopo(input.requesterRole, input.requesterCargo);
    if (escopo === 'todos') {
      return;
    }
    if (escopo === 'equipe') {
      const subordinados = await this.getSubordinadosRecursivosUseCase.execute({
        tenantId: input.tenantId,
        userId: input.requesterUserId,
      });
      if (cardOwnerId && subordinados.includes(cardOwnerId)) {
        return;
      }
    }

    throw new ForbiddenException(
      'Voce so pode disparar campanhas de Repique para leads da sua propria carteira.',
    );
  }
}
