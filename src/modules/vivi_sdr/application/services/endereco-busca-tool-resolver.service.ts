// src/modules/vivi_sdr/application/services/endereco-busca-tool-resolver.service.ts
// Extraido de ProcessIncomingMessageUseCase (I10 da auditoria, refactor
// estrutural puro - comportamento inalterado). Resolve a tool
// "buscar_empreendimento_por_endereco" chamada pela IA durante generateReply
// (ver AnthropicConversationService, parametro resolveTool) e persiste o log
// de cada busca depois que o orquestrador ja sabe se a resposta inteira
// escalou para corretor/fila (ver ProcessIncomingMessageUseCase.execute()).
import { Injectable, Inject } from '@nestjs/common';
import { IAiConversationService } from '../../../../shared/domain/services/ai-conversation.interface';
import {
  BuscarEmpreendimentoPorEnderecoUseCase,
  BuscaEmpreendimentoResultado,
} from '../../../gestao_imobiliaria/application/use-cases/buscar-empreendimento-por-endereco.use-case';
import { IEnderecoBuscaLogRepository } from '../../domain/repositories/endereco-busca-log-repository.interface';

// Resultado de UMA chamada da tool "buscar_empreendimento_por_endereco" -
// coletado durante resolveTool e so gravado no EnderecoBuscaLog depois, via
// persistirLogs, quando ja sabemos se a mesma resposta tambem escalou para
// corretor/fila.
export interface EnderecoBuscaResultado {
  enderecoBuscado: string;
  encontradoCatalogo: boolean;
  nomeEncontradoCatalogo: string | null;
  precisouBuscaExterna: boolean;
  confirmadoExternamente: boolean | null;
  nomeEncontradoExterno: string | null;
}

@Injectable()
export class EnderecoBuscaToolResolverService {
  constructor(
    @Inject('IAiConversationService')
    private readonly aiConversationService: IAiConversationService,
    private readonly buscarEmpreendimentoPorEnderecoUseCase: BuscarEmpreendimentoPorEnderecoUseCase,
    @Inject('IEnderecoBuscaLogRepository')
    private readonly enderecoBuscaLogRepository: IEnderecoBuscaLogRepository,
  ) {}

  // Chamado pelo AnthropicConversationService (parametro resolveTool de
  // generateReply) para CADA tool_use da resposta - so
  // "buscar_empreendimento_por_endereco" tem um resultado real (as demais
  // tools continuam recebendo o "ok" generico, ver retorno null). Empilha
  // o resultado estruturado em `resultados` para o log ser gravado depois
  // (ver persistirLogs), ja com a informacao de escalonamento da resposta
  // inteira.
  async resolveTool(
    toolName: string,
    toolInput: Record<string, unknown>,
    tenantId: string,
    resultados: EnderecoBuscaResultado[],
  ): Promise<string | null> {
    if (toolName !== 'buscar_empreendimento_por_endereco') {
      return null;
    }

    const endereco = typeof toolInput.endereco === 'string' ? toolInput.endereco.trim() : '';
    if (!endereco) {
      return 'NAO FOI POSSIVEL PROCESSAR A BUSCA: endereco nao informado.';
    }
    const pularBuscaExterna = toolInput.pularBuscaExterna === true;

    const resultadoCatalogo = await this.buscarEmpreendimentoPorEnderecoUseCase.execute({
      tenantId,
      enderecoBusca: endereco,
    });

    if (resultadoCatalogo.encontrado) {
      resultados.push({
        enderecoBuscado: endereco,
        encontradoCatalogo: true,
        nomeEncontradoCatalogo: resultadoCatalogo.nome,
        precisouBuscaExterna: false,
        confirmadoExternamente: null,
        nomeEncontradoExterno: null,
      });
      return this.formatCatalogoEncontrado(resultadoCatalogo);
    }

    // Escalonamento urgente na mesma mensagem (ver secao "Atendimento
    // urgente" do prompt) - so busca no catalogo proprio, sem busca externa,
    // pra nao atrasar a transferencia para a fila/corretor humano.
    if (pularBuscaExterna) {
      resultados.push({
        enderecoBuscado: endereco,
        encontradoCatalogo: false,
        nomeEncontradoCatalogo: null,
        precisouBuscaExterna: false,
        confirmadoExternamente: null,
        nomeEncontradoExterno: null,
      });
      return (
        'NAO ENCONTRADO NO CATALOGO PROPRIO. Busca externa NAO realizada ' +
        '(escalonamento urgente tem prioridade) - o corretor humano vai verificar esse endereco.'
      );
    }

    const confirmacao = await this.aiConversationService.confirmarExistenciaEmpreendimento(endereco);
    resultados.push({
      enderecoBuscado: endereco,
      encontradoCatalogo: false,
      nomeEncontradoCatalogo: null,
      precisouBuscaExterna: true,
      confirmadoExternamente: confirmacao.confirmado,
      nomeEncontradoExterno: confirmacao.nomeEncontrado,
    });

    if (confirmacao.confirmado) {
      const nomeTexto = confirmacao.nomeEncontrado
        ? `um empreendimento chamado "${confirmacao.nomeEncontrado}"`
        : 'algum empreendimento/imovel';
      return (
        'NAO ENCONTRADO NO CATALOGO PROPRIO.\n' +
        `BUSCA EXTERNA: confirmado que existe ${nomeTexto} nesse endereco ` +
        '(fonte externa - NAO mencionar preco/condicoes/disponibilidade dessa fonte).'
      );
    }

    return (
      'NAO ENCONTRADO NO CATALOGO PROPRIO.\n' +
      'BUSCA EXTERNA: NAO foi possivel confirmar a existencia de nenhum empreendimento nesse endereco.'
    );
  }

  // Escalonamento e propriedade da RESPOSTA inteira, nao de cada busca
  // individual - se o modelo chamou buscar_empreendimento_por_endereco e (na
  // mesma resposta) transferir_para_fila/transferir_para_corretor, TODAS as
  // buscas desta resposta sao registradas com o mesmo motivo. Por isso
  // escalonado/motivoEscalonamento sao calculados pelo orquestrador
  // (ProcessIncomingMessageUseCase, que conhece todas as tools chamadas no
  // turno) e so passados aqui no momento de persistir.
  async persistirLogs(
    tenantId: string,
    phoneNumber: string,
    resultados: EnderecoBuscaResultado[],
    escalonado: boolean,
    motivoEscalonamento: string | null,
  ): Promise<void> {
    for (const resultado of resultados) {
      await this.enderecoBuscaLogRepository.create({
        tenantId,
        phoneNumber,
        ...resultado,
        escalonado,
        motivoEscalonamento,
      });
    }
  }

  private formatCatalogoEncontrado(resultado: BuscaEmpreendimentoResultado): string {
    const precoTexto =
      resultado.precoDesde !== null
        ? `R$ ${resultado.precoDesde.toLocaleString('pt-BR')}`
        : 'nao informado';

    const linhas = [
      'ENCONTRADO NO CATALOGO PROPRIO.',
      `Nome: ${resultado.nome ?? 'nao informado'}`,
      `Diferenciais: ${resultado.diferenciais ?? 'nao informado'}`,
      `Status: ${resultado.statusResumo ?? 'nao informado'}`,
      resultado.tipo === 'empreendimento' ? `Unidades disponiveis: ${resultado.unidadesDisponiveis ?? 0}` : null,
      `Preco a partir de: ${precoTexto}`,
    ];

    return linhas.filter((linha): linha is string => linha !== null).join('\n');
  }
}
