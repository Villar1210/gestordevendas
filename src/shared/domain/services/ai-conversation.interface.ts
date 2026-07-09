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

export interface GenerateReplyInput {
  systemPrompt: string;
  history: AiConversationTurn[];
  userMessage: string;
}

export interface GenerateReplyOutput {
  replyText: string;
  toolCalls: AiToolCall[];
}

export interface IAiConversationService {
  generateReply(input: GenerateReplyInput): Promise<GenerateReplyOutput>;
}
