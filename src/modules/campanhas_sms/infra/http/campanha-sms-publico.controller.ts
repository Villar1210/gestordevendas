// src/modules/campanhas_sms/infra/http/campanha-sms-publico.controller.ts
// Rotas PUBLICAS (sem JwtAuthGuard): o link curto e o webhook da Zenvia.
// - GET /r/:codigo: soma o clique (HEAD nao conta) e redireciona (302) SO para
//   o link de destino da propria campanha. Codigo invalido -> pagina 404, nunca
//   redireciona para outro lugar (sem open redirect).
// - POST /webhooks/zenvia/sms/:token: token comparado em tempo constante com
//   ZENVIA_WEBHOOK_TOKEN. Sem a variavel -> 503; token errado -> 404 (nao
//   revela que a rota existe). Token certo -> sempre 200, ate com id
//   desconhecido (a Zenvia reenviaria em caso de erro).
import { Body, Controller, Get, HttpCode, Logger, NotFoundException, Param, Post, Req, Res, ServiceUnavailableException } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { createHash, timingSafeEqual } from 'crypto';
import { ProcessarEventoSmsUseCase, RegistrarCliqueUseCase } from '../../application/use-cases/publicos.use-cases';
import { traduzirEventoZenvia } from './zenvia-evento';

const PAGINA_INVALIDA = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Link inválido</title>
<style>body{font-family:-apple-system,Segoe UI,sans-serif;background:#f8fafc;color:#1e293b;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:32px;max-width:420px;text-align:center}
h1{font-size:18px;margin:0 0 12px}p{font-size:14px;color:#64748b;line-height:1.5;margin:0}</style></head>
<body><div class="card"><h1>Link inválido</h1><p>Este link não existe ou foi digitado errado.</p></div></body></html>`;

function tokenConfere(recebido: string, esperado: string): boolean {
  // hash dos dois lados: mesmo tamanho para o timingSafeEqual
  const a = createHash('sha256').update(recebido).digest();
  const b = createHash('sha256').update(esperado).digest();
  return timingSafeEqual(a, b);
}

@Controller()
export class CampanhaSmsPublicoController {
  private readonly logger = new Logger(CampanhaSmsPublicoController.name);

  constructor(
    private readonly clique: RegistrarCliqueUseCase,
    private readonly evento: ProcessarEventoSmsUseCase,
  ) {}

  // O Express atende HEAD pela mesma rota do GET: HEAD (pre-visualizacao de
  // link, robo) redireciona igual mas NAO conta clique.
  @Get('r/:codigo')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async abrir(@Param('codigo') codigo: string, @Req() req: Request, @Res() res: Response) {
    return this.redirecionar(codigo, req.method !== 'HEAD', res);
  }

  private async redirecionar(codigo: string, contar: boolean, res: Response) {
    const destino = await this.clique.execute({ codigo, contar });
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Referrer-Policy', 'no-referrer');
    if (!destino) {
      res.status(404).type('html').send(PAGINA_INVALIDA);
      return;
    }
    res.redirect(302, destino);
  }

  @Post('webhooks/zenvia/sms/:token')
  @HttpCode(200)
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  async webhookZenvia(@Param('token') token: string, @Body() corpo: unknown) {
    const esperado = (process.env.ZENVIA_WEBHOOK_TOKEN || '').trim();
    if (esperado.length < 16) throw new ServiceUnavailableException('Webhook de SMS não configurado.');
    if (!tokenConfere(String(token ?? ''), esperado)) throw new NotFoundException();
    const evento = traduzirEventoZenvia(corpo);
    if (!evento) return { ok: true, ignorado: true };
    try {
      await this.evento.execute(evento);
    } catch (e) {
      // Devolve 200 mesmo assim: o erro e nosso, reenviar nao ajuda.
      this.logger.error(`Falha ao processar evento de SMS (${evento.tipo}): ${(e as Error).message}`);
    }
    return { ok: true };
  }
}
