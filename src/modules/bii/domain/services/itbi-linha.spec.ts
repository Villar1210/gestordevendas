import { MAPA_PADRAO } from './itbi-colunas';
import { montarTransacaoItbi, textoParaHash } from './itbi-linha';

// linha real (anonimizada nos campos irrelevantes), 28 colunas
const LINHA = [
  12318300101, 'R SEN OTAVIO MANGABEIRA', 71, 'AP 12', 'JD MORUMBI', 'COND X', 5662000, '1.Compra e venda',
  428832, 46009, 300000, 100, 300000, 428832, '2.Minha Casa Minha Vida', 200000, '18º Cartório', 1000,
  'Ativo Predial', 828, 12.5, 0.0123456, 65.4, 20, 'APARTAMENTO EM CONDOMÍNIO', 13, 'RESIDENCIAL VERTICAL', 1977,
];

describe('itbi-linha - montarTransacaoItbi', () => {
  it('linha completa (ordem padrao)', () => {
    const r = montarTransacaoItbi(LINHA, MAPA_PADRAO);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const t = r.transacao;
    expect(t).toMatchObject({
      sqlCadastro: '12318300101',
      logradouro: 'R SEN OTAVIO MANGABEIRA',
      numero: '71',
      complemento: 'AP 12',
      referencia: 'COND X',
      bairro: 'JD MORUMBI',
      bairroNormalizado: 'jd morumbi',
      cep: '05662000',
      cepPrefixo: '05662',
      enderecoChave: 'rua sen otavio mangabeira|71|05662000',
      naturezaCodigo: 1,
      naturezaTransacao: 'Compra e venda',
      valorTransacao: 428832,
      valorVenalReferencia: 300000,
      proporcaoTransmitida: 100,
      tipoFinanciamentoCodigo: 2,
      tipoFinanciamento: 'Minha Casa Minha Vida',
      valorFinanciado: 200000,
      situacaoSql: 'Ativo Predial',
      areaTerreno: 828,
      fracaoIdeal: 0.0123456,
      areaConstruida: 65.4,
      usoIptu: 20,
      usoDescricao: 'APARTAMENTO EM CONDOMÍNIO',
      padraoIptu: 13,
      padraoDescricao: 'RESIDENCIAL VERTICAL',
      accIptu: 1977,
    });
    expect(t.dataTransacao.toISOString()).toBe('2025-12-18T00:00:00.000Z');
    // colunas proibidas nao existem no objeto
    expect(JSON.stringify(t)).not.toMatch(/Cartório|Testada/);
    expect(Object.values(t)).not.toContain(1000); // matricula
    expect(Object.values(t)).not.toContain(12.5); // testada
  });

  it('linha com 27 colunas (ultima vazia omitida) continua valida', () => {
    const r = montarTransacaoItbi(LINHA.slice(0, 27), MAPA_PADRAO);
    expect(r.ok && r.transacao.accIptu).toBeNull();
  });

  it('numero 99999 -> null e chave sem numero', () => {
    const l = [...LINHA];
    l[2] = 99999;
    const r = montarTransacaoItbi(l, MAPA_PADRAO);
    expect(r.ok && r.transacao.numero).toBeNull();
    expect(r.ok && r.transacao.enderecoChave).toBe('rua sen otavio mangabeira||05662000');
  });

  it.each([
    [1, 'sem_logradouro'],
    [8, 'sem_valor'],
    [9, 'sem_data'],
  ])('sem a coluna %i -> descartada (%s)', (indice, motivo) => {
    const l = [...LINHA];
    l[indice] = null as never;
    expect(montarTransacaoItbi(l, MAPA_PADRAO)).toEqual({ ok: false, motivo });
  });

  it('valor zero ou negativo -> descartada', () => {
    const l = [...LINHA];
    l[8] = 0;
    expect(montarTransacaoItbi(l, MAPA_PADRAO).ok).toBe(false);
  });

  it('textoParaHash: estavel a caixa/espaco/acento do endereco, muda com o valor', () => {
    const a = montarTransacaoItbi(LINHA, MAPA_PADRAO);
    const l2 = [...LINHA];
    l2[1] = 'Rua Sen Otávio  Mangabeira';
    const b = montarTransacaoItbi(l2, MAPA_PADRAO);
    const l3 = [...LINHA];
    l3[8] = 428833;
    const c = montarTransacaoItbi(l3, MAPA_PADRAO);
    if (!a.ok || !b.ok || !c.ok) throw new Error('linha invalida');
    expect(textoParaHash(a.transacao)).toBe(textoParaHash(b.transacao));
    expect(textoParaHash(a.transacao)).not.toBe(textoParaHash(c.transacao));
  });
});
