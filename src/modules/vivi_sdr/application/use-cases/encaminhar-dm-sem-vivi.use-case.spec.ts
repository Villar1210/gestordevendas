// Com a VIVI interna desligada, a 1a DM de um contato vira card na Caixa de
// Entrada (Roleta) - e so a primeira.
import { EncaminharDmSemViviUseCase } from './encaminhar-dm-sem-vivi.use-case';
import { Canal } from '../../../../shared/domain/enums/canal.enum';

function montar(opcoes: { ultima?: { id: string; status: string } | null; temDono?: boolean }) {
  const conversas = {
    findLatestByAccountAndExternalId: jest.fn().mockResolvedValue(opcoes.ultima ?? null),
    create: jest.fn().mockResolvedValue({ id: 'conv-nova', status: 'em_andamento' }),
    update: jest.fn().mockResolvedValue({}),
  };
  const pipelines = {
    findAllByTenant: jest.fn().mockResolvedValue([
      { id: 'p-rmk', name: 'Leads Nao Qualificados' },
      { id: 'p-vendas', name: 'Vendas' },
    ]),
  };
  const cards = { existsByTenantAndPhoneWithOwner: jest.fn().mockResolvedValue(opcoes.temDono ?? false) };
  const criarCard = { execute: jest.fn().mockResolvedValue({ id: 'card-1' }) };
  const useCase = new EncaminharDmSemViviUseCase(conversas as never, pipelines as never, cards as never, criarCard as never);
  return { useCase, conversas, criarCard };
}

const entrada = { tenantId: 't-1', canal: Canal.INSTAGRAM as const, socialAccountId: 'c-1', identificadorExterno: 'ig-123', mensagem: 'Oi, quero saber do apto' };

describe('EncaminharDmSemViviUseCase', () => {
  it('1a mensagem: cria card na Caixa de Entrada do funil de vendas (nao no remarketing) e marca a conversa', async () => {
    const { useCase, conversas, criarCard } = montar({});
    await expect(useCase.execute(entrada)).resolves.toBe('card-1');
    expect(criarCard.execute).toHaveBeenCalledWith(
      expect.objectContaining({ pipelineId: 'p-vendas', origem: 'instagram_dm', phone: 'ig-123', isSystemCall: true }),
    );
    expect(criarCard.execute.mock.calls[0][0].stageId).toBeUndefined();
    expect(conversas.update).toHaveBeenCalledWith('conv-nova', { status: 'qualificado_transferido' });
    expect(conversas.update).toHaveBeenCalledWith('conv-nova', { cardId: 'card-1' });
  });

  it('mensagens seguintes (conversa ja encaminhada) nao criam outro card', async () => {
    const { useCase, criarCard } = montar({ ultima: { id: 'conv-1', status: 'qualificado_transferido' } });
    await expect(useCase.execute(entrada)).resolves.toBeNull();
    expect(criarCard.execute).not.toHaveBeenCalled();
  });

  it('contato que ja tem card com corretor nao gera card novo', async () => {
    const { useCase, criarCard } = montar({ temDono: true });
    await expect(useCase.execute(entrada)).resolves.toBeNull();
    expect(criarCard.execute).not.toHaveBeenCalled();
  });
});
