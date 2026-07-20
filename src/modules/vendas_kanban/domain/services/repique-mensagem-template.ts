// src/modules/vendas_kanban/domain/services/repique-mensagem-template.ts
// Camada de DOMINIO: funcao pura, sem Prisma/NestJS. Conteudo das
// mensagens de campanha do Repique, diferenciado por motivoRepique -
// deliberadamente simples nesta fatia (texto fixo por motivo, so o nome
// do lead como personalizacao), ajustavel depois (ver PROGRESS.md).
// Todo template de EMAIL inclui o link de descadastro; todo template de
// WHATSAPP inclui a instrucao "responda SAIR" - exigencia de LGPD, nunca
// omitir em nenhum motivo.
import { Canal } from '../../../../shared/domain/enums/canal.enum';

export interface RepiqueMensagemInput {
  motivoRepique: string | null;
  canal: Canal;
  nomeLead: string;
  // Link publico completo (ja montado com o token) - so usado no EMAIL.
  linkDescadastro: string;
}

export interface RepiqueMensagemOutput {
  assunto?: string;
  corpo: string;
}

const TEXTOS_POR_MOTIVO: Record<string, string> = {
  PRECO:
    'Sabemos que o valor pesou na sua decisao da ultima vez - por isso queremos avisar que ' +
    'temos novas condicoes e promocoes disponiveis agora, que podem caber melhor no seu ' +
    'orcamento. Vale a pena dar uma nova olhada!',
  RESTRICAO_CPF:
    'Entendemos que restricoes no CPF podem complicar o financiamento - mas isso nao ' +
    'significa que a casa propria esta fora de alcance. Temos parceiros com alternativas de ' +
    'financiamento que podem ajudar. Vamos conversar de novo?',
  SEM_RESPOSTA_90_DIAS:
    'Faz um tempo que nao conversamos! Continuamos com otimas opcoes de imoveis que podem ' +
    'combinar com o que voce procurava. Que tal retomar nossa conversa?',
  SEM_PERFIL:
    'Muita coisa pode ter mudado desde a ultima vez que conversamos - novas condicoes de ' +
    'financiamento surgem o tempo todo. Vale a pena revisitar essa possibilidade com a gente.',
  OUTRO:
    'Faz um tempo que nao conversamos! Continuamos por aqui, com otimas opcoes de imoveis. ' +
    'Que tal retomar nossa conversa?',
};

function textoBaseParaMotivo(motivoRepique: string | null): string {
  if (motivoRepique && TEXTOS_POR_MOTIVO[motivoRepique]) {
    return TEXTOS_POR_MOTIVO[motivoRepique];
  }
  return TEXTOS_POR_MOTIVO.OUTRO;
}

export function buildRepiqueMensagem(input: RepiqueMensagemInput): RepiqueMensagemOutput {
  const textoBase = textoBaseParaMotivo(input.motivoRepique);
  const saudacao = `Ola, ${input.nomeLead}!`;

  if (input.canal === Canal.EMAIL) {
    return {
      assunto: 'Ainda temos uma oportunidade para voce',
      corpo:
        `<p>${saudacao}</p>` +
        `<p>${textoBase}</p>` +
        `<p>Se preferir nao receber mais esse tipo de comunicacao, ` +
        `<a href="${input.linkDescadastro}">clique aqui para se descadastrar</a>.</p>`,
    };
  }

  return {
    corpo: `${saudacao} ${textoBase}\n\nPara nao receber mais essas mensagens, responda SAIR.`,
  };
}
