// src/modules/rh/domain/services/email-template-padrao.ts
// Camada de DOMINIO: texto puro, sem Prisma/NestJS. Defaults usados por
// GetOrCreateEmailTemplateUseCase para criar automaticamente o
// EmailTemplate de um tenant na primeira leitura - o mesmo texto que
// estava hardcoded nos use cases antes desta fatia, so convertido para
// placeholders. Placeholders preenchidos por preencher-email-template.ts.
import { EmailTemplateTipo } from './email-template-tipos';

interface EmailTemplatePadrao {
  assunto: string;
  corpo: string;
}

export const EMAIL_TEMPLATE_PADRAO: Record<EmailTemplateTipo, EmailTemplatePadrao> = {
  boas_vindas_corretor: {
    assunto: 'Bem-vindo(a) à {{EMPRESA}}',
    corpo: `<p>Olá, {{NOME}}.</p><p>Sua conta de corretor foi criada na {{EMPRESA}}.</p><p>Acesse com o e-mail <strong>{{EMAIL}}</strong> e a senha temporária abaixo. Você precisará escolher uma nova senha logo no primeiro login.</p><p><strong>Senha temporária:</strong> {{SENHA_TEMPORARIA}}</p>`,
  },
  rejeicao_cadastro: {
    assunto: 'Sobre o seu cadastro',
    corpo: `<p>Olá, {{NOME}}.</p><p>Analisamos seu cadastro na {{EMPRESA}} e, no momento, não foi possível aprová-lo. Se tiver dúvidas, entre em contato com a nossa equipe.</p>`,
  },
  aprovacao_cadastro: {
    assunto: 'Seu cadastro foi aprovado!',
    corpo: `<p>Olá, {{NOME}}.</p><p>Seu cadastro na {{EMPRESA}} foi aprovado! Você já pode entrar no sistema com o e-mail e a senha que você escolheu no cadastro.</p>`,
  },
};
