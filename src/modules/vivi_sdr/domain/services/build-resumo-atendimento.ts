// src/modules/vivi_sdr/domain/services/build-resumo-atendimento.ts
// Camada de DOMINIO: funcao pura, sem Prisma/NestJS. Monta o resumo
// automatico gravado em Card.description (e tambem usado como corpo da
// Note de auditoria) sempre que a VIVI cria um Card - seja via
// transferir_para_corretor (lead qualificado/duvida especifica/sem_perfil)
// ou via agendar_visita. Formato: texto simples, legivel pelo corretor sem
// precisar abrir outra tela.
import { CategoriaHabitacional } from './classificar-renda';
import { TipoRenda } from '../repositories/vivi-conversation-repository.interface';

export interface ResumoAtendimentoInput {
  motivo: string;
  nome: string | null;
  phoneNumber: string;
  // Rotulo da linha de contato no resumo - default 'Telefone' preserva o
  // texto original (WhatsApp). A fatia de DM Instagram/Facebook passa
  // 'ID Instagram'/'ID Facebook' aqui, ja que phoneNumber carrega o
  // PSID/IGSID do lead nesse caso, nao um numero de telefone de verdade.
  contatoLabel?: string;
  tipoImovel: string | null;
  orcamento: string | null;
  rendaDeclarada: number | null;
  categoriaHabitacional: CategoriaHabitacional | null;
  regiao: string | null;
  finalidade: string | null;
  // Date quando ja persistida (conversation.visitaAgendadaEm, de um turno
  // anterior) - string quando ainda esta sendo agendada NESTE turno e so
  // temos o texto bruto (dataVisita+horario) extraido pela IA, antes do
  // parse/merge de horario acontecer dentro de AgendarVisitaUseCase.
  visitaAgendadaEm: Date | string | null;
  dataNascimento: string | null;
  email: string | null;
  tipoRenda: TipoRenda | null;
  fezDeclaracaoIR: boolean | null;
  urgente: boolean;
}

const dataHoraFormatter = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function buildResumoAtendimento(input: ResumoAtendimentoInput): string {
  const lines: string[] = [
    'Lead via VIVI (assistente de IA).',
    `Motivo: ${input.motivo}.`,
    `Nome: ${input.nome ?? 'nao informado'}`,
    `${input.contatoLabel ?? 'Telefone'}: ${input.phoneNumber}`,
    `Tipo de imovel: ${input.tipoImovel ?? 'nao informado'}`,
    `Orcamento: ${input.orcamento ?? 'nao informado'}`,
  ];

  if (input.rendaDeclarada !== null) {
    lines.push(`Renda declarada: R$ ${input.rendaDeclarada.toLocaleString('pt-BR')}`);
  }
  // Categoria habitacional (FAIXA_1/2/3/4/R2V, nomenclatura MCMV 2026 - ver
  // classificar-renda.ts) e informacao SO PARA USO INTERNO do corretor - a
  // VIVI nunca menciona esses nomes ao lead (ver vivi-prompt.ts), mas
  // aqui, na descricao do Card, e exatamente o publico certo para ve-la.
  if (input.categoriaHabitacional) {
    lines.push(`Categoria habitacional (interno): ${input.categoriaHabitacional}`);
  }

  lines.push(`Regiao: ${input.regiao ?? 'nao informado'}`);
  lines.push(`Finalidade: ${input.finalidade ?? 'nao informado'}`);

  if (input.visitaAgendadaEm instanceof Date) {
    lines.push(`Visita agendada: ${dataHoraFormatter.format(input.visitaAgendadaEm)}`);
  } else if (input.visitaAgendadaEm) {
    lines.push(`Visita agendada: ${input.visitaAgendadaEm}`);
  }
  if (input.dataNascimento) {
    lines.push(`Data de nascimento: ${input.dataNascimento}`);
  }
  if (input.email) {
    lines.push(`E-mail: ${input.email}`);
  }
  if (input.tipoRenda) {
    lines.push(`Tipo de renda: ${input.tipoRenda === 'CLT' ? 'CLT (carteira assinada)' : 'Autonomo'}`);
  }
  if (input.tipoRenda === 'AUTONOMO' && input.fezDeclaracaoIR !== null) {
    lines.push(`Fez declaracao de IR este ano: ${input.fezDeclaracaoIR ? 'sim' : 'nao'}`);
  }

  lines.push(`Urgente: ${input.urgente ? 'sim' : 'nao'}`);

  return lines.join('\n');
}
