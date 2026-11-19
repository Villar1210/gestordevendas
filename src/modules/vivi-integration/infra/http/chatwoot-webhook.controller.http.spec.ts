// Etapa 1, parte 2 (19/11/2026): rota publica POST /chatwoot/eventos de
// verdade (Nest + corpo bruto), com o use case trocado por um mock.
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { createHmac } from 'crypto';
import { ChatwootWebhookController } from './chatwoot-webhook.controller';
import { RegistrarMensagemChatwootUseCase } from '../../application/use-cases/registrar-mensagem-chatwoot.use-case';

jest.setTimeout(30_000);

const SEGREDO = 'segredo-http';
const env: Record<string, string | undefined> = {
  CHATWOOT_WEBHOOK_SECRET: SEGREDO,
  VIVI_TENANT_ID: 'tenant-1',
  CHATWOOT_INBOX_OFICIAL_ID: '2',
};

const evento = {
  event: 'message_created',
  id: 777,
  content: 'Oi',
  created_at: '2026-11-19T12:00:00.000Z',
  message_type: 'incoming',
  private: false,
  inbox: { id: 2 },
  conversation: { id: 65, meta: { sender: { phone_number: '+5511973879858' } } },
  sender: { name: 'VILLAR' },
};

describe('ChatwootWebhookController (HTTP)', () => {
  let app: INestApplication;
  let url: string;
  const executar = jest.fn();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ChatwootWebhookController],
      providers: [
        { provide: ConfigService, useValue: { get: (k: string, padrao?: string) => env[k] ?? padrao } },
        { provide: RegistrarMensagemChatwootUseCase, useValue: { execute: executar } },
      ],
    }).compile();
    app = moduleRef.createNestApplication({ rawBody: true, logger: false });
    await app.listen(0, '127.0.0.1');
    url = `${await app.getUrl()}/chatwoot/eventos`;
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    executar.mockReset();
    executar.mockResolvedValue({ gravada: true, cardId: 'card-1' });
    env.CHATWOOT_WEBHOOK_SECRET = SEGREDO;
  });

  function enviar(corpo: string, cabecalhos: Record<string, string>) {
    return fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...cabecalhos }, body: corpo });
  }

  function assinado(corpo: string, ts = Math.floor(Date.now() / 1000), segredo = SEGREDO) {
    return {
      'X-Chatwoot-Timestamp': String(ts),
      'X-Chatwoot-Signature': 'sha256=' + createHmac('sha256', segredo).update(`${ts}.${corpo}`).digest('hex'),
    };
  }

  it('aviso assinado: grava a mensagem (200)', async () => {
    const corpo = JSON.stringify(evento);
    const res = await enviar(corpo, assinado(corpo));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, gravada: true });
    expect(executar).toHaveBeenCalledWith('tenant-1', expect.objectContaining({ chatwootMessageId: 777, telefone: '+5511973879858' }));
  });

  it('sem assinatura, assinatura errada ou antiga: 401 e nada e gravado', async () => {
    const corpo = JSON.stringify(evento);
    expect((await enviar(corpo, {})).status).toBe(401);
    expect((await enviar(corpo, assinado(corpo, undefined, 'outro-segredo'))).status).toBe(401);
    expect((await enviar(corpo, assinado(corpo, Math.floor(Date.now() / 1000) - 600))).status).toBe(401);
    expect(executar).not.toHaveBeenCalled();
  });

  it('corpo alterado depois de assinado: 401', async () => {
    const corpo = JSON.stringify(evento);
    const adulterado = JSON.stringify({ ...evento, content: 'Oi (alterado)' });
    expect((await enviar(adulterado, assinado(corpo))).status).toBe(401);
    expect(executar).not.toHaveBeenCalled();
  });

  it('servidor sem segredo configurado recusa tudo (401)', async () => {
    env.CHATWOOT_WEBHOOK_SECRET = undefined;
    const corpo = JSON.stringify(evento);
    expect((await enviar(corpo, assinado(corpo))).status).toBe(401);
  });

  it('evento que nao interessa (nota interna): 200 sem gravar', async () => {
    const corpo = JSON.stringify({ ...evento, private: true });
    const res = await enviar(corpo, assinado(corpo));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(executar).not.toHaveBeenCalled();
  });

  it('falha ao gravar: 500 (o Chatwoot pode reenviar sem duplicar)', async () => {
    executar.mockRejectedValueOnce(new Error('banco fora'));
    const corpo = JSON.stringify(evento);
    expect((await enviar(corpo, assinado(corpo))).status).toBe(500);
  });
});
