// src/shared/infra/services/anthropic-conversation.service.ts
import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  IAiConversationService,
  GenerateReplyInput,
  GenerateReplyOutput,
  AiToolCall,
} from '../../domain/services/ai-conversation.interface';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;
// Protecao contra loop infinito caso o modelo encadeie tool_use indefinidamente.
const MAX_TOOL_ITERATIONS = 5;

// Tools da VIVI. O schema/descricao aqui e o mesmo em qualquer consumidor
// futuro desta interface - o SIGNIFICADO de negocio de cada tool (o que
// fazer quando "transferir_para_corretor" e chamada, por exemplo) fica no
// use case do modulo vivi_sdr, nao aqui.
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'salvar_dados_lead',
    description:
      'Registra uma nova informacao do lead assim que ela for extraida da conversa. ' +
      'Chame sempre que aprender um dado novo - pode ser chamada varias vezes ao ' +
      'longo da conversa, uma vez para cada informacao nova.',
    input_schema: {
      type: 'object',
      properties: {
        nome: { type: 'string', description: 'Nome do lead' },
        tipoImovel: {
          type: 'string',
          description: 'Tipo de imovel desejado (ex: apartamento, casa, terreno)',
        },
        orcamento: { type: 'string', description: 'Orcamento aproximado informado pelo lead' },
        regiao: { type: 'string', description: 'Regiao ou bairro de interesse' },
        finalidade: { type: 'string', description: 'Finalidade: comprar ou alugar' },
        rendaDeclarada: {
          type: 'number',
          description:
            'Renda familiar mensal aproximada declarada pelo lead, em reais (numero, sem simbolo de moeda, ex: 3500)',
        },
      },
    },
  },
  {
    name: 'transferir_para_corretor',
    description:
      'Encerra o atendimento da VIVI e cria um Card no Kanban para um corretor humano. ' +
      'Chame quando nome, tipo de imovel, orcamento, regiao e finalidade ja tiverem sido ' +
      'coletados (lead qualificado), quando o lead perguntar algo muito especifico sobre ' +
      'COMPRA/ALUGUEL que a VIVI nao pode responder (duvida especifica), OU quando a renda ' +
      'declarada do lead for classificada como SEM_PERFIL - abaixo de R$ 1.500 (sem_perfil, ' +
      'ver secao "Enquadramento por renda").',
    input_schema: {
      type: 'object',
      properties: {
        motivo: {
          type: 'string',
          enum: ['lead qualificado', 'duvida especifica', 'sem_perfil'],
          description: 'Motivo da transferencia',
        },
      },
      required: ['motivo'],
    },
  },
  {
    name: 'transferir_para_fila',
    description:
      'Encerra o atendimento da VIVI e encaminha a conversa para a Central de Atendimento ' +
      '(fila de suporte humano), quando a pergunta NAO e sobre qualificacao de compra/aluguel ' +
      'de imovel - e sim suporte, financeiro (boletos, pagamentos, cobranca) ou uma duvida ' +
      'generica que nao tem relacao com comprar/alugar um imovel novo.',
    input_schema: {
      type: 'object',
      properties: {
        categoria: {
          type: 'string',
          enum: ['suporte', 'financeiro', 'duvida_geral'],
          description: 'Categoria da fila de atendimento mais adequada',
        },
        resumo: {
          type: 'string',
          description: 'Breve resumo do que o lead perguntou, para o agente humano ter contexto',
        },
        urgente: {
          type: 'boolean',
          description:
            'true quando o lead pediu explicitamente para falar com uma pessoa/corretor humano ' +
            'AGORA (ex: "quero falar com uma pessoa", "me passa o telefone", "nao quero falar ' +
            'com robo", "urgente", "preciso agora"). Default false para os demais casos.',
        },
      },
      required: ['categoria', 'resumo'],
    },
  },
  {
    name: 'agendar_visita',
    description:
      'Confirma o agendamento de uma visita presencial com o lead - a meta principal de ' +
      'toda conversa da VIVI. Chame assim que o lead confirmar um dia e horario para a visita, ' +
      'mesmo que a qualificacao (nome/tipo de imovel/orcamento/regiao/finalidade) ainda nao ' +
      'esteja 100% completa.',
    input_schema: {
      type: 'object',
      properties: {
        dataVisita: {
          type: 'string',
          description: 'Data da visita confirmada pelo lead, no formato AAAA-MM-DD',
        },
        horario: {
          type: 'string',
          description:
            'Horario da visita confirmado pelo lead, da forma mais literal possivel ' +
            '(ex: "14:00", "de manha", "depois do almoco")',
        },
        imovelInteresse: {
          type: 'string',
          description: 'Nome/identificacao do imovel ou empreendimento de interesse, se mencionado',
        },
      },
      required: ['dataVisita', 'horario'],
    },
  },
  {
    name: 'salvar_dados_pos_visita',
    description:
      'Registra os dados coletados DEPOIS que uma visita ja foi confirmada (data de ' +
      'nascimento, e-mail, tipo de renda, declaracao de IR). NUNCA chame esta tool antes de ' +
      'ja ter confirmado uma visita com "agendar_visita" nesta mesma conversa - o sistema ' +
      'rejeita a chamada se nao houver visita agendada ainda.',
    input_schema: {
      type: 'object',
      properties: {
        dataNascimento: {
          type: 'string',
          description: 'Data de nascimento informada pelo lead, da forma mais literal possivel',
        },
        email: { type: 'string', description: 'Melhor e-mail informado pelo lead' },
        tipoRenda: {
          type: 'string',
          enum: ['CLT', 'AUTONOMO'],
          description: 'Tipo de renda: carteira assinada (CLT) ou autonomo',
        },
        fezDeclaracaoIR: {
          type: 'boolean',
          description:
            'So preencher se tipoRenda for AUTONOMO: true se o lead fez a Declaracao do ' +
            'Imposto de Renda este ano, false se comprova renda por extratos bancarios.',
        },
      },
    },
  },
];

@Injectable()
export class AnthropicConversationService implements IAiConversationService {
  private readonly client: Anthropic;

  constructor() {
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }

  async generateReply(input: GenerateReplyInput): Promise<GenerateReplyOutput> {
    const messages: Anthropic.MessageParam[] = [
      ...input.history.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: 'user' as const, content: input.userMessage },
    ];

    const toolCalls: AiToolCall[] = [];
    let replyText = '';

    for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: input.systemPrompt,
        messages,
        tools: TOOLS,
      });

      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use',
      );
      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text',
      );
      replyText = textBlocks.map((block) => block.text).join('\n');

      if (toolUseBlocks.length === 0 || response.stop_reason !== 'tool_use') {
        break;
      }

      messages.push({ role: 'assistant', content: response.content });

      // O loop aqui so cumpre o protocolo da API (todo tool_use precisa de
      // um tool_result de volta para o modelo continuar) - a execucao real
      // de cada tool (salvar dados, criar Card) fica por conta de quem
      // chamou generateReply, usando o array toolCalls retornado abaixo.
      const toolResults: Anthropic.ToolResultBlockParam[] = toolUseBlocks.map((block) => {
        toolCalls.push({
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
        return {
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: 'ok',
        };
      });

      messages.push({ role: 'user', content: toolResults });
    }

    return { replyText, toolCalls };
  }
}
