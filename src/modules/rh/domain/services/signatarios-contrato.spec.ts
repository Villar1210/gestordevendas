import { montarSignatariosContrato, validarContratoParceriaConfig } from './signatarios-contrato';
import { CONTRATO_PARCERIA_CONFIG_PADRAO } from '../repositories/contrato-parceria-config-repository.interface';

const contratado = { nome: 'Ana Corretora', email: 'ana@ex.com', documento: 'CPF 123' };

describe('signatarios do contrato de parceria', () => {
  it('sem configuracao: so o contratado assina (comportamento original)', () => {
    const s = montarSignatariosContrato(CONTRATO_PARCERIA_CONFIG_PADRAO, contratado, 'Imob X');
    expect(s).toEqual([{ name: 'Ana Corretora', email: 'ana@ex.com', role: 'destinatario', rotulo: 'CONTRATADO(A)', detalhe: 'CPF 123' }]);
  });

  it('representante + 2 testemunhas na ordem do E-doc', () => {
    const s = montarSignatariosContrato(
      {
        ...CONTRATO_PARCERIA_CONFIG_PADRAO,
        assinaturaEmpresaAtiva: true,
        representanteNome: 'Rui',
        representanteEmail: 'rui@ex.com',
        representanteCargo: 'Diretor',
        quantidadeTestemunhas: 2,
        testemunha1Nome: 'T1',
        testemunha1Email: 't1@ex.com',
        testemunha2Nome: 'T2',
        testemunha2Email: 't2@ex.com',
      },
      contratado,
      'Imob X',
    );
    expect(s.map((x) => [x.role, x.rotulo])).toEqual([
      ['destinatario', 'CONTRATADO(A)'],
      ['remetente', 'CONTRATANTE'],
      ['testemunha', 'TESTEMUNHA 1'],
      ['testemunha', 'TESTEMUNHA 2'],
    ]);
    expect(s[1].detalhe).toBe('Imob X - Diretor');
  });

  it('respeita a quantidade de testemunhas e nunca repete o e-mail do contratado', () => {
    const s = montarSignatariosContrato(
      {
        ...CONTRATO_PARCERIA_CONFIG_PADRAO,
        assinaturaEmpresaAtiva: true,
        representanteNome: 'Ana mesmo',
        representanteEmail: 'ANA@ex.com',
        quantidadeTestemunhas: 1,
        testemunha1Nome: 'T1',
        testemunha1Email: 't1@ex.com',
        testemunha2Nome: 'T2',
        testemunha2Email: 't2@ex.com',
      },
      contratado,
      'Imob X',
    );
    expect(s.map((x) => x.email)).toEqual(['ana@ex.com', 't1@ex.com']);
  });

  it('valida campos obrigatorios, e-mails e duplicidade', () => {
    const base = { ...CONTRATO_PARCERIA_CONFIG_PADRAO };
    expect(validarContratoParceriaConfig(base)).toBeNull();
    expect(validarContratoParceriaConfig({ ...base, assinaturaEmpresaAtiva: true })).toMatch(/nome do representante/);
    expect(
      validarContratoParceriaConfig({ ...base, assinaturaEmpresaAtiva: true, representanteNome: 'R', representanteEmail: 'x' }),
    ).toMatch(/e-mail válido/);
    expect(validarContratoParceriaConfig({ ...base, quantidadeTestemunhas: 1 })).toMatch(/testemunha 1/);
    expect(
      validarContratoParceriaConfig({
        ...base,
        assinaturaEmpresaAtiva: true,
        representanteNome: 'R',
        representanteEmail: 'a@ex.com',
        quantidadeTestemunhas: 1,
        testemunha1Nome: 'T',
        testemunha1Email: 'A@ex.com',
      }),
    ).toMatch(/e-mails diferentes/);
    expect(validarContratoParceriaConfig({ ...base, lembreteDias: '2;5' })).toMatch(/lembrete/);
  });
});
