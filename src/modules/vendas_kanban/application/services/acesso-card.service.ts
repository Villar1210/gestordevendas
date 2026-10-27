// src/modules/vendas_kanban/application/services/acesso-card.service.ts
// Aplica a regra de dominio domain/services/acesso-card.ts dentro dos use
// cases do card (nao so no controller - defesa no ponto de escrita). Monta a
// lista de donos alcancados pelo escopo do requisitante com os MESMOS use
// cases que o GetBoardUseCase usa para filtrar o board, entao "pode alterar"
// e "aparece no meu board" nunca divergem.
//
// `RequisitanteCard` e OPCIONAL nos use cases: chamadas internas do sistema
// (VIVI do fazer.ai movendo card, VIVI criando nota, jobs) nao passam
// requisitante e nao sao checadas. Toda rota HTTP do CardController passa.
import { ForbiddenException, Injectable } from '@nestjs/common';
import { resolveEscopo } from '../../../../shared/domain/services/cargo-escopo';
import { GetSubordinadosRecursivosUseCase } from '../../../auth/application/use-cases/get-subordinados-recursivos.use-case';
import { GetCorretoresEscaladosHojeUseCase } from '../../../plantao/application/use-cases/get-corretores-escalados-hoje.use-case';
import {
  MENSAGEM_SEM_ACESSO_CARD,
  OperacaoCard,
  podeAcessarCard,
} from '../../domain/services/acesso-card';

export interface RequisitanteCard {
  userId: string;
  role: string;
  cargo: string | null;
  standId: string | null;
}

@Injectable()
export class AcessoCardService {
  constructor(
    private readonly getSubordinadosRecursivosUseCase: GetSubordinadosRecursivosUseCase,
    private readonly getCorretoresEscaladosHojeUseCase: GetCorretoresEscaladosHojeUseCase,
  ) {}

  async garantir(
    tenantId: string,
    cardOwnerId: string | null,
    requisitante: RequisitanteCard | undefined,
    operacao: OperacaoCard,
  ): Promise<void> {
    if (!requisitante) return;

    const escopo = resolveEscopo(requisitante.role, requisitante.cargo);

    // So consulta a hierarquia/escala quando a resposta depende dela.
    let idsDoEscopo: string[] | null = null;
    const precisaLista =
      cardOwnerId !== null && cardOwnerId !== requisitante.userId && (escopo === 'equipe' || escopo === 'plantao');
    if (precisaLista && escopo === 'equipe') {
      idsDoEscopo = await this.getSubordinadosRecursivosUseCase.execute({
        tenantId,
        userId: requisitante.userId,
      });
    } else if (precisaLista && escopo === 'plantao') {
      idsDoEscopo = await this.getCorretoresEscaladosHojeUseCase.execute({
        standId: requisitante.standId,
      });
    }

    const permitido = podeAcessarCard({
      escopo,
      operacao,
      cardOwnerId,
      requesterUserId: requisitante.userId,
      idsDoEscopo,
    });
    if (!permitido) {
      throw new ForbiddenException(MENSAGEM_SEM_ACESSO_CARD);
    }
  }
}
