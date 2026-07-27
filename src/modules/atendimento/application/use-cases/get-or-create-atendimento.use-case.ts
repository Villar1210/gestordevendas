// src/modules/atendimento/application/use-cases/get-or-create-atendimento.use-case.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import {
  IAtendimentoRepository,
  AtendimentoRecord,
} from '../../domain/repositories/atendimento-repository.interface';
import { IFilaRepository } from '../../domain/repositories/fila-repository.interface';
import { IAtendimentoEventoRepository } from '../../domain/repositories/atendimento-evento-repository.interface';
import { DEFAULT_FILA_NAMES } from '../../domain/services/fila-categorias';
import { UniqueConstraintViolationError } from '../../../../shared/domain/errors/unique-constraint-violation.error';

interface GetOrCreateAtendimentoInput {
  tenantId: string;
  sessionId: string;
  remoteJid: string;
  phoneNumber: string;
}

@Injectable()
export class GetOrCreateAtendimentoUseCase {
  private readonly logger = new Logger(GetOrCreateAtendimentoUseCase.name);

  constructor(
    @Inject('IAtendimentoRepository')
    private readonly atendimentoRepository: IAtendimentoRepository,
    @Inject('IFilaRepository') private readonly filaRepository: IFilaRepository,
    @Inject('IAtendimentoEventoRepository')
    private readonly eventoRepository: IAtendimentoEventoRepository,
  ) {}

  async execute(input: GetOrCreateAtendimentoInput): Promise<AtendimentoRecord> {
    const existing = await this.atendimentoRepository.findActiveBySessionAndRemoteJid(
      input.sessionId,
      input.remoteJid,
    );
    if (existing) {
      return existing;
    }

    await this.ensureDefaultFilas(input.tenantId);

    let atendimento: AtendimentoRecord;
    try {
      atendimento = await this.atendimentoRepository.create({
        tenantId: input.tenantId,
        whatsappSessionId: input.sessionId,
        remoteJid: input.remoteJid,
        phoneNumber: input.phoneNumber,
      });
    } catch (error) {
      if (error instanceof UniqueConstraintViolationError) {
        // Race condition (achado C2): uma mensagem concorrente do mesmo
        // lead ja criou o Atendimento entre o find no topo deste metodo e
        // este create (indice unico parcial "atendimentos_active_session_remote_jid_key",
        // ver schema.prisma) - busca de novo o registro ja criado por ela
        // em vez de propagar o erro ou duplicar. NUNCA descarta a mensagem
        // atual: quem chamou este use case continua o processamento
        // normalmente sobre o Atendimento retornado aqui.
        const concorrente = await this.atendimentoRepository.findActiveBySessionAndRemoteJid(
          input.sessionId,
          input.remoteJid,
        );
        if (concorrente) {
          this.logger.log(
            `[Atendimento] Corrida detectada para ${input.remoteJid} (sessao ${input.sessionId}) - reaproveitando atendimento ${concorrente.id} criado por mensagem concorrente.`,
          );
          return concorrente;
        }
        // Extremamente improvavel (ex: o atendimento concorrente fechou no
        // intervalo entre o catch e este refetch) - deixa propagar em vez
        // de arriscar um loop de retry.
      }
      throw error;
    }

    await this.eventoRepository.create({ atendimentoId: atendimento.id, tipo: 'criado' });

    return atendimento;
  }

  // Evita depender de setup manual: a primeira vez que um tenant precisa de
  // um Atendimento e ainda nao tem nenhuma Fila, cria as 3 padrao.
  private async ensureDefaultFilas(tenantId: string): Promise<void> {
    const count = await this.filaRepository.countByTenant(tenantId);
    if (count > 0) return;

    for (const nome of DEFAULT_FILA_NAMES) {
      await this.filaRepository.create({ tenantId, nome });
    }
  }
}
