import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CadastroEquipeDto } from '../../infra/http/dtos/cadastro-equipe.dto';
import { situacaoCreci } from '../../application/use-cases/cadastro-equipe.use-cases';
import { CARGOS_EQUIPE, ehCargoEquipe, mascarar, REGRAS_CARGO } from './cargos-equipe';

describe('cargos da equipe (decisao do Villar 25/11/2026)', () => {
  it('7 cargos; corretor e coordenadores escolhem gerente; gerente escolhe superintendente/regional', () => {
    expect(CARGOS_EQUIPE).toHaveLength(7);
    expect(REGRAS_CARGO['Consultor de Vendas']).toMatchObject({ cargoHierarquico: 'corretor', superioresPermitidos: ['gerente'] });
    expect(REGRAS_CARGO['Supervisor de Parcerias']).toMatchObject({ cargoHierarquico: 'coordenador', superioresPermitidos: ['gerente'] });
    expect(REGRAS_CARGO['Gerente de Vendas'].superioresPermitidos).toEqual(['superintendente', 'gerente_regional']);
    expect(REGRAS_CARGO['Gerente Regional'].cargoHierarquico).toBe('gerente_regional');
    expect(ehCargoEquipe('Diretor')).toBe(false);
  });

  it('mascarar mostra so o fim', () => {
    expect(mascarar('12345-6', 4)).toBe('•••45-6');
    expect(mascarar('12', 4)).toBe('••');
    expect(mascarar(null)).toBeNull();
  });

  it('situacao do CRECI', () => {
    const agora = new Date('2026-11-25T12:00:00Z');
    expect(situacaoCreci(null, false, agora)).toBe('sem_creci');
    expect(situacaoCreci(new Date('2026-11-01'), true, agora)).toBe('vencido');
    expect(situacaoCreci(new Date('2026-12-10'), true, agora)).toBe('vencendo');
    expect(situacaoCreci(new Date('2027-06-01'), true, agora)).toBe('ok');
  });
});

describe('CadastroEquipeDto (validacao da ficha)', () => {
  const base = {
    indicadoPor: ' Carla ',
    cargo: 'Gerente de Vendas',
    jaTrabalhouNoGrupo: true,
    superiorId: '7f1c1f1e-1b1a-4b6f-9a39-3c3d7a1e2f10',
    nome: 'Marcos Teixeira',
    rg: '1234',
    rgUf: 'SP',
    cpf: '123.456.789-09',
    nomeMae: 'M',
    nomePai: 'P',
    dataNascimento: '1990-01-01',
    paisNascimento: 'Brasil',
    estadoNascimento: 'SP',
    cidadeNascimento: 'SP',
    estadoCivil: 'Casado(a)',
    nomeConjuge: 'Lia',
    quantidadeFilhos: '2',
    email: 'm@t.com',
    telefone: '(11) 98765-4321',
    rua: 'R',
    numero: '1',
    bairro: 'B',
    cidade: 'C',
    cep: '03277-000',
    escolaridade: 'Ensino Médio Completo',
    possuiCreci: false,
    banco: 'Itaú',
    agencia: '1234',
    conta: '1234-5',
    tipoConta: 'Corrente',
    tipoPix: 'CPF',
    chavePix: '12345678909',
    optaPj: false,
    tamanhoCamisa: 'G',
    senha: '12345678',
    aceiteLgpd: true,
  };
  const erros = async (o: object) =>
    (await validate(plainToInstance(CadastroEquipeDto, { ...base, ...o }))).map((e) => e.property);

  it('ficha valida passa e limpa CPF/telefone/CEP', async () => {
    const dto = plainToInstance(CadastroEquipeDto, base);
    expect(await validate(dto)).toEqual([]);
    expect(dto).toMatchObject({ cpf: '12345678909', telefone: '11987654321', cep: '03277000', indicadoPor: 'Carla' });
  });

  it('exige conjuge so para casado/uniao; CRECI so se possui; dados PJ so se opta', async () => {
    expect(await erros({ nomeConjuge: '' })).toContain('nomeConjuge');
    expect(await erros({ estadoCivil: 'Solteiro(a)', nomeConjuge: undefined })).toEqual([]);
    expect(await erros({ possuiCreci: true })).toEqual(expect.arrayContaining(['creciTipo', 'creciNumero', 'creciValidade']));
    expect(await erros({ optaPj: true })).toEqual(expect.arrayContaining(['cnpj', 'pjBanco', 'pjAgencia', 'pjConta']));
  });

  it('sem aceite LGPD, cargo fora da lista ou CPF curto: recusa', async () => {
    expect(await erros({ aceiteLgpd: false })).toContain('aceiteLgpd');
    expect(await erros({ cargo: 'Diretor' })).toContain('cargo');
    expect(await erros({ cpf: '123' })).toContain('cpf');
  });
});
