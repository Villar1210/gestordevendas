// src/modules/campanhas_sms/domain/services/sms-provider.interface.ts
// Contrato do provedor de SMS (dominio). Trocar de provedor = trocar so a
// implementacao em infra/providers (hoje Zenvia e um simulador de console).

export interface EnviarSmsInput {
  // 55DDD9XXXXXXXX
  para: string;
  texto: string;
  // Nosso id (contato) - volta no webhook de alguns provedores.
  idExterno: string;
}

export interface EnviarSmsResultado {
  provedorMensagemId: string;
}

export interface ISmsProvider {
  readonly nome: string;
  // true = nao envia SMS de verdade (modo simulacao).
  readonly simulado: boolean;
  // false = provedor escolhido mas sem credenciais (iniciar/teste -> 503).
  disponivel(): boolean;
  enviar(input: EnviarSmsInput): Promise<EnviarSmsResultado>;
}

export const SMS_PROVIDER = Symbol('ISmsProvider');

/**
 * Erro do provedor. temporario = vale tentar de novo depois (timeout, 429,
 * 5xx); permanente = numero recusado, credencial invalida etc.
 * mensagem NUNCA leva telefone nem texto do SMS (vai para o banco e o log).
 */
export class SmsProviderError extends Error {
  constructor(
    message: string,
    readonly temporario: boolean,
  ) {
    super(message);
    this.name = 'SmsProviderError';
  }
}
