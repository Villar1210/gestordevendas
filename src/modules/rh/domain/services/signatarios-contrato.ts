// src/modules/rh/domain/services/signatarios-contrato.ts
// Camada de DOMINIO: funcoes puras (sem NestJS/Prisma). Monta quem assina o
// contrato de prestacao de servico, na ordem do E-doc (destinatario ->
// remetente -> testemunhas), e valida a configuracao da empresa.
import { ContratoParceriaConfigDados } from '../repositories/contrato-parceria-config-repository.interface';

export type PapelSignatario = 'destinatario' | 'remetente' | 'testemunha';

export interface SignatarioContrato {
  name: string;
  email: string;
  role: PapelSignatario;
  // Texto do quadro na pagina de assinaturas do PDF.
  rotulo: string;
  detalhe: string | null;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function preenchido(valor: string | null | undefined): valor is string {
  return typeof valor === 'string' && valor.trim().length > 0;
}

// Retorna a mensagem de erro (para o Administrador corrigir) ou null.
export function validarContratoParceriaConfig(config: ContratoParceriaConfigDados): string | null {
  if (config.assinaturaEmpresaAtiva) {
    if (!preenchido(config.representanteNome)) return 'Informe o nome do representante da empresa.';
    if (!preenchido(config.representanteEmail) || !EMAIL_REGEX.test(config.representanteEmail.trim())) {
      return 'Informe um e-mail válido para o representante da empresa.';
    }
  }
  if (![0, 1, 2].includes(config.quantidadeTestemunhas)) {
    return 'A quantidade de testemunhas deve ser 0, 1 ou 2.';
  }
  const testemunhas = [
    [config.testemunha1Nome, config.testemunha1Email],
    [config.testemunha2Nome, config.testemunha2Email],
  ].slice(0, config.quantidadeTestemunhas);
  for (const [i, [nome, email]] of testemunhas.entries()) {
    if (!preenchido(nome)) return `Informe o nome da testemunha ${i + 1}.`;
    if (!preenchido(email) || !EMAIL_REGEX.test(email.trim())) {
      return `Informe um e-mail válido para a testemunha ${i + 1}.`;
    }
  }
  const emails = [
    config.assinaturaEmpresaAtiva ? config.representanteEmail : null,
    ...testemunhas.map(([, email]) => email),
  ]
    .filter(preenchido)
    .map((e) => e.trim().toLowerCase());
  if (new Set(emails).size !== emails.length) {
    return 'Representante e testemunhas precisam ter e-mails diferentes.';
  }
  if (!/^\s*\d{1,2}(\s*,\s*\d{1,2})*\s*$/.test(config.lembreteDias)) {
    return 'Dias de lembrete inválidos. Use números separados por vírgula, ex: 2,5.';
  }
  return null;
}

export function montarSignatariosContrato(
  config: ContratoParceriaConfigDados,
  contratado: { nome: string; email: string; documento: string | null },
  empresaNome: string,
): SignatarioContrato[] {
  const lista: SignatarioContrato[] = [
    {
      name: contratado.nome,
      email: contratado.email,
      role: 'destinatario',
      rotulo: 'CONTRATADO(A)',
      detalhe: contratado.documento,
    },
  ];
  const contratadoEmail = contratado.email.trim().toLowerCase();

  // Um signatario nunca repete o e-mail do contratado (o E-doc trataria como
  // a mesma pessoa) - pula em vez de falhar a geracao do contrato.
  const adicionar = (s: SignatarioContrato): void => {
    if (s.email.trim().toLowerCase() !== contratadoEmail) lista.push(s);
  };

  if (config.assinaturaEmpresaAtiva && preenchido(config.representanteNome) && preenchido(config.representanteEmail)) {
    adicionar({
      name: config.representanteNome.trim(),
      email: config.representanteEmail.trim(),
      role: 'remetente',
      rotulo: 'CONTRATANTE',
      detalhe: [empresaNome, config.representanteCargo?.trim()].filter(preenchido).join(' - ') || null,
    });
  }

  const testemunhas = [
    [config.testemunha1Nome, config.testemunha1Email],
    [config.testemunha2Nome, config.testemunha2Email],
  ].slice(0, Math.max(0, Math.min(2, config.quantidadeTestemunhas)));
  testemunhas.forEach(([nome, email], i) => {
    if (preenchido(nome) && preenchido(email)) {
      adicionar({ name: nome.trim(), email: email.trim(), role: 'testemunha', rotulo: `TESTEMUNHA ${i + 1}`, detalhe: null });
    }
  });

  return lista;
}
