// Resiliencia a chamada da Anthropic API (commit bea2007, Critico #1 da
// auditoria de producao). A distincao transitorio/definitivo NAO vive em
// ProcessIncomingMessageUseCase (ver spec proprio - so trata a excecao
// JA FINAL) - ela e inteiramente do SDK (shouldRetry(), configurado via
// maxRetries: 2 no construtor de AnthropicConversationService). Por isso o
// teste dessa distincao precisa ficar AQUI, mockando o `fetch` global (o
// SDK cai pra ele quando nenhum `fetch` e passado explicitamente - ver
// node_modules/@anthropic-ai/sdk/internal/shims.mjs) para simular respostas
// HTTP realistas, sem nenhuma chamada de rede de verdade.
import { AnthropicConversationService } from './anthropic-conversation.service';

function textResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function successBody(text: string) {
  return {
    id: 'msg_test',
    type: 'message',
    role: 'assistant',
    model: 'claude-haiku-4-5-20251001',
    content: [{ type: 'text', text }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 5 },
  };
}

function errorBody(type: string, message: string) {
  return { type: 'error', error: { type, message } };
}

describe('AnthropicConversationService - transitorio vs definitivo (maxRetries: 2)', () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = 'test-key';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env.ANTHROPIC_API_KEY = originalApiKey;
  });

  it('falha TRANSITORIA (429 - rate limit): o SDK reprocessa automaticamente e a chamada acaba tendo sucesso', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(textResponse(429, errorBody('rate_limit_error', 'rate limited')))
      .mockResolvedValueOnce(textResponse(200, successBody('Ola! Como posso ajudar?')));
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new AnthropicConversationService();
    const result = await service.generateReply({ systemPrompt: 'sys', history: [], userMessage: 'oi' });

    expect(result.replyText).toBe('Ola! Como posso ajudar?');
    // 1a tentativa (429, transitorio) + 1 retry automatico (sucesso) = 2
    // chamadas HTTP - o CHAMADOR (ProcessIncomingMessageUseCase) nunca fica
    // sabendo que houve uma falha no meio do caminho.
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10000);

  it('falha DEFINITIVA (400 - requisicao invalida): o SDK NAO reprocessa, falha ja na primeira tentativa', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(textResponse(400, errorBody('invalid_request_error', 'prompt invalido')));
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new AnthropicConversationService();

    await expect(
      service.generateReply({ systemPrompt: 'sys', history: [], userMessage: 'oi' }),
    ).rejects.toThrow();

    // Erro nao-transitorio (400 nao esta na lista 408/409/429/>=500 de
    // shouldRetry): falha IMEDIATA, nenhuma tentativa de retry gasta -
    // exatamente o cenario que faz handleAiFailure disparar sem demora.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  }, 10000);

  it('falha transitoria que esgota TODAS as tentativas (2 retries): propaga a excecao definitiva para o chamador', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(textResponse(500, errorBody('api_error', 'erro interno persistente')));
    global.fetch = fetchMock as unknown as typeof fetch;

    const service = new AnthropicConversationService();

    await expect(
      service.generateReply({ systemPrompt: 'sys', history: [], userMessage: 'oi' }),
    ).rejects.toThrow();

    // maxRetries: 2 = 1 tentativa inicial + 2 retries = 3 chamadas HTTP no
    // total antes de desistir. So DEPOIS de esgotar essas 3 tentativas a
    // excecao chega definitiva em ProcessIncomingMessageUseCase.handleAiFailure
    // (ver spec proprio, que testa o que acontece a partir daqui).
    expect(fetchMock).toHaveBeenCalledTimes(3);
  }, 15000);
});
