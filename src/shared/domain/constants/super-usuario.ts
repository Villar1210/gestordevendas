// src/shared/domain/constants/super-usuario.ts
// Nome da Role do dono da plataforma SaaS - existe SO dentro do tenant
// "Plataforma" (nome fixo tambem, ver PLATAFORMA_TENANT_NOME), criado uma
// unica vez via script manual (scripts/seed-super-usuario.ts), nunca por
// nenhum fluxo normal do sistema (cadastro publico, aprovacao, criacao de
// corretor, etc. - todos hardcodam nomes de Role especificos e nenhum
// aceita o nome da Role como entrada livre do usuario - ver modulo
// super_usuario). Deliberadamente FORA de DASHBOARD_ROLES - Super Usuario
// nao acessa o dashboard normal, so a tela propria de gestao de tenants.
export const SUPER_USUARIO_ROLE_NAME = 'Super Usuario';

// Nome fixo do tenant reservado para o(s) Super Usuario(s) da plataforma -
// nunca e um cliente real, nunca aparece na listagem de tenants exposta
// a ele mesmo (ver ListTenantsUseCase).
export const PLATAFORMA_TENANT_NOME = 'Plataforma';
