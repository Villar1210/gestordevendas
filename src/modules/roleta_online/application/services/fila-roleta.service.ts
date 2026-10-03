// src/modules/roleta_online/application/services/fila-roleta.service.ts
// Fatia 2 (Atendimento/Roleta) - Sorteio da vez. Nucleo da fila de cada
// Roleta, usado pela distribuicao (DistributeLeadUseCase /
// ProcessRoletaTimeoutsUseCase), pelo botao "Sortear" e pelo job de horarios.
//
// Regras (definidas com o Villar, 03/10/2026):
// - Login (status "online") = presente na fila das roletas de que participa.
// - Antes do 1o sorteio do dia vale a ordem de chegada; cada dia comeca com
//   a fila vazia.
// - No sorteio, so quem esta presente participa; a ordem e aleatoria.
// - Quem chega depois do sorteio entra no fim da fila.
// - Quem recebe um lead vai para o fim da fila.
// - Offline na sua vez e pulado, mas mantem o lugar.
//
// Chamadores devem rodar sob comTravaPorTenant (ver trava-por-tenant.ts).
import { Inject, Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  IRoletaRepository,
  RoletaRecord,
  ParticipanteRecord,
  PosicaoRecord,
  OrigemSorteio,
  SorteioRecord,
} from '../../domain/repositories/roleta-repository.interface';
import { embaralhar, momentoSP, proximoDaFila } from '../../domain/services/fila-sorteio';

export interface FilaAtual {
  roleta: RoletaRecord;
  participantes: ParticipanteRecord[];
  posicoes: PosicaoRecord[];
}

const presente = (p: ParticipanteRecord) => p.statusDisponibilidade === 'online';

@Injectable()
export class FilaRoletaService {
  private readonly logger = new Logger(FilaRoletaService.name);

  constructor(
    @Inject('IRoletaRepository') private readonly roletaRepository: IRoletaRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Zera a fila se for de outro dia e coloca no fim quem esta presente e
  // ainda nao esta na fila (ordem de chegada).
  async sincronizar(roleta: RoletaRecord, agora: Date = new Date()): Promise<FilaAtual> {
    const { dia, diaSemana } = momentoSP(agora);
    if (roleta.filaDia !== dia) {
      await this.roletaRepository.reiniciarFila(roleta.id, dia, []);
      roleta = { ...roleta, filaDia: dia };
    }
    const participantes = await this.roletaRepository.listParticipantes(roleta, diaSemana);
    let posicoes = await this.roletaRepository.listPosicoes(roleta.id);
    const naFila = new Set(posicoes.map((p) => p.userId));
    const chegando = participantes.filter((p) => presente(p) && !naFila.has(p.userId)).map((p) => p.userId);
    if (chegando.length > 0) {
      await this.roletaRepository.adicionarAoFim(roleta.id, chegando);
      posicoes = await this.roletaRepository.listPosicoes(roleta.id);
    }
    return { roleta, participantes, posicoes };
  }

  async sortear(
    roleta: RoletaRecord,
    origem: OrigemSorteio,
    disparadoPorId: string | null,
    horario: string | null,
    agora: Date = new Date(),
  ): Promise<SorteioRecord> {
    const { dia, diaSemana } = momentoSP(agora);
    const participantes = await this.roletaRepository.listParticipantes(roleta, diaSemana);
    const ordem = embaralhar(participantes.filter(presente)).map((p) => ({ userId: p.userId, nome: p.nome }));
    await this.roletaRepository.reiniciarFila(roleta.id, dia, ordem.map((o) => o.userId));
    const sorteio = await this.roletaRepository.registrarSorteio({
      roletaId: roleta.id,
      origem,
      disparadoPorId,
      horario,
      ordem,
    });
    this.logger.log(
      `Roleta "${roleta.nome}" (${roleta.id}) sorteada [${origem}${horario ? ` ${horario}` : ''}]: ${
        ordem.map((o, i) => `${i + 1}.${o.nome}`).join(' ') || '(ninguem presente)'
      }`,
    );
    // Notificacoes ficam no modulo notificacoes (evento generico).
    this.eventEmitter.emit('roleta.sorteada', {
      tenantId: roleta.tenantId,
      roletaId: roleta.id,
      roletaNome: roleta.nome,
      ordem,
    });
    return sorteio;
  }

  // Proximo corretor presente na fila (sem mexer na fila).
  async escolher(roleta: RoletaRecord, excluir: string[] = []): Promise<string | null> {
    const fila = await this.sincronizar(roleta);
    const disponiveis = new Set(fila.participantes.filter(presente).map((p) => p.userId));
    return proximoDaFila(fila.posicoes, disponiveis, new Set(excluir));
  }

  async registrarAtendimento(roletaId: string, userId: string): Promise<void> {
    await this.roletaRepository.moverParaFim(roletaId, userId, new Date());
  }

  // Roleta do lead: a do produto (empreendimento do card); senao a padrao.
  async resolverRoletas(tenantId: string, cardId: string): Promise<RoletaRecord[]> {
    const roletas: RoletaRecord[] = [];
    const empreendimentoId = await this.roletaRepository.findEmpreendimentoDoCard(cardId);
    if (empreendimentoId) {
      const doProduto = await this.roletaRepository.findAtivaPorEmpreendimento(tenantId, empreendimentoId);
      if (doProduto) roletas.push(doProduto);
    }
    const padrao = await this.roletaRepository.findPadrao(tenantId);
    if (padrao && !roletas.some((r) => r.id === padrao.id)) roletas.push(padrao);
    return roletas;
  }

  // Escolha completa para um lead: tenta a roleta do produto e, se ninguem
  // estiver presente nela, a padrao. Ja manda o escolhido para o fim da fila.
  async escolherParaLead(
    tenantId: string,
    cardId: string,
    excluir: string[] = [],
  ): Promise<{ userId: string; roletaId: string } | null> {
    for (const roleta of await this.resolverRoletas(tenantId, cardId)) {
      const userId = await this.escolher(roleta, excluir);
      if (userId) {
        await this.registrarAtendimento(roleta.id, userId);
        return { userId, roletaId: roleta.id };
      }
    }
    return null;
  }

  // Corretor ficou online: entra no fim da fila de todas as roletas ativas
  // de que participa (ordem de chegada).
  async entrarNasFilas(tenantId: string): Promise<void> {
    const roletas = await this.roletaRepository.listByTenant(tenantId);
    for (const roleta of roletas.filter((r) => r.ativa)) {
      await this.sincronizar(roleta);
    }
  }
}
