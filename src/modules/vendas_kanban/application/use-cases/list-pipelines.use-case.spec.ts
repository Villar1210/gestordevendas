// Restricao de visibilidade do funil de remarketing (captura automatica de
// lead minimo) - decisao do usuario: so Administrador/coordenador veem o
// pipeline "Leads Nao Qualificados" na lista (GET /pipelines), os demais
// papeis/cargos nao (nem no seletor "+ Novo Funil" do frontend, que
// consome esta lista sem filtro proprio).
import { ListPipelinesUseCase } from './list-pipelines.use-case';
import { IPipelineRepository } from '../../domain/repositories/pipeline-repository.interface';

function setup() {
  const pipelineRepository = { findAllByTenant: jest.fn() };
  const useCase = new ListPipelinesUseCase(pipelineRepository as unknown as IPipelineRepository);
  pipelineRepository.findAllByTenant.mockResolvedValue([
    { id: 'pipeline-vendas', tenantId: 'tenant-1', name: 'Vendas Imoveis', createdAt: new Date() },
    { id: 'pipeline-remarketing', tenantId: 'tenant-1', name: 'Leads Nao Qualificados', createdAt: new Date() },
  ]);
  return { useCase, pipelineRepository };
}

describe('ListPipelinesUseCase - restricao do funil de remarketing', () => {
  it('Administrador: ve os dois pipelines, incluindo o de remarketing', async () => {
    const { useCase } = setup();
    const pipelines = await useCase.execute({ tenantId: 'tenant-1', requesterRole: 'Administrador', requesterCargo: null });
    expect(pipelines.map((p) => p.name)).toEqual(['Vendas Imoveis', 'Leads Nao Qualificados']);
  });

  it('Corretor com cargo coordenador: ve os dois pipelines', async () => {
    const { useCase } = setup();
    const pipelines = await useCase.execute({ tenantId: 'tenant-1', requesterRole: 'Corretor', requesterCargo: 'coordenador' });
    expect(pipelines.map((p) => p.name)).toEqual(['Vendas Imoveis', 'Leads Nao Qualificados']);
  });

  it('Corretor comum (sem cargo coordenador): NAO ve o funil de remarketing', async () => {
    const { useCase } = setup();
    const pipelines = await useCase.execute({ tenantId: 'tenant-1', requesterRole: 'Corretor', requesterCargo: 'corretor' });
    expect(pipelines.map((p) => p.name)).toEqual(['Vendas Imoveis']);
  });

  it('sem requesterRole/requesterCargo informados (chamador antigo): filtra por padrao, mais restritivo', async () => {
    const { useCase } = setup();
    const pipelines = await useCase.execute({ tenantId: 'tenant-1' });
    expect(pipelines.map((p) => p.name)).toEqual(['Vendas Imoveis']);
  });
});
