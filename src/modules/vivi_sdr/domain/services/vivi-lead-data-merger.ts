// src/modules/vivi_sdr/domain/services/vivi-lead-data-merger.ts
// Camada de DOMINIO: funcoes puras (sem Prisma/Nest/infra) que extraem e
// normalizam os dados coletados pela IA a partir das tool calls de um turno
// - movidas de dentro de ProcessIncomingMessageUseCase (I10 da auditoria,
// refactor estrutural puro, sem mudanca de comportamento) para reduzir o
// tamanho do use case sem introduzir I/O nesta camada.
import { ViviConversationUpdateInput } from '../repositories/vivi-conversation-repository.interface';
import { classificarRenda, FaixasRenda } from './classificar-renda';

interface ToolCallLike {
  name: string;
  input: Record<string, unknown>;
}

export function mergeCollectedData(
  toolCalls: ToolCallLike[],
  faixasRenda: FaixasRenda,
): ViviConversationUpdateInput {
  const collected: ViviConversationUpdateInput = {};

  for (const call of toolCalls) {
    if (call.name !== 'salvar_dados_lead') continue;

    const nome = call.input.nome;
    const tipoImovel = call.input.tipoImovel;
    const orcamento = call.input.orcamento;
    const regiao = call.input.regiao;
    const finalidade = call.input.finalidade;

    if (typeof nome === 'string' && nome.trim()) collected.nomeColetado = nome.trim();
    if (typeof tipoImovel === 'string' && tipoImovel.trim())
      collected.tipoImovelColetado = tipoImovel.trim();
    if (typeof orcamento === 'string' && orcamento.trim())
      collected.orcamentoColetado = orcamento.trim();
    if (typeof regiao === 'string' && regiao.trim()) collected.regiaoColetado = regiao.trim();
    if (typeof finalidade === 'string' && finalidade.trim())
      collected.finalidadeColetado = finalidade.trim();

    // Classificacao SEMPRE em codigo puro (classificarRenda), nunca
    // decidida pela IA - a IA so extrai o numero da conversa. Aceita
    // tanto number (o schema da tool pede number) quanto string (defesa
    // contra o modelo mandar "3500" como texto).
    const renda = parseRenda(call.input.rendaDeclarada);
    if (renda !== null) {
      collected.rendaDeclarada = renda;
      collected.categoriaHabitacional = classificarRenda(renda, faixasRenda);
    }
  }

  return collected;
}

export function applyPostVisitaData(
  updates: ViviConversationUpdateInput,
  call: ToolCallLike,
): void {
  const dataNascimento = call.input.dataNascimento;
  const email = call.input.email;
  const tipoRenda = call.input.tipoRenda;
  const fezDeclaracaoIR = call.input.fezDeclaracaoIR;

  if (typeof dataNascimento === 'string' && dataNascimento.trim())
    updates.dataNascimento = dataNascimento.trim();
  if (typeof email === 'string' && email.trim()) updates.email = email.trim();
  if (tipoRenda === 'CLT' || tipoRenda === 'AUTONOMO') updates.tipoRenda = tipoRenda;
  // So faz sentido preencher fezDeclaracaoIR quando tipoRenda e AUTONOMO
  // (ver vivi-prompt.ts, Passo 3 do loop de captura) - mas nao bloqueamos
  // aqui se a IA mandar fora de ordem, so aceitamos o boolean como veio.
  if (typeof fezDeclaracaoIR === 'boolean') updates.fezDeclaracaoIR = fezDeclaracaoIR;
}

export function parseRenda(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/[^\d.,-]/g, '').replace(',', '.'));
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
