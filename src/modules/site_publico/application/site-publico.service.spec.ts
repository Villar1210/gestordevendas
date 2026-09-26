import { NotFoundException } from '@nestjs/common';
import { SitePublicoService, normalizarDominio } from './site-publico.service';
import { ISitePublicoRepository } from '../domain/site-publico-repository.interface';

describe('site publico', () => {
  const tenant = { id: 't1', slug: 'direcional', nome: 'Direcional' };
  let repo: jest.Mocked<ISitePublicoRepository>;
  let createQuickCard: { execute: jest.Mock };
  let service: SitePublicoService;

  beforeEach(() => {
    repo = {
      findTenantBySlug: jest.fn().mockResolvedValue(tenant),
      findTenantByDominio: jest.fn().mockResolvedValue(tenant),
      listarImoveis: jest.fn(),
      obterImovel: jest.fn().mockResolvedValue(null),
      listarEmpreendimentos: jest.fn(),
      obterEmpreendimento: jest.fn().mockResolvedValue(null),
      findPipelinePrincipalId: jest.fn().mockResolvedValue('p1'),
    };
    createQuickCard = { execute: jest.fn().mockResolvedValue({}) };
    service = new SitePublicoService(repo, createQuickCard as never);
  });

  it('normaliza dominio com protocolo, www, porta e caminho', () => {
    expect(normalizarDominio('https://WWW.Imoveis.Exemplo.com.br:443/x/y')).toBe('imoveis.exemplo.com.br');
  });

  it('slug invalido nem consulta o banco', async () => {
    await expect(service.info('../etc')).rejects.toBeInstanceOf(NotFoundException);
    expect(repo.findTenantBySlug).not.toHaveBeenCalled();
  });

  it('lead valido vira card na Caixa de Entrada com origem site e telefone so com digitos', async () => {
    await service.registrarLead('direcional', { nome: ' Maria ', telefone: '(11) 98888-7777', mensagem: 'Oi' });
    expect(createQuickCard.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        pipelineId: 'p1',
        isSystemCall: true,
        origem: 'site',
        phone: '11988887777',
        title: 'Site: Maria',
      }),
    );
    const arg = createQuickCard.execute.mock.calls[0][0];
    expect(arg.stageId).toBeUndefined();
  });

  it('armadilha anti-robo descarta sem criar card, mas responde recebido', async () => {
    await expect(
      service.registrarLead('direcional', { nome: 'Bot', telefone: '11988887777', website: 'x' }),
    ).resolves.toEqual({ recebido: true });
    expect(createQuickCard.execute).not.toHaveBeenCalled();
  });

  it('nao vincula imovel que nao esta publicado no site da empresa', async () => {
    await service.registrarLead('direcional', {
      nome: 'Ana',
      telefone: '11988887777',
      imovelId: 'de-outra-empresa',
    });
    expect(repo.obterImovel).toHaveBeenCalledWith('t1', 'de-outra-empresa');
    expect(createQuickCard.execute.mock.calls[0][0].imovelId).toBeUndefined();
  });
});
