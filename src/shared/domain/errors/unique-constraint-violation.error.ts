// src/shared/domain/errors/unique-constraint-violation.error.ts
// Erro de DOMINIO (sem Prisma/infra) que representa uma violacao de
// constraint/indice unico no banco. As implementacoes Prisma dos
// repositorios traduzem o erro P2002 para este tipo antes de propagar
// (ver *.repository.ts em infra/database) - assim a camada de aplicacao
// (use cases) nunca precisa importar nada do Prisma para reagir a uma
// corrida de criacao concorrente (ver CLAUDE.md, separacao de camadas).
//
// Usado hoje para tratar corridas entre mensagens concorrentes do mesmo
// lead no fluxo "buscar-ou-criar" de ViviConversation/Atendimento/Card de
// captura automatica (auditoria C2, 26/07/2026): ao capturar este erro, o
// use case busca de novo o registro que a mensagem concorrente ja criou,
// em vez de propagar a falha ou criar um duplicado.
export class UniqueConstraintViolationError extends Error {
  constructor(message = 'Unique constraint violation') {
    super(message);
    this.name = 'UniqueConstraintViolationError';
  }
}
