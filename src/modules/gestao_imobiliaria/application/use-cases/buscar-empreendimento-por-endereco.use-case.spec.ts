// src/modules/gestao_imobiliaria/application/use-cases/buscar-empreendimento-por-endereco.use-case.spec.ts
// Integracao VIVI (2026) - primeira cobertura de teste deste use case (nao
// havia nenhuma antes). Foca nos campos novos (diferenciais/provaSocial/
// statusObra/proximoMetro/plantao*) e no rename diferenciais -> descricao,
// alem do comportamento ja existente (empreendimento encontrado, imovel
// avulso encontrado, nao encontrado).
import { BuscarEmpreendimentoPorEnderecoUseCase } from './buscar-empreendimento-por-endereco.use-case';
import { EmpreendimentoRecord } from '../../domain/repositories/empreendimento-repository.interface';
import { ImovelRecord } from '../../domain/repositories/imovel-repository.interface';

function buildEmpreendimento(overrides: Partial<EmpreendimentoRecord> = {}): EmpreendimentoRecord {
  return {
    id: 'emp-1',
    tenantId: 'tenant-1',
    name: 'Residencial Jardim',
    rua: 'Avenida do Cursino',
    numero: '1355',
    bairro: 'Cursino',
    cidade: 'Sao Paulo',
    uf: 'SP',
    cep: '04132-000',
    description: 'Empreendimento na Zona Sul.',
    createdAt: new Date(),
    publicado: true,
    origemImportacao: null,
    areaTerreno: null,
    totalUnidades: null,
    numeroTorres: null,
    unidadesPorAndar: null,
    gabarito: null,
    vagas: null,
    itensLazer: [],
    proximoMetro: false,
    diferenciais: [],
    provaSocial: null,
    statusObra: null,
    plantaoEndereco: null,
    plantaoHorarioFuncionamento: null,
    plantaoCorretorResponsavel: null,
    plantaoWhatsappCorretor: null,
    ...overrides,
  };
}

function buildImovel(overrides: Partial<ImovelRecord> = {}): ImovelRecord {
  return {
    id: 'imovel-1',
    tenantId: 'tenant-1',
    empreendimentoId: null,
    title: 'Apartamento 2 dorms',
    codigoInterno: null,
    tipo: 'apartamento',
    uso: null,
    finalidade: 'venda',
    tags: null,
    price: 300000,
    rentPrice: null,
    area: null,
    bedrooms: 2,
    bathrooms: null,
    parkingSpots: null,
    rua: 'Rua das Flores',
    numero: '500',
    complemento: null,
    bairro: 'Centro',
    cidade: 'Sao Paulo',
    uf: 'SP',
    cep: null,
    description: 'Imovel avulso bem localizado.',
    status: 'disponivel',
    disponivelApartirDe: null,
    localChaves: null,
    exclusividade: false,
    proprietarioNome: null,
    proprietarioTelefone: null,
    tipoItem: 'unidade',
    identificadorExterno: null,
    bloco: null,
    andar: null,
    numeroNoAndar: null,
    enquadramento: 'nenhum',
    pcd: false,
    valorTabela: null,
    valorComDesconto: null,
    vagasIncluidas: 0,
    customFields: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    coverPhotoUrl: null,
    ...overrides,
  };
}

function setup() {
  const empreendimentoRepository = { findAllByTenant: jest.fn() };
  const imovelRepository = { findAllByTenant: jest.fn() };
  const useCase = new BuscarEmpreendimentoPorEnderecoUseCase(
    empreendimentoRepository as any,
    imovelRepository as any,
  );
  return { useCase, empreendimentoRepository, imovelRepository };
}

describe('BuscarEmpreendimentoPorEnderecoUseCase - campos novos da Integracao VIVI (2026)', () => {
  it('empreendimento encontrado com todos os campos novos preenchidos: retorna todos corretamente', async () => {
    const { useCase, empreendimentoRepository, imovelRepository } = setup();
    empreendimentoRepository.findAllByTenant.mockResolvedValue([
      buildEmpreendimento({
        proximoMetro: true,
        diferenciais: ['Piscina', 'Coworking', 'Pet place'],
        provaSocial: '42 unidades vendidas nos primeiros 30 dias',
        statusObra: 'em obras',
        plantaoEndereco: 'Av. Principal, 100',
        plantaoHorarioFuncionamento: 'Seg a Sab, 9h-18h',
        plantaoCorretorResponsavel: 'Joao Corretor',
        plantaoWhatsappCorretor: '5511999990000',
      }),
    ]);
    imovelRepository.findAllByTenant.mockResolvedValue([]);

    const resultado = await useCase.execute({ tenantId: 'tenant-1', enderecoBusca: 'Av. do Cursino, 1355' });

    expect(resultado.encontrado).toBe(true);
    expect(resultado.tipo).toBe('empreendimento');
    expect(resultado.descricao).toBe('Empreendimento na Zona Sul.');
    expect(resultado.diferenciais).toEqual(['Piscina', 'Coworking', 'Pet place']);
    expect(resultado.provaSocial).toBe('42 unidades vendidas nos primeiros 30 dias');
    expect(resultado.statusObra).toBe('em obras');
    expect(resultado.proximoMetro).toBe(true);
    expect(resultado.plantaoEndereco).toBe('Av. Principal, 100');
    expect(resultado.plantaoHorarioFuncionamento).toBe('Seg a Sab, 9h-18h');
    expect(resultado.plantaoCorretorResponsavel).toBe('Joao Corretor');
    expect(resultado.plantaoWhatsappCorretor).toBe('5511999990000');
  });

  it('empreendimento encontrado com campos novos nos defaults: diferenciais vira null (nao array vazio), demais ficam null/false', async () => {
    const { useCase, empreendimentoRepository, imovelRepository } = setup();
    empreendimentoRepository.findAllByTenant.mockResolvedValue([buildEmpreendimento()]);
    imovelRepository.findAllByTenant.mockResolvedValue([]);

    const resultado = await useCase.execute({ tenantId: 'tenant-1', enderecoBusca: 'Av. do Cursino, 1355' });

    expect(resultado.encontrado).toBe(true);
    expect(resultado.diferenciais).toBeNull();
    expect(resultado.provaSocial).toBeNull();
    expect(resultado.statusObra).toBeNull();
    expect(resultado.proximoMetro).toBe(false);
    expect(resultado.plantaoEndereco).toBeNull();
  });

  it('imovel avulso encontrado: campos novos ficam todos ausentes (null), sem inventar dado - so descricao vem do Imovel', async () => {
    const { useCase, empreendimentoRepository, imovelRepository } = setup();
    empreendimentoRepository.findAllByTenant.mockResolvedValue([]);
    imovelRepository.findAllByTenant.mockResolvedValue([buildImovel()]);

    const resultado = await useCase.execute({ tenantId: 'tenant-1', enderecoBusca: 'Rua das Flores, 500' });

    expect(resultado.encontrado).toBe(true);
    expect(resultado.tipo).toBe('imovel');
    expect(resultado.descricao).toBe('Imovel avulso bem localizado.');
    expect(resultado.diferenciais).toBeNull();
    expect(resultado.provaSocial).toBeNull();
    expect(resultado.statusObra).toBeNull();
    expect(resultado.proximoMetro).toBeNull();
    expect(resultado.plantaoEndereco).toBeNull();
    expect(resultado.plantaoHorarioFuncionamento).toBeNull();
    expect(resultado.plantaoCorretorResponsavel).toBeNull();
    expect(resultado.plantaoWhatsappCorretor).toBeNull();
  });

  it('nao encontrado em lugar nenhum: todos os campos (antigos e novos) ficam null', async () => {
    const { useCase, empreendimentoRepository, imovelRepository } = setup();
    empreendimentoRepository.findAllByTenant.mockResolvedValue([]);
    imovelRepository.findAllByTenant.mockResolvedValue([]);

    const resultado = await useCase.execute({ tenantId: 'tenant-1', enderecoBusca: 'Rua Inexistente, 999' });

    expect(resultado.encontrado).toBe(false);
    expect(resultado.diferenciais).toBeNull();
    expect(resultado.provaSocial).toBeNull();
    expect(resultado.statusObra).toBeNull();
    expect(resultado.proximoMetro).toBeNull();
    expect(resultado.plantaoEndereco).toBeNull();
  });
});
