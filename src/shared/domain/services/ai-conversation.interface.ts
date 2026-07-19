// src/shared/domain/services/ai-conversation.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Anthropic, OpenAI, etc.

export interface AiConversationTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiToolCall {
  name: string;
  input: Record<string, unknown>;
}

// Callback opcional: quando informado, o resultado de CADA tool_use e
// resolvido chamando esta funcao (nome + input da tool) - se ela retornar
// uma string, essa string vira o tool_result de VERDADE (permitindo a IA
// reagir a dados reais, ex: preco de um empreendimento encontrado no
// catalogo); se retornar null, mantem o comportamento generico ("ok") ja
// usado por todas as tools "de escrita" (salvar_dados_lead,
// transferir_para_corretor etc.) - nenhuma delas precisa de um resultado
// real, so uma confirmacao de que o backend recebeu a chamada.
export type ToolResolver = (
  toolName: string,
  input: Record<string, unknown>,
) => Promise<string | null>;

export interface GenerateReplyInput {
  systemPrompt: string;
  history: AiConversationTurn[];
  userMessage: string;
  resolveTool?: ToolResolver;
}

export interface GenerateReplyOutput {
  replyText: string;
  toolCalls: AiToolCall[];
}

export interface ConfirmarExistenciaEmpreendimentoResult {
  confirmado: boolean;
  nomeEncontrado: string | null;
}

export interface IAiConversationService {
  generateReply(input: GenerateReplyInput): Promise<GenerateReplyOutput>;
  // Busca web ISOLADA (fora do loop principal de tools/conversa) so para
  // confirmar se existe um empreendimento real no endereco informado -
  // usada pelo fallback da tool "buscar_empreendimento_por_endereco"
  // quando o catalogo proprio nao encontra nada. NUNCA retorna preco ou
  // condicoes comerciais, so existencia + nome (ver CLAUDE.md).
  confirmarExistenciaEmpreendimento(endereco: string): Promise<ConfirmarExistenciaEmpreendimentoResult>;
}
