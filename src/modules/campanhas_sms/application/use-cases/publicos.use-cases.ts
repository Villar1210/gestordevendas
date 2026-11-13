// src/modules/campanhas_sms/application/use-cases/publicos.use-cases.ts
// Casos de uso SEM usuario logado: clique no link curto e webhook do provedor.
// Nao recebem tenantId de fora: o tenant vem sempre do registro encontrado.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CAMPANHA_REPOSITORY, ICampanhaRepository } from '../../domain/repositories/campanha-repository.interface';
import { LIMITES, urlDeDestino } from '../../domain/services/campanha-regras';
import { ehPedidoDeSaida, limparResposta } from '../../domain/services/optout';
import { mascararTelefone, normalizarCelularBR } from '../../domain/services/telefone';
import { REGEX_CODIGO } from '../services/gerador-codigo.service';
import { CampanhaConfig } from '../services/campanha-config';

@Injectable()
export class RegistrarCliqueUseCase {
  private readonly logger = new Logger(RegistrarCliqueUseCase.name);

  constructor(
    @Inject(CAMPANHA_REPOSITORY) private readonly repo: ICampanhaRepository,
    private readonly config: CampanhaConfig,
  ) {}

  /** URL para redirecionar, ou null (codigo invalido/inexistente). */
  async execute(input: { codigo: string; contar: boolean }): Promise<string | null> {
    const codigo = String(input.codigo ?? '');
    if (!REGEX_CODIGO.test(codigo)) return null;
    const contato = await this.repo.contatoPorCodigo(codigo);
    if (contato) {
      if (input.contar) {
        try {
          await this.repo.registrarClique(contato.contatoId, this.config.agora());
        } catch (e) {
          // Contar o clique nunca pode impedir o cliente de chegar na pagina.
          this.logger.warn(`Falha ao registrar clique contato=${contato.contatoId}: ${(e as Error).message}`);
        }
      }
      return urlDeDestino(contato.linkDestino, codigo, contato.campanhaId);
    }
    const teste = await this.repo.campanhaPorCodigoTeste(codigo);
    if (teste) return urlDeDestino(teste.linkDestino, codigo, teste.id);
    return null;
  }
}

/** Evento ja traduzido do formato do provedor (infra) para o nosso. */
export type EventoSms =
  | { tipo: 'status'; provedorMensagemId: string; status: 'entregue' | 'falhou' | 'enviado'; descricao?: string }
  | { tipo: 'resposta'; de: string; texto: string };

@Injectable()
export class ProcessarEventoSmsUseCase {
  private readonly logger = new Logger(ProcessarEventoSmsUseCase.name);

  constructor(
    @Inject(CAMPANHA_REPOSITORY) private readonly repo: ICampanhaRepository,
    private readonly config: CampanhaConfig,
  ) {}

  async execute(evento: EventoSms): Promise<void> {
    const agora = this.config.agora();
    if (evento.tipo === 'status') {
      if (!evento.provedorMensagemId) return;
      const erro = evento.status === 'falhou' ? (evento.descricao || 'Não entregue pela operadora.').slice(0, 300) : undefined;
      await this.repo.atualizarEntrega(evento.provedorMensagemId.slice(0, 100), evento.status, agora, erro);
      return;
    }

    const telefone = normalizarCelularBR(evento.de);
    if (!telefone) return;
    const texto = limparResposta(evento.texto);
    const saida = ehPedidoDeSaida(texto);
    const desde = new Date(agora.getTime() - LIMITES.optoutDiasResposta * 86_400_000);
    const recentes = await this.repo.contatosRecentesDoTelefone(telefone, desde);
    if (recentes.length === 0) {
      this.logger.log(`Resposta de SMS sem campanha recente: de=${mascararTelefone(telefone)}`);
      return;
    }
    // Uma resposta por tenant: vai para a mensagem MAIS RECENTE daquele tenant.
    const porTenant = new Map<string, (typeof recentes)[number]>();
    for (const c of recentes) {
      const atual = porTenant.get(c.tenantId);
      if (!atual || c.enviadoEm > atual.enviadoEm) porTenant.set(c.tenantId, c);
    }
    for (const [tenantId, contato] of porTenant) {
      await this.repo.registrarResposta(contato.id, texto, agora, saida);
      if (saida) {
        await this.repo.registrarOptout(tenantId, telefone, 'resposta');
        await this.repo.marcarOptoutPendentes(tenantId, telefone, agora);
      }
    }
    this.logger.log(`Resposta de SMS registrada de=${mascararTelefone(telefone)} tenants=${porTenant.size} optout=${saida}`);
  }
}
