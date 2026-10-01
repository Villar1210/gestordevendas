// src/modules/notificacoes/application/templates/novo-cadastro.email.ts
// E-mail ao Administrador quando chega um cadastro publico pendente.
// So leva nome, perfil e o link - nenhum dado pessoal (CPF, telefone,
// endereco) sai por e-mail; o resto o Administrador ve dentro da
// plataforma, ja logado.
import { montarEmailAvisoAdministrador } from './aviso-administrador.email';

export const PERFIL_LEGIVEL: Record<string, string> = {
  Cliente: 'Cliente',
  Corretor: 'Corretor (equipe própria)',
  'Corretor Parceiro': 'Corretor Parceiro',
  'Imobiliaria Parceira': 'Imobiliária Parceira',
};

export function assuntoComNome(prefixo: string, nome: string): string {
  return `${prefixo}: ${nome.replace(/\s+/g, ' ').trim().slice(0, 80)}`;
}

export function montarEmailNovoCadastro(input: {
  nomeAdministrador: string;
  nomeCadastro: string;
  roleName: string;
  link: string;
  urlPlataforma: string;
}): { subject: string; body: string } {
  const body = montarEmailAvisoAdministrador({
    nomeAdministrador: input.nomeAdministrador,
    titulo: 'Novo cadastro para analisar',
    introducao: 'Chegou um novo cadastro pelo site e ele está aguardando a sua análise:',
    linhas: [
      { rotulo: 'Nome', valor: input.nomeCadastro.trim() },
      { rotulo: 'Perfil', valor: PERFIL_LEGIVEL[input.roleName] ?? input.roleName },
    ],
    textoBotao: 'Analisar cadastro',
    link: input.link,
    urlPlataforma: input.urlPlataforma,
    rodape:
      'Os dados completos do cadastro ficam só dentro da plataforma, em RH → Aprovações. Você recebe este aviso por ser Administrador.',
  });
  return { subject: assuntoComNome('Novo cadastro para analisar', input.nomeCadastro), body };
}

export function montarEmailContratoAssinado(input: {
  nomeAdministrador: string;
  nomeContratado: string;
  roleName: string;
  link: string;
  urlPlataforma: string;
}): { subject: string; body: string } {
  const body = montarEmailAvisoAdministrador({
    nomeAdministrador: input.nomeAdministrador,
    titulo: 'Contrato de parceria assinado',
    introducao: 'Todas as assinaturas do contrato de prestação de serviço foram concluídas:',
    linhas: [
      { rotulo: 'Contratado', valor: input.nomeContratado.trim() },
      { rotulo: 'Perfil', valor: PERFIL_LEGIVEL[input.roleName] ?? input.roleName },
    ],
    textoBotao: 'Ver no RH',
    link: input.link,
    urlPlataforma: input.urlPlataforma,
    rodape: 'O documento assinado fica disponível no E-doc. Você recebe este aviso por ser Administrador.',
  });
  return { subject: assuntoComNome('Contrato assinado', input.nomeContratado), body };
}
