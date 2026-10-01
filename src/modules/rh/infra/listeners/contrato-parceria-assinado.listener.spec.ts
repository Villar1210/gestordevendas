import { ContratoParceriaAssinadoListener } from './contrato-parceria-assinado.listener';

describe('ContratoParceriaAssinadoListener', () => {
  function montar(cadastro: unknown) {
    const repo = {
      findByContratoEnvelopeId: jest.fn().mockResolvedValue(cadastro),
      setAguardandoAssinaturaContrato: jest.fn().mockResolvedValue(undefined),
    };
    const emitter = { emit: jest.fn() };
    return { listener: new ContratoParceriaAssinadoListener(repo as never, emitter as never), repo, emitter };
  }

  it('libera o acesso e emite o aviso quando o envelope e um contrato de parceria', async () => {
    const { listener, repo, emitter } = montar({ id: 'u1', tenantId: 't1', name: 'Ana', nomeImobiliaria: null, roleName: 'Corretor' });
    await listener.handle({ tenantId: 't1', envelopeId: 'e1' });
    expect(repo.setAguardandoAssinaturaContrato).toHaveBeenCalledWith('u1', false);
    expect(emitter.emit).toHaveBeenCalledWith('contrato.parceria.assinado', { tenantId: 't1', userId: 'u1', nome: 'Ana', roleName: 'Corretor' });
  });

  it('ignora envelopes comuns e de outra empresa', async () => {
    const a = montar(null);
    await a.listener.handle({ tenantId: 't1', envelopeId: 'e1' });
    expect(a.emitter.emit).not.toHaveBeenCalled();
    const b = montar({ id: 'u1', tenantId: 'OUTRO', name: 'Ana', nomeImobiliaria: null, roleName: 'Corretor' });
    await b.listener.handle({ tenantId: 't1', envelopeId: 'e1' });
    expect(b.repo.setAguardandoAssinaturaContrato).not.toHaveBeenCalled();
  });
});
