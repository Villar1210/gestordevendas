// WhatsApp integrado - Etapa 1, parte 2 (19/11/2026): mensagem nova na
// conversa do numero oficial (webhook do Chatwoot) -> copia no Gestor, ligada
// ao card aberto do telefone no funil de vendas (mesma regra "um telefone,
// um card aberto" da fase B). Sem card aberto, grava so com o telefone.
// Etapa 2: ao achar o card, liga tambem as mensagens anteriores que ficaram
// sem card (chegaram antes de o card nascer).
import { Inject, Injectable, Logger } from '@nestjs/common';
import { IPipelineRepository } from '../../../vendas_kanban/domain/repositories/pipeline-repository.interface';
import { funilDeVendasPadrao } from '../../../vendas_kanban/domain/services/remarketing-pipeline';
import { chaveTelefone } from '../../../vendas_kanban/domain/services/telefone';
import { CardAbertoPorTelefoneService } from '../../../vendas_kanban/application/services/card-aberto-por-telefone.service';
import { ChatwootMensagemRepository } from '../../infra/database/chatwoot-mensagem.repository';
import { MensagemChatwoot } from '../../services/evento-chatwoot';

export type ResultadoRegistroMensagem = { gravada: boolean; cardId: string | null };

@Injectable()
export class RegistrarMensagemChatwootUseCase {
  private readonly logger = new Logger(RegistrarMensagemChatwootUseCase.name);

  constructor(
    @Inject('IPipelineRepository') private readonly pipelineRepository: IPipelineRepository,
    private readonly cardAbertoPorTelefone: CardAbertoPorTelefoneService,
    private readonly repositorio: ChatwootMensagemRepository,
  ) {}

  async execute(tenantId: string, mensagem: MensagemChatwoot): Promise<ResultadoRegistroMensagem> {
    const funil = funilDeVendasPadrao(await this.pipelineRepository.findAllByTenant(tenantId));
    const card = funil ? await this.cardAbertoPorTelefone.encontrar(tenantId, mensagem.telefone, funil.id) : null;
    const cardId = card?.id ?? null;
    const gravada = await this.repositorio.inserirSeNova({
      ...mensagem,
      tenantId,
      cardId,
      telefoneChave: chaveTelefone(mensagem.telefone) ?? mensagem.telefone,
    });
    if (cardId) {
      const ligadas = await this.repositorio.ligarSemCardAoCard(tenantId, chaveTelefone(mensagem.telefone) ?? mensagem.telefone, cardId);
      if (ligadas > 0) this.logger.log(`${ligadas} mensagem(ns) antiga(s) ligada(s) ao card ${cardId}.`);
    }
    if (!gravada) this.logger.log(`Mensagem #${mensagem.chatwootMessageId} do Chatwoot ja gravada - aviso repetido ignorado.`);
    return { gravada, cardId };
  }
}
