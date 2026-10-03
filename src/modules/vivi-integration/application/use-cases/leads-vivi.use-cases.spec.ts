import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LeadsViviUseCases } from './leads-vivi.use-cases';

function montar(card: Record<string, unknown> | null = { id: 'c1', ownerId: 'u1', phone: '5511999998888', origem: 'roleta_online' }) {
  const repo = {
    listar: jest.fn().mockResolvedValue([]),
    findCard: jest.fn().mockResolvedValue(card),
    nomeUsuario: jest.fn().mockResolvedValue('Ana'),
    registrarContatoWhatsapp: jest.fn().mockResolvedValue(new Date('2026-10-03T12:00:00Z')),
  };
  const chatwoot = { historicoPorTelefone: jest.fn().mockResolvedValue({ encontrado: true, conversaUrl: 'x', status: 'open', mensagens: [] }) };
  return { uc: new LeadsViviUseCases(repo as any, chatwoot as any), repo, chatwoot };
}

const corretor = { tenantId: 't1', userId: 'u1', role: 'Corretor', cargo: 'corretor' };
const outro = { ...corretor, userId: 'u2' };
const admin = { tenantId: 't1', userId: 'adm', role: 'Administrador', cargo: null };
const gerente = { ...corretor, userId: 'g1', cargo: 'gerente' };

describe('LeadsViviUseCases', () => {
  it('corretor so lista os proprios leads (ignora filtro de corretor)', async () => {
    const { uc, repo } = montar();
    const r = await uc.listar(corretor, 'u9');
    expect(repo.listar).toHaveBeenCalledWith({ tenantId: 't1', ownerId: 'u1', limite: 200 });
    expect(r.veTodos).toBe(false);
  });

  it('administrador lista todos ou filtra por corretor', async () => {
    const { uc, repo } = montar();
    expect((await uc.listar(admin)).veTodos).toBe(true);
    expect(repo.listar).toHaveBeenLastCalledWith({ tenantId: 't1', ownerId: null, limite: 200 });
    await uc.listar(admin, 'u9');
    expect(repo.listar).toHaveBeenLastCalledWith({ tenantId: 't1', ownerId: 'u9', limite: 200 });
  });

  it('gerente (escopo equipe) ve so os proprios por enquanto', async () => {
    const { uc, repo } = montar();
    await uc.listar(gerente);
    expect(repo.listar).toHaveBeenLastCalledWith({ tenantId: 't1', ownerId: 'g1', limite: 200 });
  });

  it('conversa: dono le; outro corretor nao; lead que nao e da VIVI nao existe', async () => {
    const { uc, chatwoot } = montar();
    await expect(uc.conversa(corretor, 'c1')).resolves.toMatchObject({ encontrado: true });
    expect(chatwoot.historicoPorTelefone).toHaveBeenCalledWith('5511999998888');
    await expect(uc.conversa(outro, 'c1')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(uc.conversa(admin, 'c1')).resolves.toMatchObject({ encontrado: true });
    const naoVivi = montar({ id: 'c2', ownerId: 'u1', phone: '1', origem: 'manual' });
    await expect(naoVivi.uc.conversa(corretor, 'c2')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('conversa: falha no Chatwoot vira mensagem amigavel (nao 500)', async () => {
    const { uc, chatwoot } = montar();
    chatwoot.historicoPorTelefone.mockRejectedValue(new Error('timeout'));
    const r = await uc.conversa(corretor, 'c1');
    expect(r.encontrado).toBe(false);
    expect(r.erro).toContain('Nao foi possivel');
  });

  it('registrar contato grava atividade com o nome do corretor', async () => {
    const { uc, repo } = montar();
    const r = await uc.registrarContato(corretor, 'c1');
    expect(repo.registrarContatoWhatsapp).toHaveBeenCalledWith('t1', 'c1', 'Ana');
    expect(r.ultimoContatoEm).toEqual(new Date('2026-10-03T12:00:00Z'));
  });
});
