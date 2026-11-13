import 'reflect-metadata';
import * as ExcelJS from 'exceljs';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ZenviaSmsProvider, ZENVIA_URL } from './providers/zenvia-sms.provider';
import { ConsoleSmsProvider } from './providers/console-sms.provider';
import { SmsProviderError } from '../domain/services/sms-provider.interface';
import { traduzirEventoZenvia } from './http/zenvia-evento';
import { LeitorPlanilhaContatos, inspecionarZip } from './planilha/leitor-planilha-contatos';
import { ArquivoInvalidoError } from '../domain/services/leitor-planilha.interface';
import { CampanhaSmsController } from './http/campanha-sms.controller';
import { CampanhaSmsPublicoController } from './http/campanha-sms-publico.controller';
import { JwtAuthGuard } from '../../../shared/infra/http/guards/jwt-auth.guard';
import { RolesGuard } from '../../../shared/infra/http/guards/roles.guard';
import { ROLES_KEY } from '../../../shared/infra/http/decorators/roles.decorator';
import { criarSmsProvider } from '../campanhas-sms.module';
import { baseLinkCurto, momentoLocal } from '../application/services/campanha-config';

function resposta(status: number, corpo: unknown): Response {
  return new Response(typeof corpo === 'string' ? corpo : JSON.stringify(corpo), { status });
}

describe('ZenviaSmsProvider', () => {
  const cfg = { token: 'tok-secreto', from: 'novolar' };

  it('envia no formato da API v2 e devolve o id', async () => {
    const fetchFn = jest.fn().mockResolvedValue(resposta(200, { id: 'msg-123' }));
    const p = new ZenviaSmsProvider(cfg, fetchFn as unknown as typeof fetch);
    await expect(p.enviar({ para: '5511987654321', texto: 'Oi', idExterno: 'c1' })).resolves.toEqual({ provedorMensagemId: 'msg-123' });
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe(ZENVIA_URL);
    expect(init.headers['X-API-TOKEN']).toBe('tok-secreto');
    expect(init.redirect).toBe('manual');
    expect(JSON.parse(init.body)).toEqual({ from: 'novolar', to: '5511987654321', contents: [{ type: 'text', text: 'Oi' }], externalId: 'c1' });
  });

  it('4xx = permanente, 429/5xx/rede = temporario; mensagem sem numero', async () => {
    const p400 = new ZenviaSmsProvider(cfg, jest.fn().mockResolvedValue(resposta(400, { code: 'INVALID_TO', message: 'to 5511987654321 invalid' })) as never);
    const e400 = await p400.enviar({ para: '5511987654321', texto: 'x', idExterno: 'c' }).catch((e) => e);
    expect(e400).toBeInstanceOf(SmsProviderError);
    expect(e400.temporario).toBe(false);
    expect(e400.message).not.toContain('5511987654321');
    for (const st of [429, 500, 503]) {
      const p = new ZenviaSmsProvider(cfg, jest.fn().mockResolvedValue(resposta(st, '')) as never);
      expect((await p.enviar({ para: '5511987654321', texto: 'x', idExterno: 'c' }).catch((e) => e)).temporario).toBe(true);
    }
    const pRede = new ZenviaSmsProvider(cfg, jest.fn().mockRejectedValue(new TypeError('fetch failed')) as never);
    expect((await pRede.enviar({ para: '5511987654321', texto: 'x', idExterno: 'c' }).catch((e) => e)).temporario).toBe(true);
  });

  it('sem config = indisponivel', () => {
    expect(new ZenviaSmsProvider(null).disponivel()).toBe(false);
    expect(criarSmsProvider({ SMS_PROVIDER: 'zenvia' } as NodeJS.ProcessEnv).disponivel()).toBe(false);
    expect(criarSmsProvider({ SMS_PROVIDER: 'zenvia', ZENVIA_API_TOKEN: 'a', ZENVIA_SMS_FROM: 'b' } as NodeJS.ProcessEnv).disponivel()).toBe(true);
    expect(criarSmsProvider({} as NodeJS.ProcessEnv)).toBeInstanceOf(ConsoleSmsProvider);
  });
});

describe('config', () => {
  it('base do link curto: so https (http so localhost)', () => {
    expect(baseLinkCurto({ SHORTLINK_BASE_URL: 'https://gestordevendas.ivillar.com.br/r/' } as NodeJS.ProcessEnv)).toBe(
      'https://gestordevendas.ivillar.com.br/r',
    );
    expect(baseLinkCurto({ FRONTEND_URL: 'https://gestordevendas.ivillar.com.br' } as NodeJS.ProcessEnv)).toBe(
      'https://gestordevendas.ivillar.com.br/api/r',
    );
    expect(baseLinkCurto({ SHORTLINK_BASE_URL: 'http://evil.com/r' } as NodeJS.ProcessEnv)).toBe('http://localhost:3000/api/r');
  });

  it('momento local em Sao Paulo', () => {
    expect(momentoLocal(new Date('2026-11-16T14:30:00Z'))).toEqual({ diaSemana: 1, hora: 11 });
    expect(momentoLocal(new Date('2026-11-16T02:00:00Z'))).toEqual({ diaSemana: 0, hora: 23 });
  });
});

describe('traduzirEventoZenvia', () => {
  it('status e resposta', () => {
    expect(traduzirEventoZenvia({ type: 'MESSAGE_STATUS', messageId: 'm1', messageStatus: { code: 'DELIVERED' } })).toEqual({
      tipo: 'status',
      provedorMensagemId: 'm1',
      status: 'entregue',
      descricao: undefined,
    });
    expect(traduzirEventoZenvia({ type: 'MESSAGE_STATUS', messageId: 'm1', messageStatus: { code: 'NOT_DELIVERED', description: 'x' } })).toMatchObject({
      status: 'falhou',
    });
    expect(
      traduzirEventoZenvia({ type: 'MESSAGE', message: { direction: 'IN', from: '5511987654321', contents: [{ type: 'text', text: 'SAIR' }] } }),
    ).toEqual({ tipo: 'resposta', de: '5511987654321', texto: 'SAIR' });
  });

  it('ignora o resto', () => {
    expect(traduzirEventoZenvia(null)).toBeNull();
    expect(traduzirEventoZenvia([])).toBeNull();
    expect(traduzirEventoZenvia({ type: 'MESSAGE_STATUS', messageStatus: { code: 'XYZ' }, messageId: 'a' })).toBeNull();
    expect(traduzirEventoZenvia({ type: 'MESSAGE', message: { direction: 'OUT', from: '1', contents: [] } })).toBeNull();
  });
});

describe('LeitorPlanilhaContatos', () => {
  const leitor = new LeitorPlanilhaContatos();

  async function xlsx(abas: Record<string, unknown[][]>): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    for (const [nome, linhas] of Object.entries(abas)) {
      const ws = wb.addWorksheet(nome);
      linhas.forEach((l) => ws.addRow(l));
    }
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  it('xlsx: prefere a aba SMS e le numero como texto', async () => {
    const buf = await xlsx({
      Resumo: [['x'], ['y']],
      SMS: [
        ['nome', 'telefone'],
        ['Ana', 5511987654321],
      ],
    });
    const linhas = await leitor.ler(buf, 'a.xlsx', 100);
    expect(linhas).toEqual([
      ['nome', 'telefone'],
      ['Ana', '5511987654321'],
    ]);
  });

  it('xlsx: limite de linhas', async () => {
    const buf = await xlsx({ SMS: [['telefone'], ...Array.from({ length: 20 }, () => ['5511987654321'])] });
    await expect(leitor.ler(buf, 'a.xlsx', 10)).rejects.toBeInstanceOf(ArquivoInvalidoError);
  });

  it('csv com ; e com , (latin1 do Excel)', async () => {
    expect(await leitor.ler(Buffer.from('﻿nome;telefone\r\nAna;11987654321\r\n'), 'a.csv', 10)).toEqual([
      ['nome', 'telefone'],
      ['Ana', '11987654321'],
    ]);
    expect(await leitor.ler(Buffer.from('nome,telefone\nJoão,11987654321\n', 'latin1'), 'a.csv', 10)).toEqual([
      ['nome', 'telefone'],
      ['João', '11987654321'],
    ]);
    await expect(leitor.ler(Buffer.from([0x00, 0x01, 0x02]), 'a.bin', 10)).rejects.toBeInstanceOf(ArquivoInvalidoError);
  });

  it('zip corrompido / com macro e recusado', async () => {
    expect(() => inspecionarZip(Buffer.from('PK\u0003\u0004lixo'))).toThrow(ArquivoInvalidoError);
    const buf = await xlsx({ SMS: [['telefone']] });
    expect(() => inspecionarZip(buf)).not.toThrow();
    const comMacro = Buffer.from(buf.toString('latin1').split('xl/workbook.xml').join('xl/vbaProject.x'), 'latin1');
    expect(() => inspecionarZip(comMacro)).toThrow(/macro/);
  });
});

describe('permissoes das rotas', () => {
  it('controller da tela: classe com JwtAuthGuard + RolesGuard e so Administrador', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, CampanhaSmsController) as unknown[];
    expect(guards).toEqual([JwtAuthGuard, RolesGuard]);
    expect(Reflect.getMetadata(ROLES_KEY, CampanhaSmsController)).toEqual(['Administrador']);
    // nenhuma rota sobrescreve o @Roles da classe
    const proto = CampanhaSmsController.prototype as unknown as Record<string, unknown>;
    for (const nome of Object.getOwnPropertyNames(proto).filter((n) => n !== 'constructor')) {
      expect(Reflect.getMetadata(ROLES_KEY, proto[nome] as object)).toBeUndefined();
    }
  });

  it('controller publico nao tem guard de autenticacao', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, CampanhaSmsPublicoController)).toBeUndefined();
  });
});

describe('controller publico', () => {
  function res() {
    const r: Record<string, jest.Mock> & { statusCode?: number } = {} as never;
    r.setHeader = jest.fn();
    r.status = jest.fn(() => r);
    r.type = jest.fn(() => r);
    r.send = jest.fn(() => r);
    r.redirect = jest.fn();
    return r;
  }

  it('redireciona so para o destino da campanha; invalido = 404', async () => {
    const clique = { execute: jest.fn().mockResolvedValueOnce('https://freguesia.ivillar.com.br/?c=AAAAAA').mockResolvedValueOnce(null) };
    const ctrl = new CampanhaSmsPublicoController(clique as never, { execute: jest.fn() } as never);
    const r1 = res();
    await ctrl.abrir('AAAAAA', { method: 'GET' } as never, r1 as never);
    expect(clique.execute).toHaveBeenCalledWith({ codigo: 'AAAAAA', contar: true });
    expect(r1.redirect).toHaveBeenCalledWith(302, 'https://freguesia.ivillar.com.br/?c=AAAAAA');
    const r2 = res();
    await ctrl.abrir('BBBBBB', { method: 'HEAD' } as never, r2 as never);
    expect(clique.execute).toHaveBeenLastCalledWith({ codigo: 'BBBBBB', contar: false });
    expect(r2.status).toHaveBeenCalledWith(404);
    expect(r2.redirect).not.toHaveBeenCalled();
  });

  it('webhook: sem variavel 503, token errado 404, certo 200', async () => {
    const evento = { execute: jest.fn() };
    const ctrl = new CampanhaSmsPublicoController({ execute: jest.fn() } as never, evento as never);
    const corpo = { type: 'MESSAGE', message: { direction: 'IN', from: '5511987654321', contents: [{ type: 'text', text: 'SAIR' }] } };
    const antes = process.env.ZENVIA_WEBHOOK_TOKEN;
    try {
      delete process.env.ZENVIA_WEBHOOK_TOKEN;
      await expect(ctrl.webhookZenvia('x', corpo)).rejects.toMatchObject({ status: 503 });
      process.env.ZENVIA_WEBHOOK_TOKEN = 'um-token-bem-comprido-123';
      await expect(ctrl.webhookZenvia('errado', corpo)).rejects.toMatchObject({ status: 404 });
      await expect(ctrl.webhookZenvia('um-token-bem-comprido-123', corpo)).resolves.toEqual({ ok: true });
      expect(evento.execute).toHaveBeenCalledWith({ tipo: 'resposta', de: '5511987654321', texto: 'SAIR' });
      evento.execute.mockRejectedValueOnce(new Error('db fora'));
      await expect(ctrl.webhookZenvia('um-token-bem-comprido-123', corpo)).resolves.toEqual({ ok: true });
    } finally {
      if (antes === undefined) delete process.env.ZENVIA_WEBHOOK_TOKEN;
      else process.env.ZENVIA_WEBHOOK_TOKEN = antes;
    }
  });
});
