// src/modules/campanhas_sms/infra/providers/console-sms.provider.ts
// Modo simulacao (padrao, SMS_PROVIDER diferente de "zenvia"): NAO envia nada.
// Registra no log so o telefone mascarado e o tamanho do texto. Permite testar
// a campanha inteira (importar, iniciar, acompanhar, clicar) sem gastar SMS.
import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { EnviarSmsInput, EnviarSmsResultado, ISmsProvider } from '../../domain/services/sms-provider.interface';
import { mascararTelefone } from '../../domain/services/telefone';

@Injectable()
export class ConsoleSmsProvider implements ISmsProvider {
  private readonly logger = new Logger('SmsSimulado');
  readonly nome = 'Simulação (nenhum SMS é enviado)';
  readonly simulado = true;

  disponivel(): boolean {
    return true;
  }

  async enviar(input: EnviarSmsInput): Promise<EnviarSmsResultado> {
    this.logger.log(`[SIMULADO] SMS para ${mascararTelefone(input.para)} (${input.texto.length} caracteres)`);
    return { provedorMensagemId: `simulado-${randomUUID()}` };
  }
}
