import {
  detectarColunas,
  ehAbaDeApoio,
  ehAbaMensal,
  ITBI_COLUNAS,
  linhaPareceDado,
  linhaVazia,
  MAPA_PADRAO,
  normalizarCabecalho,
  ORDEM_PADRAO,
} from './itbi-colunas';

import { CABECALHO_REAL } from '../../../../../test/bii/xlsx-teste.helper';

describe('itbi-colunas - deteccao de cabecalho', () => {
  it('normalizarCabecalho: sem acento, minusculo, sem pontuacao', () => {
    expect(normalizarCabecalho('Valor de Transação (declarado pelo contribuinte)')).toBe(
      'valor de transacao declarado pelo contribuinte',
    );
    expect(normalizarCabecalho('N° do Cadastro (SQL)')).toBe('n do cadastro sql');
    expect(normalizarCabecalho('  ÁREA CONSTRUÍDA (M2) ')).toBe('area construida m2');
  });

  it('cabecalho real: 23 campos mapeados nas posicoes padrao, 5 colunas fora (minimizacao)', () => {
    const d = detectarColunas(CABECALHO_REAL);
    expect(d.faltandoObrigatorios).toEqual([]);
    expect(d.colunasIgnoradas).toBe(5);
    expect(d.mapa).toEqual(MAPA_PADRAO);
    expect(Object.keys(d.mapa)).toHaveLength(23);
  });

  it('variacoes de acento/caixa/espaco no cabecalho', () => {
    const d = detectarColunas(['NOME DO LOGRADOURO', 'valor de transacao (DECLARADO pelo contribuinte)', '  data de transacao ']);
    expect(d.mapa).toEqual({ logradouro: 0, valorTransacao: 1, dataTransacao: 2 });
    expect(d.faltandoObrigatorios).toEqual([]);
  });

  it('colunas proibidas e desconhecidas nunca sao mapeadas', () => {
    const d = detectarColunas([
      'Matrícula do Imóvel',
      'Cartório de Registro',
      'Testada (m)',
      'Base de Cálculo adotada',
      'Valor Venal de Referência (proporcional)',
      'Nome do comprador',
    ]);
    expect(d.mapa).toEqual({});
    expect(d.colunasIgnoradas).toBe(6);
    // nenhum candidato do mapa normaliza igual a uma coluna proibida
    const proibidas = ['matricula do imovel', 'cartorio de registro', 'testada m', 'base de calculo adotada', 'valor venal de referencia proporcional'];
    const candidatos = Object.values(ITBI_COLUNAS).flat().map(normalizarCabecalho);
    for (const p of proibidas) expect(candidatos).not.toContain(p);
  });

  it('FEV-2026: aceita o erro de digitacao "Descrição do pardão (IPTU)"', () => {
    const cab = [...CABECALHO_REAL];
    cab[26] = 'Descrição do pardão (IPTU)';
    expect(detectarColunas(cab).mapa.padraoDescricao).toBe(26);
  });

  it('2022: "ACC (IPTU)" repetido no lugar da descricao do padrao -> vale a posicao padrao', () => {
    const cab = [...CABECALHO_REAL];
    cab[26] = 'ACC (IPTU)';
    const d = detectarColunas(cab);
    expect(d.mapa.accIptu).toBe(27);
    expect(d.mapa.padraoDescricao).toBe(26);
    expect(d.mapa).toEqual(MAPA_PADRAO);
  });

  it('nome repetido fora da posicao padrao: vale a 1a ocorrencia', () => {
    const d = detectarColunas(['Nome do Logradouro', 'Nome do Logradouro', 'Valor de Transação (declarado pelo contribuinte)', 'Data de Transação']);
    expect(d.mapa.logradouro).toBe(1); // posicao padrao do logradouro e 1
  });

  it('faltando obrigatorio -> reporta', () => {
    expect(detectarColunas(['Bairro', 'CEP']).faltandoObrigatorios).toEqual(['logradouro', 'valorTransacao', 'dataTransacao']);
  });

  it('ORDEM_PADRAO tem as 28 colunas, com as 5 proibidas como null', () => {
    expect(ORDEM_PADRAO).toHaveLength(28);
    expect(ORDEM_PADRAO.filter((c) => c === null)).toHaveLength(5);
    expect([12, 13, 16, 17, 20].map((i) => ORDEM_PADRAO[i])).toEqual([null, null, null, null, null]);
  });

  it('linhaPareceDado: coluna 2 texto e coluna 9 numero', () => {
    const dado = [12318300101, 'R SEN OTAVIO MANGABEIRA', 71, null, 'JD MORUMBI', null, 5662000, '1.Compra e venda', 428832, 46010];
    expect(linhaPareceDado(dado)).toBe(true);
    expect(linhaPareceDado(CABECALHO_REAL)).toBe(false);
    expect(linhaPareceDado([1, 'Nome do Logradouro', 3, 4, 5, 6, 7, 8, 9])).toBe(false);
    expect(linhaPareceDado([1, 'R X', 3, 4, 5, 6, 7, 8, '9'])).toBe(false);
  });

  it('abas de apoio e abas mensais', () => {
    expect(ehAbaDeApoio('LEGENDA')).toBe(true);
    expect(ehAbaDeApoio('EXPLICAÇÕES')).toBe(true);
    expect(ehAbaDeApoio('explicacoes')).toBe(true);
    expect(ehAbaDeApoio('Tabela de USOS')).toBe(true);
    expect(ehAbaDeApoio('Tabela de PADRÕES')).toBe(true);
    expect(ehAbaDeApoio('JAN-2026')).toBe(false);
    expect(ehAbaMensal('JAN-2026')).toBe(true);
    expect(ehAbaMensal('mai-2022')).toBe(true);
    expect(ehAbaMensal('Planilha1')).toBe(false);
  });

  it('linhaVazia', () => {
    expect(linhaVazia([null, undefined, '', '  '])).toBe(true);
    expect(linhaVazia([])).toBe(true);
    expect(linhaVazia([null, 0])).toBe(false);
  });
});
