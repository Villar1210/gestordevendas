// src/modules/vendas_kanban/infra/http/repique-descadastro-public.controller.ts
// Controller PUBLICO (sem JwtAuthGuard/RolesGuard) - o token do link e a
// propria fronteira de seguranca, mesmo padrao ja usado pelo modulo E-doc
// (sign-public.controller.ts). Retorna HTML direto (nao JSON) porque este
// link e clicado a partir de um e-mail - um link de descadastro precisa
// funcionar sem depender de JS/SPA do frontend carregar primeiro.
import { Controller, Get, Header, Param } from '@nestjs/common';
import { OptOutRepiqueViaTokenUseCase } from '../../application/use-cases/optout-repique-via-token.use-case';

const ESTILO_BASE = `
  body { font-family: -apple-system, Segoe UI, sans-serif; background: #f8fafc; color: #1e293b;
    display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 24px; }
  .card { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 32px;
    max-width: 420px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }
  h1 { font-size: 18px; color: #1e293b; margin: 0 0 12px; }
  p { font-size: 14px; color: #64748b; line-height: 1.5; margin: 0; }
  .icone { font-size: 32px; margin-bottom: 12px; }
`;

function paginaHtml(icone: string, titulo: string, mensagem: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titulo}</title>
  <style>${ESTILO_BASE}</style>
</head>
<body>
  <div class="card">
    <div class="icone">${icone}</div>
    <h1>${titulo}</h1>
    <p>${mensagem}</p>
  </div>
</body>
</html>`;
}

@Controller('public/repique/descadastro')
export class RepiqueDescadastroPublicController {
  constructor(private readonly optOutRepiqueViaTokenUseCase: OptOutRepiqueViaTokenUseCase) {}

  // GET /public/repique/descadastro/:token - valida o token e marca opt-out.
  // Token invalido/inexistente NUNCA revela se um lead existiu - mesma
  // mensagem generica nos dois casos (nao encontrado vs. ja descadastrado
  // sao tratados de formas diferentes, mas "nunca existiu" e "token de
  // outro tenant" ficam indistinguiveis do "nao encontrado" generico).
  @Get(':token')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async descadastrar(@Param('token') token: string): Promise<string> {
    const resultado = await this.optOutRepiqueViaTokenUseCase.execute({ token });

    if (!resultado.encontrado) {
      return paginaHtml(
        '⚠️',
        'Link inválido',
        'Este link de descadastro não é válido ou já expirou. Se você continuar recebendo mensagens indesejadas, entre em contato conosco.',
      );
    }

    return paginaHtml(
      '✅',
      'Descadastro confirmado',
      'Você não receberá mais nossas comunicações de remarketing. Se mudar de ideia, é só entrar em contato conosco novamente.',
    );
  }
}
