// src/shared/infra/services/anthropic-conversation.service.ts
import { Injectable } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import {
  IAiConversationService,
  GenerateReplyInput,
  GenerateReplyOutput,
  AiToolCall,
  ConfirmarExistenciaEmpreendimentoResult,
  FichaTecnicaExtraidaIA,
  TipologiaExtraidaIA,
} from '../../domain/services/ai-conversation.interface';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;
// Protecao contra loop infinito caso o modelo encadeie tool_use indefinidamente.
const MAX_TOOL_ITERATIONS = 5;

// Modelo/tokens para a busca externa ISOLADA de confirmacao de
// empreendimento (ver confirmarExistenciaEmpreendimento) - mesmo modelo da
// conversa principal, resposta bem curta (so um JSON pequeno).
const WEB_CONFIRM_MAX_TOKENS = 512;

// Extracao da ficha tecnica (Fatia 3c, gestao_imobiliaria): resposta pode
// ter uma lista de tipologias + itens de lazer, por isso um limite maior
// que a confirmacao de existencia acima.
const FICHA_TECNICA_MAX_TOKENS = 2048;
// Protecao de custo/contexto: uma ficha tecnica comercial (PDF de
// apresentacao do produto) nao precisa de mais que isso para conter nome,
// endereco, memorial e a tabela de tipologias/lazer - corta o excedente
// (ex: anexos juridicos longos) em vez de mandar o PDF inteiro.
const FICHA_TECNICA_MAX_TEXTO_CHARS = 60000;

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
      'COMPRA/ALUGUEL que a VIVI nao pode responder (duvida especifica), quando a renda ' +
      'declarada do lead for classificada como SEM_PERFIL - abaixo de R$ 1.500 (sem_perfil, ' +
      'ver secao "Enquadramento por renda"), OU quando o lead demonstrar interesse especifico ' +
      'em um imovel/empreendimento/bairro que nao faz parte do portfolio configurado deste ' +
      'tenant (fora_do_portfolio - ver secao "Busca de empreendimento por endereco").',
    input_schema: {
      type: 'object',
      properties: {
        motivo: {
          type: 'string',
          enum: ['lead qualificado', 'duvida especifica', 'sem_perfil', 'fora_do_portfolio'],
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
  {
    name: 'buscar_empreendimento_por_endereco',
    description:
      'Busca no catalogo proprio (e, se nao encontrar, confirma externamente) um ' +
      'empreendimento/imovel especifico pelo endereco citado pelo lead (rua ou avenida + ' +
      'numero, e opcionalmente bairro). Chame IMEDIATAMENTE quando o lead perguntar sobre um ' +
      'empreendimento citando um endereco - nunca responda de memoria nem invente informacoes.',
    input_schema: {
      type: 'object',
      properties: {
        endereco: {
          type: 'string',
          description: 'Endereco exatamente como o lead escreveu (rua/avenida + numero, e bairro se mencionado)',
        },
        pularBuscaExterna: {
          type: 'boolean',
          description:
            'true quando a MESMA mensagem do lead tambem contiver um pedido de urgencia/falar ' +
            'com humano (ver secao "Atendimento urgente") - nesse caso, busca SO no catalogo ' +
            'proprio, sem busca externa/web, para nao atrasar a escalacao. Default false.',
        },
      },
      required: ['endereco'],
    },
  },
];

@Injectable()
export class AnthropicConversationService implements IAiConversationService {
  private readonly client: Anthropic;

  constructor() {
    // maxRetries: 2 (padrao do proprio SDK, deixado explicito de proposito -
    // ver auditoria de producao, Critico #1). O SDK ja distingue sozinho
    // erro transitorio de erro permanente: reprocessa automaticamente com
    // backoff exponencial em timeout de conexao, 408 (timeout de request),
    // 409 (lock), 429 (rate limit) e >=500 (erro interno da Anthropic); joga
    // a excecao pra cima IMEDIATAMENTE (sem gastar tentativa) em 400/401/403/
    // 404/422 - um prompt invalido vai falhar do mesmo jeito de novo, nao
    // adianta retry (ver node_modules/@anthropic-ai/sdk/client.js,
    // shouldRetry()). Depois de esgotar as tentativas, a excecao final
    // propaga normalmente daqui pra cima - generateReply() e as demais
    // chamadas deste service de proposito NAO tem try/catch ao redor de
    // messages.create() (excecao de confirmarExistenciaEmpreendimento, que
    // ja tratava falha como "nao confirmado" antes desta fatia) - quem
    // decide o que fazer com uma falha definitiva e o CHAMADOR
    // (ProcessIncomingMessageUseCase, modulo vivi_sdr, ver fallback ao lead
    // + roteamento para fila humana).
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
  }

  async generateReply(input: GenerateReplyInput): Promise<GenerateReplyOutput> {
    // Mitigacao de prompt injection (nao solucao perfeita - ver comentario no
    // system prompt em vivi-prompt.ts): delimita o texto cru do lead entre
    // tags XML, para reduzir a ambiguidade entre "instrucao do sistema" e
    // "dado enviado por um usuario externo". O system prompt instrui o
    // modelo a tratar tudo dentro dessas tags como dado, nunca como comando.
    // Isso NAO impede 100% dos casos (um modelo pode, em tese, ainda ser
    // manipulado por um texto suficientemente elaborado) - e so uma camada a
    // mais de defesa, nao um substituto para nao confiar cegamente na saida
    // do modelo em acoes sensiveis.
    const mensagemDelimitada = `<mensagem_do_lead>\n${input.userMessage}\n</mensagem_do_lead>`;

    const messages: Anthropic.MessageParam[] = [
      ...input.history.map((turn) => ({ role: turn.role, content: turn.content })),
      { role: 'user' as const, content: mensagemDelimitada },
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

      // O loop aqui cumpre o protocolo da API (todo tool_use precisa de um
      // tool_result de volta para o modelo continuar). Para a maioria das
      // tools (todas "de escrita" - salvar dados, transferir) um "ok"
      // generico basta, ja que a execucao real fica por conta de quem
      // chamou generateReply (usando o array toolCalls retornado abaixo).
      // Quando resolveTool e informado (ver buscar_empreendimento_por_endereco),
      // ele pode devolver um resultado REAL para a IA reagir na mesma
      // resposta (ex: preco de um empreendimento encontrado) - primeira
      // tool "de leitura" deste projeto.
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          toolCalls.push({
            name: block.name,
            input: block.input as Record<string, unknown>,
          });

          const toolInput = block.input as Record<string, unknown>;
          const resolvido = input.resolveTool ? await input.resolveTool(block.name, toolInput) : null;

          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: resolvido ?? 'ok',
          };
        }),
      );

      messages.push({ role: 'user', content: toolResults });
    }

    return { replyText, toolCalls };
  }

  // Busca web ISOLADA (fora do loop de tools da conversa principal) so para
  // confirmar se existe um empreendimento real no endereco informado -
  // usa o tool nativo "web_search" da propria API da Anthropic (sem
  // dependencia/API key de terceiros nova). max_uses limitado para conter
  // custo, ja que o objetivo e so uma confirmacao rapida de existencia.
  async confirmarExistenciaEmpreendimento(
    endereco: string,
  ): Promise<ConfirmarExistenciaEmpreendimentoResult> {
    const systemPrompt =
      'Voce esta verificando SOMENTE se existe um empreendimento imobiliario ' +
      '(condominio, residencial, edificio) real no endereco informado, usando busca na web ' +
      '(ex: site de construtoras, portais imobiliarios). Responda EXCLUSIVAMENTE com um JSON ' +
      'no formato exato {"confirmado": true ou false, "nome": "nome do empreendimento" ou null} ' +
      '- sem nenhum texto antes ou depois do JSON. NUNCA inclua preco, condicoes comerciais ou ' +
      'disponibilidade de unidades - o unico objetivo aqui e confirmar existencia.';

    try {
      const response = await this.client.messages.create({
        model: MODEL,
        max_tokens: WEB_CONFIRM_MAX_TOKENS,
        system: systemPrompt,
        messages: [{ role: 'user', content: `Endereco: ${endereco}` }],
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 2 }],
      });

      const textBlocks = response.content.filter(
        (block): block is Anthropic.TextBlock => block.type === 'text',
      );
      const textoFinal = textBlocks.map((block) => block.text).join('\n').trim();

      return this.parseConfirmacaoJson(textoFinal);
    } catch (err) {
      // Falha na busca externa (rede, API, parsing) nunca deve derrubar o
      // atendimento da VIVI - trata como "nao confirmado", mesmo padrao de
      // resiliencia ja usado em listeners deste projeto.
      return { confirmado: false, nomeEncontrado: null };
    }
  }

  private parseConfirmacaoJson(texto: string): ConfirmarExistenciaEmpreendimentoResult {
    try {
      const match = texto.match(/\{[\s\S]*\}/);
      const jsonTexto = match ? match[0] : texto;
      const parsed = JSON.parse(jsonTexto);
      return {
        confirmado: parsed.confirmado === true,
        nomeEncontrado: typeof parsed.nome === 'string' && parsed.nome.trim() ? parsed.nome.trim() : null,
      };
    } catch {
      return { confirmado: false, nomeEncontrado: null };
    }
  }

  // Extrai a ficha tecnica de um empreendimento do texto de um PDF de
  // apresentacao do produto (Fatia 3c). AO CONTRARIO de
  // confirmarExistenciaEmpreendimento, esta funcao NAO engole erros - se a
  // IA nao devolver um JSON valido, a excecao sobe para quem chamou tratar
  // (ImportarFichaTecnicaPdfUseCase), que deve reportar um erro claro ao
  // usuario em vez de preencher a ficha tecnica com dados inventados.
  async extrairFichaTecnicaEmpreendimento(textoPdf: string): Promise<FichaTecnicaExtraidaIA> {
    const textoTruncado = textoPdf.slice(0, FICHA_TECNICA_MAX_TEXTO_CHARS);

    const systemPrompt =
      'Voce esta extraindo a FICHA TECNICA de um empreendimento imobiliario a partir do texto ' +
      'de um PDF de apresentacao/folder comercial (memorial, diferenciais, ficha tecnica, ' +
      'plantas). Extraia SOMENTE o que estiver EXPLICITAMENTE escrito no texto - NUNCA estime, ' +
      'calcule ou invente um valor que nao esteja literalmente presente. Se um campo nao for ' +
      'encontrado, use null (ou lista vazia []) para ele - jamais um palpite. IGNORE ' +
      'completamente qualquer tabela de precos, valores de unidades especificas ou condicoes ' +
      'comerciais - esses dados NAO fazem parte desta ficha tecnica.\n\n' +
      'Responda EXCLUSIVAMENTE com um JSON no formato exato abaixo - sem nenhum texto antes ou ' +
      'depois do JSON, sem markdown, sem comentarios:\n' +
      '{\n' +
      '  "nome": string ou null (nome do empreendimento),\n' +
      '  "endereco": string ou null (endereco completo como aparece no texto),\n' +
      '  "descricao": string ou null (memorial/descricao/diferenciais, texto livre),\n' +
      '  "areaTerreno": numero ou null (area do terreno em m2, so o numero),\n' +
      '  "totalUnidades": numero ou null (total de unidades do empreendimento),\n' +
      '  "numeroTorres": numero ou null (quantidade de torres/blocos),\n' +
      '  "unidadesPorAndar": numero ou null,\n' +
      '  "gabarito": numero ou null (numero de pavimentos/andares),\n' +
      '  "vagas": numero ou null (total de vagas de garagem do empreendimento),\n' +
      '  "tipologias": [ { "nome": string, "areaPrivativa": numero ou null (m2), ' +
      '"dormitorios": numero ou null } ] (lista de plantas/tipos disponiveis, ex: ' +
      '"Garden Ponta 46,76m2" -> nome "Garden Ponta", areaPrivativa 46.76),\n' +
      '  "itensLazer": [string] (lista de itens de lazer/areas comuns, texto simples, ex: ' +
      '"Piscina adulto e infantil")\n' +
      '}';

    const response = await this.client.messages.create({
      model: MODEL,
      max_tokens: FICHA_TECNICA_MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Texto extraido do PDF:\n\n${textoTruncado}` }],
    });

    const textBlocks = response.content.filter(
      (block): block is Anthropic.TextBlock => block.type === 'text',
    );
    const textoFinal = textBlocks.map((block) => block.text).join('\n').trim();

    // Propositalmente SEM try/catch aqui - JSON invalido deve propagar para
    // o use case reportar o erro ao usuario (ver comentario no metodo acima).
    return this.parseFichaTecnicaJson(textoFinal);
  }

  private parseFichaTecnicaJson(texto: string): FichaTecnicaExtraidaIA {
    const match = texto.match(/\{[\s\S]*\}/);
    const jsonTexto = match ? match[0] : texto;
    const parsed = JSON.parse(jsonTexto);

    const numeroOuNull = (valor: unknown): number | null =>
      typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
    const textoOuNull = (valor: unknown): string | null =>
      typeof valor === 'string' && valor.trim() ? valor.trim() : null;

    const tipologias: TipologiaExtraidaIA[] = Array.isArray(parsed.tipologias)
      ? parsed.tipologias
          .filter((item: unknown): item is Record<string, unknown> => typeof item === 'object' && item !== null)
          .map((item: Record<string, unknown>) => ({
            nome: textoOuNull(item.nome) ?? '',
            areaPrivativa: numeroOuNull(item.areaPrivativa),
            dormitorios: numeroOuNull(item.dormitorios),
          }))
          .filter((tipologia: TipologiaExtraidaIA) => tipologia.nome !== '')
      : [];

    const itensLazer: string[] = Array.isArray(parsed.itensLazer)
      ? parsed.itensLazer.filter((item: unknown): item is string => typeof item === 'string' && item.trim() !== '')
      : [];

    return {
      nome: textoOuNull(parsed.nome),
      endereco: textoOuNull(parsed.endereco),
      descricao: textoOuNull(parsed.descricao),
      areaTerreno: numeroOuNull(parsed.areaTerreno),
      totalUnidades: numeroOuNull(parsed.totalUnidades),
      numeroTorres: numeroOuNull(parsed.numeroTorres),
      unidadesPorAndar: numeroOuNull(parsed.unidadesPorAndar),
      gabarito: numeroOuNull(parsed.gabarito),
      vagas: numeroOuNull(parsed.vagas),
      tipologias,
      itensLazer,
    };
  }
}
