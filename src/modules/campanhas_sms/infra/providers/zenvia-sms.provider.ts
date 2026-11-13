// src/modules/campanhas_sms/infra/providers/zenvia-sms.provider.ts
// Zenvia API v2 (https://zenvia.github.io/zenvia-openapi-spec/v2/):
// POST https://api.zenvia.com/v2/channels/sms/messages, header X-API-TOKEN.
// Host fixo (nunca vem do usuario), redirect NAO seguido, timeout 15 s,
// resposta lida com teto de 64 KB. Erros sem telefone/texto (vao para banco/log).
import { Injectable } from '@nestjs/common';
import { EnviarSmsInput, EnviarSmsResultado, ISmsProvider, SmsProviderError } from '../../domain/services/sms-provider.interface';

export const ZENVIA_URL = 'https://api.zenvia.com/v2/channels/sms/messages';
const TIMEOUT_MS = 15_000;
const MAX_RESPOSTA = 64 * 1024;

type Fetch = typeof fetch;

export interface ZenviaConfig {
  token: string;
  from: string;
}

export function lerConfigZenvia(env: NodeJS.ProcessEnv = process.env): ZenviaConfig | null {
  const token = (env.ZENVIA_API_TOKEN || '').trim();
  const from = (env.ZENVIA_SMS_FROM || '').trim();
  return token && from ? { token, from } : null;
}

async function lerTexto(res: Response): Promise<string> {
  const texto = await res.text();
  return texto.length > MAX_RESPOSTA ? texto.slice(0, MAX_RESPOSTA) : texto;
}

@Injectable()
export class ZenviaSmsProvider implements ISmsProvider {
  readonly nome = 'Zenvia';
  readonly simulado = false;

  constructor(
    private readonly config: ZenviaConfig | null = lerConfigZenvia(),
    private readonly fetchFn: Fetch = fetch,
  ) {}

  disponivel(): boolean {
    return this.config !== null;
  }

  async enviar(input: EnviarSmsInput): Promise<EnviarSmsResultado> {
    if (!this.config) throw new SmsProviderError('Zenvia não configurada (ZENVIA_API_TOKEN / ZENVIA_SMS_FROM).', false);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let res: Response;
    try {
      res = await this.fetchFn(ZENVIA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-API-TOKEN': this.config.token },
        body: JSON.stringify({
          from: this.config.from,
          to: input.para,
          contents: [{ type: 'text', text: input.texto }],
          externalId: input.idExterno,
        }),
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch (e) {
      const abortado = (e as Error)?.name === 'AbortError';
      throw new SmsProviderError(abortado ? 'Zenvia não respondeu em 15 s.' : 'Sem conexão com a Zenvia.', true);
    } finally {
      clearTimeout(timer);
    }

    const corpo = await lerTexto(res).catch(() => '');
    if (res.status === 200 || res.status === 201) {
      let id: unknown;
      try {
        id = (JSON.parse(corpo) as { id?: unknown }).id;
      } catch {
        id = undefined;
      }
      if (typeof id !== 'string' || !id) throw new SmsProviderError('Zenvia respondeu sem o id da mensagem.', false);
      return { provedorMensagemId: id.slice(0, 100) };
    }
    const temporario = res.status === 429 || res.status >= 500;
    throw new SmsProviderError(`Zenvia recusou (HTTP ${res.status}${descricaoErro(corpo)}).`, temporario);
  }
}

/** So o "code"/"message" do erro da Zenvia, curto e sem dados do envio. */
function descricaoErro(corpo: string): string {
  try {
    const j = JSON.parse(corpo) as { code?: unknown; message?: unknown };
    const partes = [j.code, j.message].filter((x) => typeof x === 'string' && x).map((x) => String(x).replace(/\d{8,}/g, '***'));
    return partes.length ? `: ${partes.join(' - ').slice(0, 150)}` : '';
  } catch {
    return '';
  }
}
