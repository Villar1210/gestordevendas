// src/modules/campanhas_sms/application/services/processador-envio.service.ts
// Uma rodada do envio (chamada pelo scheduler a cada 15 s). Para cada campanha
// "enviando" dentro da janela: reserva ate N pendentes (pendente -> enviando,
// condicional), confere opt-out de novo, monta o texto e chama o provedor.
// Nunca reenvia sozinho um contato que ficou em "enviando" (servidor caiu no
// meio): isso vira "falhou" no boot (falharTravados) para nao mandar em dobro.
import { Inject, Injectable, Logger } from '@nestjs/common';
import { CAMPANHA_REPOSITORY, CampanhaRecord, ICampanhaRepository } from '../../domain/repositories/campanha-repository.interface';
import { ISmsProvider, SMS_PROVIDER, SmsProviderError } from '../../domain/services/sms-provider.interface';
import { dentroDaJanela, envioPorRodada } from '../../domain/services/janela-envio';
import { LIMITES } from '../../domain/services/campanha-regras';
import { montarMensagem } from '../../domain/services/sms-texto';
import { mascararTelefone } from '../../domain/services/telefone';
import { CampanhaConfig, momentoLocal } from './campanha-config';

export const ERRO_INTERROMPIDO = 'Envio interrompido (servidor reiniciou) — confira antes de reenviar.';

export interface ResumoRodada {
  campanhas: number;
  enviados: number;
  falhas: number;
  adiados: number;
  bloqueados: number;
  concluidas: number;
}

@Injectable()
export class ProcessadorEnvioService {
  private readonly logger = new Logger(ProcessadorEnvioService.name);

  constructor(
    @Inject(CAMPANHA_REPOSITORY) private readonly repo: ICampanhaRepository,
    @Inject(SMS_PROVIDER) private readonly provider: ISmsProvider,
    private readonly config: CampanhaConfig,
  ) {}

  async recuperarTravados(): Promise<number> {
    const n = await this.repo.falharTravados(ERRO_INTERROMPIDO);
    if (n > 0) this.logger.warn(`${n} contato(s) de campanha SMS estavam em envio quando o servidor parou: marcados como falha (sem reenvio automático).`);
    return n;
  }

  async rodar(sinal?: { abortado: boolean }): Promise<ResumoRodada> {
    const resumo: ResumoRodada = { campanhas: 0, enviados: 0, falhas: 0, adiados: 0, bloqueados: 0, concluidas: 0 };
    if (!this.provider.disponivel()) return resumo;
    const agora = this.config.agora();
    const momento = momentoLocal(agora);
    const campanhas = await this.repo.campanhasEnviando();
    for (const campanha of campanhas) {
      if (sinal?.abortado) break;
      resumo.campanhas++;
      if (!dentroDaJanela(momento, campanha.janelaInicio, campanha.janelaFim)) continue;
      await this.processarCampanha(campanha, resumo, sinal);
      if (!(await this.repo.existeAEnviar(campanha.id))) {
        const ok = await this.repo.mudarStatus(campanha.tenantId, campanha.id, ['enviando'], 'concluida', { concluidaEm: this.config.agora() });
        if (ok) {
          resumo.concluidas++;
          this.logger.log(`Campanha SMS concluída campanha=${campanha.id} tenant=${campanha.tenantId}`);
        }
      }
    }
    return resumo;
  }

  private async processarCampanha(campanha: CampanhaRecord, resumo: ResumoRodada, sinal?: { abortado: boolean }): Promise<void> {
    const lote = await this.repo.pendentes(campanha.id, envioPorRodada(campanha.taxaPorMinuto));
    if (lote.length === 0) return;
    const optouts = await this.repo.telefonesEmOptout(campanha.tenantId, lote.map((c) => c.telefone));
    for (const contato of lote) {
      if (sinal?.abortado) return;
      if (optouts.has(contato.telefone)) {
        await this.repo.marcarBloqueado(contato.id);
        resumo.bloqueados++;
        continue;
      }
      if (!(await this.repo.reservar(contato.id))) continue;
      const texto = montarMensagem(campanha.mensagem, {
        primeiroNome: contato.primeiroNome,
        link: this.config.linkDoCodigo(contato.codigo),
      });
      try {
        const res = await this.provider.enviar({ para: contato.telefone, texto, idExterno: contato.id });
        await this.repo.marcarEnviado(contato.id, res.provedorMensagemId, this.config.agora());
        resumo.enviados++;
      } catch (e) {
        const temporario = e instanceof SmsProviderError ? e.temporario : true;
        const msg = (e instanceof SmsProviderError ? e.message : 'Falha inesperada ao enviar.').slice(0, 300);
        const tentativas = contato.tentativas + 1;
        if (temporario && tentativas < LIMITES.tentativasEnvio) {
          await this.repo.devolverPendente(contato.id, msg);
          resumo.adiados++;
        } else {
          await this.repo.marcarFalhou(contato.id, msg);
          resumo.falhas++;
        }
        this.logger.warn(
          `Falha SMS campanha=${campanha.id} contato=${contato.id} para=${mascararTelefone(contato.telefone)} tentativa=${tentativas} temporario=${temporario}: ${msg}`,
        );
      }
    }
  }
}
