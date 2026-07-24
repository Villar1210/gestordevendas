// src/config/env.validation.ts
// Validacao das variaveis de ambiente ESSENCIAIS, rodada uma unica vez no
// boot (ver ConfigModule.forRoot({ validate: validateEnv }) em app.module.ts).
// Objetivo: se uma variavel critica estiver ausente ou em formato claramente
// invalido, a aplicacao deve falhar IMEDIATAMENTE no boot, com uma mensagem
// clara - nunca deixar isso ser descoberto so na primeira chamada real (ex:
// ANTHROPIC_API_KEY invalida so estourando no primeiro atendimento da VIVI).
//
// Reaproveita class-validator/class-transformer (ja usados nos DTOs de
// entrada HTTP do projeto, ver ValidationPipe em main.ts) - primeira vez que
// sao usados para validar o proprio ambiente, nao um DTO de requisicao, mas
// e o mesmo mecanismo, sem precisar de uma dependencia nova (ex: Joi).
//
// Deliberadamente NAO valida todas as variaveis do .env.example - so as que
// travam funcionalidade BASICA do sistema se estiverem erradas (banco,
// autenticacao, VIVI). Variaveis de modulos opcionais (RESEND_API_KEY,
// META_*, LIBREOFFICE_PATH, PUBLIC_SIGNUP_TENANT_ID, SIGNATURE_TOKEN_EXPIRE_DAYS)
// continuam sem validacao de boot - cada uma ja tem fallback proprio ou so
// afeta uma rota/fluxo especifico, nao a aplicacao inteira.
import { plainToInstance } from 'class-transformer';
import { IsString, Matches, MinLength, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsString({ message: 'DATABASE_URL e obrigatoria (connection string do PostgreSQL)' })
  @Matches(/^postgres(ql)?:\/\/.+/, {
    message:
      'DATABASE_URL deve ser uma connection string PostgreSQL valida, comecando com ' +
      '"postgresql://" ou "postgres://"',
  })
  DATABASE_URL!: string;

  @IsString({ message: 'ANTHROPIC_API_KEY e obrigatoria (chave da API da Anthropic, usada pela VIVI)' })
  @Matches(/^sk-ant-/, {
    message: 'ANTHROPIC_API_KEY deve comecar com o prefixo "sk-ant-" (chave da API da Anthropic)',
  })
  ANTHROPIC_API_KEY!: string;

  // Sem validacao de formato (e um segredo opaco escolhido pelo operador),
  // so um minimo de tamanho - existe hoje um fallback inseguro
  // ('secret-fallback', ver auth.module.ts/jwt.strategy.ts) que so deveria
  // ser usado em dev local; exigir a variavel aqui garante que producao
  // nunca suba silenciosamente com esse fallback.
  @IsString({ message: 'JWT_SECRET e obrigatoria (segredo usado para assinar/validar os tokens de login)' })
  @MinLength(16, { message: 'JWT_SECRET deve ter pelo menos 16 caracteres' })
  JWT_SECRET!: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    const mensagens = errors.flatMap((error) => Object.values(error.constraints ?? {}));
    throw new Error(
      'Configuracao de ambiente invalida (.env) - corrija antes de subir a aplicacao:\n' +
        mensagens.map((mensagem) => `  - ${mensagem}`).join('\n'),
    );
  }

  return validatedConfig;
}
