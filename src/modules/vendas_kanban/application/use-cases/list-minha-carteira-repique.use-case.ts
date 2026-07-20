// src/modules/vendas_kanban/application/use-cases/list-minha-carteira-repique.use-case.ts
// Lista os cards na stage Repique visiveis para o requisitante (mesmo
// escopo RBAC ja usado por GetBoardUseCase/DispararRepiqueManualUseCase),
// com motivo, data de entrada em Repique e dados do ultimo envio de
// campanha - para o corretor decidir em quais vale a pena disparar
// manualmente (ver DispararRepiqueManualUseCase).
import { Injectable, Inject } from '@nestjs/common';
import { ICardRepository } from '../../domain/repositories/card-repository.interface';
import { IRepiqueCampanhaEnvioRepository } from '../../domain/repositories/repique-campanha-envio-repository.interface';
import { GetSubordinadosRecursivosUseCase } from '../../../auth/application/use-cases/get-subordinados-recursivos.use-case';
import { GetCorretoresEscaladosHojeUseCase } from '../../../plantao/application/use-cases/get-corretores-escalados-hoje.use-case';
import { resolveEscopo } from '../../../../shared/domain/services/cargo-escopo';

interface ListMinhaCarteiraRepiqueInput {
  tenantId: string;
  requesterUserId: string;
  requesterRole: string;
  requesterCargo: string | null;
  requesterStandId: string | null;
}

export interface MinhaCarteiraRepiqueItem {
  cardId: string;
  title: string;
  motivoRepique: string | null;
  movidoParaRepiqueEm: Date | null;
  ultimoEnvioEm: Date | null;
  ultimoEnvioCanal: string | null;
  ultimoEnvioSucesso: boolean | null;
}

@Injectable()
export class ListMinhaCarteiraRepiqueUseCase {
  constructor(
    @Inject('ICardRepository') private readonly cardRepository: ICardRepository,
    @Inject('IRepiqueCampanhaEnvioRepository')
    private readonly envioRepository: IRepiqueCampanhaEnvioRepository,
    private readonly getSubordinadosRecursivosUseCase: GetSubordinadosRecursivosUseCase,
    private readonly getCorretoresEscaladosHojeUseCase: GetCorretoresEscaladosHojeUseCase,
  ) {}

  async execute(input: ListMinhaCarteiraRepiqueInput): Promise<MinhaCarteiraRepiqueItem[]> {
    const todosCardsRepique = await this.cardRepository.findElegiveisParaCampanhaRepique();
    // findElegiveisParaCampanhaRepique ja filtra por stage="Repique" e
    // repiqueOptOut=false cross-tenant - aqui so restringe ao tenant do
    // requisitante e aplica o escopo RBAC por cima.
    const cardsDoTenant = todosCardsRepique.filter((card) => card.tenantId === input.tenantId);

    const escopo = resolveEscopo(input.requesterRole, input.requesterCargo);
    let idsPermitidos: string[] | null = null;
    if (escopo === 'proprio') {
      idsPermitidos = [input.requesterUserId];
    } else if (escopo === 'equipe') {
      const subordinados = await this.getSubordinadosRecursivosUseCase.execute({
        tenantId: input.tenantId,
        userId: input.requesterUserId,
      });
      idsPermitidos = [input.requesterUserId, ...subordinados];
    } else if (escopo === 'plantao') {
      idsPermitidos = await this.getCorretoresEscaladosHojeUseCase.execute({
        standId: input.requesterStandId,
      });
    }

    const cardsVisiveis = idsPermitidos
      ? cardsDoTenant.filter((card) => card.ownerId && idsPermitidos!.includes(card.ownerId))
      : cardsDoTenant;

    return Promise.all(
      cardsVisiveis.map(async (card) => {
        const ultimoEnvio = await this.envioRepository.findUltimoPorCard(card.id);
        return {
          cardId: card.id,
          title: card.title,
          motivoRepique: card.motivoRepique,
          movidoParaRepiqueEm: card.movidoParaRepiqueEm,
          ultimoEnvioEm: ultimoEnvio?.enviadoEm ?? null,
          ultimoEnvioCanal: ultimoEnvio?.canal ?? null,
          ultimoEnvioSucesso: ultimoEnvio?.sucesso ?? null,
        };
      }),
    );
  }
}
