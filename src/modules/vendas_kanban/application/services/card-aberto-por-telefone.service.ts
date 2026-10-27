// src/modules/vendas_kanban/application/services/card-aberto-por-telefone.service.ts
// Fase B (27/10/2026): acha o card ABERTO (fora de Fechamento e do funil de
// remarketing) de um telefone, comparando pela chave normalizada
// (domain/services/telefone.ts). Usado por todas as entradas de lead para o
// mesmo cliente nao virar 2 cards.
import { Inject, Injectable } from '@nestjs/common';
import { CardRecord, ICardRepository } from '../../domain/repositories/card-repository.interface';
import { chaveTelefone, trechoBuscaTelefone } from '../../domain/services/telefone';

@Injectable()
export class CardAbertoPorTelefoneService {
  constructor(@Inject('ICardRepository') private readonly cardRepository: ICardRepository) {}

  // pipelineId: so considera cards desse funil (ex.: um cliente de locacao
  // nao bloqueia nem absorve um lead de compra).
  async encontrar(
    tenantId: string,
    phone: string | null | undefined,
    pipelineId?: string,
  ): Promise<CardRecord | null> {
    const chave = chaveTelefone(phone);
    if (!phone || !chave) return null;
    const candidatos = await this.cardRepository.findAbertosPorTrechoTelefone(tenantId, trechoBuscaTelefone(phone));
    // Ja vem do mais recente para o mais antigo.
    return (
      candidatos.find((c) => chaveTelefone(c.phone) === chave && (!pipelineId || c.pipelineId === pipelineId)) ?? null
    );
  }

  // Chave da trava "procura -> cria" (ver domain/services/trava-por-chave.ts).
  chaveDaTrava(tenantId: string, phone: string): string {
    return `${tenantId}:${chaveTelefone(phone) ?? phone}`;
  }
}
