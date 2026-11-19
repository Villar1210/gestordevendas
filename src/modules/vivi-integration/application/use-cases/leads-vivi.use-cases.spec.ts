import { ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { comNomeDoCorretor, ehMensagemInterna, estadoDoEnvio, LeadsViviUseCases } from './leads-vivi.use-cases';

function montar(card: Record<string, unknown> | null = { id: 'c1', ownerId: 'u1', phone: '5511999998888', origem: 'roleta_online' }) {
  const repo = {
    listar: jest.fn().mockResolvedValue([]),
    findCard: jest.fn().mockResolvedValue(card),
    nomeUsuario: jest.fn().mockResolvedValue('Ana'),
    registrarContatoWhatsapp: jest.fn().mockResolvedValue(new Date('2026-10-03T12:00:00Z')),
    aguardandoAceite: jest.fn().mockResolvedValue(false),
    detalheParaChat: jest.fn().mockResolvedValue({
      id: 'c1',
      atribuidoAutomaticamenteEm: new Date('2026-11-19T12:00:00Z'),
      aceitoEm: new Date('2026-11-19T12:01:00Z'),
      activities: [{ subject: 'Conversa do WhatsApp oficial passada da VIVI para Ana', createdAt: new Date('2026-11-19T12:01:01Z') }],
      timeoutAceiteMinutos: 5,
    }),
  };
  const chatwoot = {
    historicoPorTelefone: jest.fn().mockResolvedValue({ encontrado: true, conversaUrl: 'x', status: 'open', mensagens: [] }),
    historicoParaGravar: jest.fn().mockResolvedValue([]),
    enviarParaCliente: jest
      .fn()
      .mockResolvedValue({ ok: true, conversaId: 66, inboxId: 2, chatwootMessageId: 1400, enviadaEm: new Date('2026-11-19T13:00:00Z') }),
  };
  const mensagens = {
    registrarEnvio: jest.fn().mockResolvedValue(undefined),
    resumoPorCard: jest.fn().mockResolvedValue(new Map()),
    daConversa: jest.fn().mockResolvedValue([]),
    ultimaDoCliente: jest.fn().mockResolvedValue(new Date()),
    corretorJaEscreveu: jest.fn().mockResolvedValue(false),
    inserirVarias: jest.fn().mockResolvedValue(0),
    ligarSemCardAoCard: jest.fn().mockResolvedValue(0),
    marcarLido: jest.fn().mockResolvedValue(undefined),
  };
  return { uc: new LeadsViviUseCases(repo as any, chatwoot as any, mensagens as any), repo, chatwoot, mensagens };
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

  it('conversa: lead da VIVI do fazer.ai (origem vivi, fase B) tambem e lead da VIVI', async () => {
    const { uc } = montar({ id: 'c3', ownerId: 'u1', phone: '5511999998888', origem: 'vivi' });
    await expect(uc.conversa(corretor, 'c3')).resolves.toMatchObject({ encontrado: true });
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

  describe('enviarMensagem (Etapa 1, parte 3)', () => {
    it('corretor dono envia com o primeiro nome em negrito e grava como autor', async () => {
      const { uc, chatwoot, mensagens } = montar();
      const r = await uc.enviarMensagem(corretor, 'c1', '  Bom dia! Tudo bem?  ');
      expect(chatwoot.enviarParaCliente).toHaveBeenCalledWith('5511999998888', '*Ana*\nBom dia! Tudo bem?');
      expect(mensagens.registrarEnvio).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          cardId: 'c1',
          chatwootMessageId: 1400,
          chatwootConversationId: 66,
          chatwootInboxId: 2,
          autorUserId: 'u1',
          autorNome: 'Ana',
          direcao: 'saida',
          conteudo: '*Ana*\nBom dia! Tudo bem?',
          telefoneChave: '1199998888',
        }),
      );
      expect(r).toEqual({ ok: true, enviadaEm: new Date('2026-11-19T13:00:00Z') });
    });

    it('gestao (admin) e outro corretor nao enviam - so leem', async () => {
      const a = montar();
      await expect(a.uc.enviarMensagem(admin, 'c1', 'oi')).rejects.toBeInstanceOf(ForbiddenException);
      await expect(a.uc.enviarMensagem(outro, 'c1', 'oi')).rejects.toBeInstanceOf(ForbiddenException);
      expect(a.chatwoot.enviarParaCliente).not.toHaveBeenCalled();
    });

    it('lead que nao e da VIVI ou inexistente: 404', async () => {
      await expect(montar({ id: 'c1', ownerId: 'u1', phone: '1', origem: 'manual' }).uc.enviarMensagem(corretor, 'c1', 'oi')).rejects.toBeInstanceOf(NotFoundException);
      await expect(montar(null).uc.enviarMensagem(corretor, 'c1', 'oi')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('fora da janela de 24 h: explica e nao grava nada', async () => {
      const { uc, chatwoot, mensagens } = montar();
      chatwoot.enviarParaCliente.mockResolvedValueOnce({ ok: false, motivo: 'fora_da_janela' });
      await expect(uc.enviarMensagem(corretor, 'c1', 'oi')).rejects.toThrow(/24 h/);
      expect(mensagens.registrarEnvio).not.toHaveBeenCalled();
    });

    it('sem conversa no numero oficial ou falha do Chatwoot', async () => {
      const a = montar();
      a.chatwoot.enviarParaCliente.mockResolvedValueOnce({ ok: false, motivo: 'sem_conversa' });
      await expect(a.uc.enviarMensagem(corretor, 'c1', 'oi')).rejects.toBeInstanceOf(UnprocessableEntityException);
      a.chatwoot.enviarParaCliente.mockResolvedValueOnce({ ok: false, motivo: 'erro', detalhe: 'HTTP 500' });
      await expect(a.uc.enviarMensagem(corretor, 'c1', 'oi')).rejects.toBeInstanceOf(ServiceUnavailableException);
    });

    it('texto so com espacos: recusado sem enviar', async () => {
      const { uc, chatwoot } = montar();
      await expect(uc.enviarMensagem(corretor, 'c1', '   ')).rejects.toThrow('Escreva a mensagem.');
      expect(chatwoot.enviarParaCliente).not.toHaveBeenCalled();
    });
  });

  it('comNomeDoCorretor: primeiro nome, sem caracteres de formatacao; sem nome, so o texto', () => {
    expect(comNomeDoCorretor('Daniel Villar', 'Oi')).toBe('*Daniel*\nOi');
    expect(comNomeDoCorretor('  *Ana* Souza', 'Oi')).toBe('*Ana*\nOi');
    expect(comNomeDoCorretor(null, 'Oi')).toBe('Oi');
    expect(comNomeDoCorretor('   ', 'Oi')).toBe('Oi');
  });

  describe('Etapa 3 - tela de chat', () => {
    it('estadoDoEnvio: dono na janela pode; gestao so le; antes do aceite e fora das 24 h bloqueia', () => {
      const agora = new Date('2026-11-19T15:00:00Z');
      const recente = new Date('2026-11-19T14:00:00Z');
      expect(estadoDoEnvio({ souDono: true, aguardandoAceite: false, ultimaDoCliente: recente, agora })).toEqual({
        podeEnviar: true,
        motivo: 'ok',
        janelaFechaEm: new Date('2026-11-20T14:00:00Z'),
      });
      expect(estadoDoEnvio({ souDono: false, aguardandoAceite: false, ultimaDoCliente: recente, agora }).motivo).toBe('somente_leitura');
      expect(estadoDoEnvio({ souDono: true, aguardandoAceite: true, ultimaDoCliente: recente, agora }).motivo).toBe('aguardando_aceite');
      expect(estadoDoEnvio({ souDono: true, aguardandoAceite: false, ultimaDoCliente: new Date('2026-11-18T14:59:59Z'), agora }).motivo).toBe(
        'fora_da_janela',
      );
      expect(estadoDoEnvio({ souDono: true, aguardandoAceite: false, ultimaDoCliente: null, agora }).motivo).toBe('sem_mensagem_do_cliente');
    });

    it('ehMensagemInterna: esconde os comandos de teste do fazer.ai', () => {
      expect(ehMensagemInterna('Modo teste ativado')).toBe(true);
      expect(ehMensagemInterna(' modo teste desativado.')).toBe(true);
      expect(ehMensagemInterna('Quero testar o modo de pagamento')).toBe(false);
      expect(ehMensagemInterna(null)).toBe(false);
    });

    it('listar traz ultima mensagem e nao lidas (escondendo mensagem interna)', async () => {
      const { uc, repo, mensagens } = montar();
      repo.listar.mockResolvedValue([{ id: 'c1' }, { id: 'c2' }]);
      mensagens.resumoPorCard.mockResolvedValue(
        new Map([
          ['c1', { ultima: { texto: 'Oi', autorTipo: 'cliente', em: new Date(), temAnexo: false }, naoLidas: 2 }],
          ['c2', { ultima: { texto: 'Modo teste ativado', autorTipo: 'vivi', em: new Date(), temAnexo: false }, naoLidas: 0 }],
        ]),
      );
      const r = await uc.listar(corretor);
      expect(mensagens.resumoPorCard).toHaveBeenCalledWith(['c1', 'c2'], 'u1');
      expect(r.leads[0]).toMatchObject({ id: 'c1', naoLidas: 2, ultimaMensagem: { texto: 'Oi' } });
      expect(r.leads[1]).toMatchObject({ id: 'c2', naoLidas: 0, ultimaMensagem: null });
    });

    it('abrir a conversa completa o historico pelo Chatwoot (no maximo a cada 2 min) e devolve mensagens, eventos e envio', async () => {
      const { uc, chatwoot, mensagens } = montar();
      chatwoot.historicoParaGravar.mockResolvedValue([
        { chatwootMessageId: 10, chatwootConversationId: 66, chatwootInboxId: 2, telefone: '+5511999998888', direcao: 'entrada', autorTipo: 'cliente', autorNome: 'Maria', conteudo: 'Oi', anexos: [], enviadaEm: new Date() },
      ]);
      mensagens.daConversa.mockResolvedValue([
        { chatwootMessageId: 10, direcao: 'entrada', autorTipo: 'cliente', autorNome: 'Maria', conteudo: 'Oi', anexos: null, enviadaEm: new Date('2026-11-19T12:00:00Z'), createdAt: new Date() },
        { chatwootMessageId: 11, direcao: 'saida', autorTipo: 'vivi', autorNome: 'Vivi Assistente Virtual', conteudo: 'Modo teste ativado', anexos: null, enviadaEm: new Date('2026-11-19T12:00:01Z'), createdAt: new Date() },
        { chatwootMessageId: 12, direcao: 'saida', autorTipo: 'atendente', autorNome: 'Ana Lima', conteudo: '*Ana*\nOla', anexos: null, enviadaEm: new Date('2026-11-19T12:02:00Z'), createdAt: new Date() },
      ]);

      const r = await uc.conversaChat(corretor, 'c1');
      await uc.conversaChat(corretor, 'c1');

      expect(chatwoot.historicoParaGravar).toHaveBeenCalledTimes(1);
      expect(mensagens.inserirVarias).toHaveBeenCalledWith([expect.objectContaining({ chatwootMessageId: 10, tenantId: 't1', cardId: 'c1', telefoneChave: '1199998888' })]);
      expect(r.mensagens.map((m) => [m.id, m.autor, m.autorNome])).toEqual([
        [10, 'cliente', 'Maria'],
        [12, 'atendente', 'Ana Lima'],
      ]);
      expect(r.eventos.map((e) => e.tipo)).toEqual(['passagem']);
      expect(r.envio).toMatchObject({ podeEnviar: true, motivo: 'ok', prazoAceiteAte: null, corretorJaEscreveu: false });
      expect(r.erro).toBeNull();
    });

    it('atualizacao automatica (desde) so le o banco; Chatwoot fora do ar nao derruba a tela', async () => {
      const a = montar();
      const desde = new Date('2026-11-19T12:00:00Z');
      await a.uc.conversaChat(corretor, 'c1', desde);
      expect(a.chatwoot.historicoParaGravar).not.toHaveBeenCalled();
      expect(a.mensagens.daConversa).toHaveBeenCalledWith('c1', desde);

      const b = montar();
      b.chatwoot.historicoParaGravar.mockRejectedValue(new Error('timeout'));
      const r = await b.uc.conversaChat(corretor, 'c1');
      expect(r.erro).toMatch(/historico antigo/);
    });

    it('lead aguardando aceite: caixa bloqueada com prazo; envio recusado (409)', async () => {
      const { uc, repo } = montar();
      repo.detalheParaChat.mockResolvedValue({
        id: 'c1',
        atribuidoAutomaticamenteEm: new Date('2026-11-19T12:00:00Z'),
        aceitoEm: null,
        activities: [],
        timeoutAceiteMinutos: 5,
      });
      const r = await uc.conversaChat(corretor, 'c1');
      expect(r.envio).toMatchObject({ podeEnviar: false, motivo: 'aguardando_aceite', prazoAceiteAte: new Date('2026-11-19T12:05:00Z') });
      repo.aguardandoAceite.mockResolvedValue(true);
      await expect(uc.enviarMensagem(corretor, 'c1', 'oi')).rejects.toBeInstanceOf(ConflictException);
    });

    it('gestao abre a conversa de qualquer corretor em somente leitura; outro corretor nao abre', async () => {
      const { uc } = montar();
      expect((await uc.conversaChat(admin, 'c1')).envio.motivo).toBe('somente_leitura');
      await expect(uc.conversaChat(outro, 'c1')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('marcarLido grava a leitura do usuario', async () => {
      const { uc, mensagens } = montar();
      await uc.marcarLido(corretor, 'c1');
      expect(mensagens.marcarLido).toHaveBeenCalledWith('u1', 'c1', expect.any(Date));
    });
  });
});
