// src/modules/vivi_sdr/application/services/endereco-busca-tool-resolver.service.spec.ts
// Integracao VIVI (2026) - primeira cobertura de teste deste service (nao
// havia nenhuma antes). Foca no texto formatado devolvido ao modelo quando
// o empreendimento e encontrado no catalogo proprio: linhas condicionais
// dos campos novos (diferenciais/provaSocial/statusObra/proximoMetro/
// plantao*) presentes quando preenchidos, omitidas quando vazios.
import { EnderecoBuscaToolResolverService, EnderecoBuscaResultado } from './endereco-busca-tool-resolver.service';
import { BuscaEmpreendimentoResultado } from '../../../gestao_imobiliaria/application/use-cases/buscar-empreendimento-por-endereco.use-case';

function buildResultadoEncontrado(overrides: Partial<BuscaEmpreendimentoResultado> = {}): BuscaEmpreendimentoResultado {
  return {
    encontrado: true,
    tipo: 'empreendimento',
    empreendimentoId: 'emp-1',
    nome: 'Residencial Jardim',
    descricao: 'Empreendimento na Zona Sul.',
    diferenciais: null,
    provaSocial: null,
    statusObra: null,
    proximoMetro: null,
    plantaoEndereco: null,
    plantaoHorarioFuncionamento: null,
    plantaoCorretorResponsavel: null,
    plantaoWhatsappCorretor: null,
    unidadesDisponiveis: 3,
    precoDesde: 300000,
    statusResumo: '3 unidade(s) disponivel(is)',
    ...overrides,
  };
}

function setup() {
  const aiConversationService = { confirmarExistenciaEmpreendimento: jest.fn() };
  const buscarEmpreendimentoPorEnderecoUseCase = { execute: jest.fn() };
  const enderecoBuscaLogRepository = { create: jest.fn() };
  const service = new EnderecoBuscaToolResolverService(
    aiConversationService as any,
    buscarEmpreendimentoPorEnderecoUseCase as any,
    enderecoBuscaLogRepository as any,
  );
  return { service, buscarEmpreendimentoPorEnderecoUseCase };
}

describe('EnderecoBuscaToolResolverService - linhas condicionais dos campos novos (Integracao VIVI 2026)', () => {
  it('todos os campos novos preenchidos: texto inclui todas as linhas, formatadas corretamente', async () => {
    const { service, buscarEmpreendimentoPorEnderecoUseCase } = setup();
    buscarEmpreendimentoPorEnderecoUseCase.execute.mockResolvedValue(
      buildResultadoEncontrado({
        diferenciais: ['Piscina', 'Coworking', 'Pet place'],
        provaSocial: '42 unidades vendidas nos primeiros 30 dias',
        statusObra: 'em obras',
        proximoMetro: true,
        plantaoEndereco: 'Av. Principal, 100',
        plantaoHorarioFuncionamento: 'Seg a Sab, 9h-18h',
        plantaoCorretorResponsavel: 'Joao Corretor',
        plantaoWhatsappCorretor: '5511999990000',
      }),
    );
    const resultados: EnderecoBuscaResultado[] = [];

    const texto = await service.resolveTool(
      'buscar_empreendimento_por_endereco',
      { endereco: 'Av. do Cursino, 1355' },
      'tenant-1',
      resultados,
    );

    expect(texto).toContain('Descricao: Empreendimento na Zona Sul.');
    expect(texto).toContain('Diferenciais: Piscina; Coworking; Pet place');
    expect(texto).toContain('Prova social: 42 unidades vendidas nos primeiros 30 dias');
    expect(texto).toContain('Status da obra: em obras');
    expect(texto).toContain('Proximo ao metro: sim');
    expect(texto).toContain('Plantao: Av. Principal, 100 - Seg a Sab, 9h-18h - Joao Corretor - 5511999990000');
  });

  it('campos novos todos vazios/nulos/false: nenhuma das linhas condicionais aparece no texto', async () => {
    const { service, buscarEmpreendimentoPorEnderecoUseCase } = setup();
    buscarEmpreendimentoPorEnderecoUseCase.execute.mockResolvedValue(buildResultadoEncontrado());
    const resultados: EnderecoBuscaResultado[] = [];

    const texto = await service.resolveTool(
      'buscar_empreendimento_por_endereco',
      { endereco: 'Av. do Cursino, 1355' },
      'tenant-1',
      resultados,
    );

    expect(texto).not.toContain('Diferenciais:');
    expect(texto).not.toContain('Prova social:');
    expect(texto).not.toContain('Status da obra:');
    expect(texto).not.toContain('Proximo ao metro:');
    expect(texto).not.toContain('Plantao:');
    // Confirma que o restante do texto (ja existente antes desta fatia)
    // continua presente e correto.
    expect(texto).toContain('ENCONTRADO NO CATALOGO PROPRIO.');
    expect(texto).toContain('Nome: Residencial Jardim');
    expect(texto).toContain('Descricao: Empreendimento na Zona Sul.');
    expect(texto).toContain('Unidades disponiveis: 3');
    expect(texto).toContain('Preco a partir de: R$ 300.000');
  });

  it('proximoMetro=false (nao null): a linha "Proximo ao metro" fica omitida, nao mostra "nao"', async () => {
    const { service, buscarEmpreendimentoPorEnderecoUseCase } = setup();
    buscarEmpreendimentoPorEnderecoUseCase.execute.mockResolvedValue(
      buildResultadoEncontrado({ proximoMetro: false }),
    );
    const resultados: EnderecoBuscaResultado[] = [];

    const texto = await service.resolveTool(
      'buscar_empreendimento_por_endereco',
      { endereco: 'Av. do Cursino, 1355' },
      'tenant-1',
      resultados,
    );

    expect(texto).not.toContain('Proximo ao metro');
  });

  it('plantao parcialmente preenchido (so endereco e whatsapp): junta so as partes presentes', async () => {
    const { service, buscarEmpreendimentoPorEnderecoUseCase } = setup();
    buscarEmpreendimentoPorEnderecoUseCase.execute.mockResolvedValue(
      buildResultadoEncontrado({
        plantaoEndereco: 'Av. Principal, 100',
        plantaoWhatsappCorretor: '5511999990000',
      }),
    );
    const resultados: EnderecoBuscaResultado[] = [];

    const texto = await service.resolveTool(
      'buscar_empreendimento_por_endereco',
      { endereco: 'Av. do Cursino, 1355' },
      'tenant-1',
      resultados,
    );

    expect(texto).toContain('Plantao: Av. Principal, 100 - 5511999990000');
  });
});
