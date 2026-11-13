import { formatarCelular, mascararTelefone, normalizarCelularBR } from './telefone';
import { analisarPiorCaso, analisarTexto, montarMensagem, primeiroNomeParaSms, validarModelo } from './sms-texto';
import { ehPedidoDeSaida, limparResposta } from './optout';
import { dentroDaJanela, envioPorRodada } from './janela-envio';
import { CabecalhoInvalidoError, lerContatos, mapearCabecalho } from './importacao';
import { celulaCsvSegura, podeCancelar, podeEditar, podeIniciar, urlDeDestino, validarConfig, validarLinkDestino } from './campanha-regras';

describe('normalizarCelularBR', () => {
  it.each([
    ['5511987654321', '5511987654321'],
    ['+55 (11) 98765-4321', '5511987654321'],
    ['11987654321', '5511987654321'],
    ['011987654321', '5511987654321'],
    [5511987654321, '5511987654321'],
    ['55 21 99999 0000', '5521999990000'],
  ])('%p -> %p', (entrada, esperado) => expect(normalizarCelularBR(entrada)).toBe(esperado));

  it.each([['1133334444'], ['551133334444'], ['5501987654321'], ['5520987654321'], ['123'], [''], [null], ['5511887654321'], ['55119876543210']])(
    'recusa %p',
    (entrada) => expect(normalizarCelularBR(entrada)).toBeNull(),
  );

  it('mascara e formata', () => {
    expect(mascararTelefone('5511987654321')).toBe('5511*****4321');
    expect(formatarCelular('5511987654321')).toBe('+55 (11) 98765-4321');
  });
});

describe('analisarTexto (GSM-7 x UCS-2)', () => {
  it('160 caracteres GSM cabem em 1 SMS; 161 viram 2 (153 por parte)', () => {
    expect(analisarTexto('a'.repeat(160))).toMatchObject({ codificacao: 'GSM7', tamanho: 160, segmentos: 1 });
    expect(analisarTexto('a'.repeat(161))).toMatchObject({ segmentos: 2 });
    expect(analisarTexto('a'.repeat(306))).toMatchObject({ segmentos: 2 });
    expect(analisarTexto('a'.repeat(307))).toMatchObject({ segmentos: 3 });
  });

  it('caracteres de extensao contam 2', () => {
    expect(analisarTexto('€[]').tamanho).toBe(6);
    expect(analisarTexto('a'.repeat(158) + '€')).toMatchObject({ tamanho: 160, segmentos: 1 });
    expect(analisarTexto('a'.repeat(159) + '€')).toMatchObject({ tamanho: 161, segmentos: 2 });
  });

  it('é/à sao GSM-7, mas ã/ç/á mudam para UCS-2 (70 por SMS)', () => {
    expect(analisarTexto('café à vista').codificacao).toBe('GSM7');
    const a = analisarTexto('condições');
    expect(a.codificacao).toBe('UCS2');
    expect(a.caracteresForaDoGsm).toEqual(expect.arrayContaining(['ç', 'õ']));
    expect(analisarTexto('ã'.repeat(70)).segmentos).toBe(1);
    expect(analisarTexto('ã'.repeat(71)).segmentos).toBe(2);
  });

  it('emoji conta 2 unidades em UCS-2', () => {
    expect(analisarTexto('🏡').tamanho).toBe(2);
  });
});

describe('montagem da mensagem', () => {
  it('primeiro nome sem acento, capitalizado, ate 12 letras', () => {
    expect(primeiroNomeParaSms('  JOÃO  pedro')).toBe('Joao');
    expect(primeiroNomeParaSms('Quitéria')).toBe('Quiteria');
    expect(primeiroNomeParaSms('Sabrinadeoliveirasalino')).toBe('Sabrinadeoli');
    expect(primeiroNomeParaSms('123')).toBe('');
  });

  it('substitui variaveis e tira o espaco quando nao ha nome', () => {
    expect(montarMensagem('Oi {primeiro_nome}! Veja {link}', { primeiroNome: 'Ana', link: 'https://x.co/r/AAAAAA' })).toBe(
      'Oi Ana! Veja https://x.co/r/AAAAAA',
    );
    expect(montarMensagem('Oi {primeiro_nome}! Veja {link}', { primeiroNome: '', link: 'L' })).toBe('Oi! Veja L');
  });

  it('valida o modelo', () => {
    expect(validarModelo('Oi {primeiro_nome}').ok).toBe(false);
    expect(validarModelo('{link} e {link}').erro).toMatch(/uma única vez/);
    expect(validarModelo('Oi {nome} {link}').erro).toMatch(/desconhecida/);
    expect(validarModelo('Oi {primeiro_nome}, veja {link}').ok).toBe(true);
  });

  it('pior caso usa o maior nome e o link no tamanho real', () => {
    const modelo = 'Oi {primeiro_nome}! Novolar Freguesia: Minha Casa Minha Vida com FGTS. Veja a tabela: {link} SAIR p/ parar';
    const r = analisarPiorCaso(modelo, 'Mmmmmmmmmmmm', 'https://gestordevendas.ivillar.com.br/r');
    expect(r.exemplo).toContain('https://gestordevendas.ivillar.com.br/r/XXXXXX');
    expect(r.codificacao).toBe('GSM7');
    expect(r.segmentos).toBe(1);
  });
});

describe('opt-out por resposta', () => {
  it.each(['SAIR', 'sair', ' Sair. ', 'PARE por favor', 'Não quero', 'nao quero mais', 'STOP', 'descadastrar'])('%p e saida', (t) =>
    expect(ehPedidoDeSaida(t)).toBe(true),
  );
  it.each(['quero sair do aluguel', 'Quero saber o preço', 'sim', '', 'parabens'])('%p nao e saida', (t) => expect(ehPedidoDeSaida(t)).toBe(false));
  it('limpa controles e corta em 500', () => {
    expect(limparResposta('oi‮\u0007 tudo')).toBe('oi tudo');
    expect(limparResposta('a'.repeat(600))).toHaveLength(500);
  });
});

describe('janela de envio', () => {
  it('seg-sab entre inicio (inclusive) e fim (exclusive); domingo nunca', () => {
    expect(dentroDaJanela({ diaSemana: 1, hora: 9 }, 9, 20)).toBe(true);
    expect(dentroDaJanela({ diaSemana: 6, hora: 19 }, 9, 20)).toBe(true);
    expect(dentroDaJanela({ diaSemana: 1, hora: 20 }, 9, 20)).toBe(false);
    expect(dentroDaJanela({ diaSemana: 1, hora: 8 }, 9, 20)).toBe(false);
    expect(dentroDaJanela({ diaSemana: 0, hora: 12 }, 9, 20)).toBe(false);
  });
  it('ritmo por rodada de 15 s', () => {
    expect(envioPorRodada(30)).toBe(8);
    expect(envioPorRodada(6)).toBe(2);
    expect(envioPorRodada(120)).toBe(30);
  });
});

describe('importacao', () => {
  it('le a aba SMS da planilha do repique', () => {
    const linhas = [
      ['nome', 'primeiro_nome', 'telefone', 'corretor', 'status_xrm', 'data_entrada', 'aceite_comunicacoes'],
      ['Carina Souza', 'Carina', '5511987654321', 'Lucas', 'Baixado', '2026-11-01', 'Não'],
      ['João da Silva', '', '(11) 97777-1234', '', '', '', ''],
      ['Fixo', 'Fixo', '1133334444', '', '', '', ''],
      ['Repetido', 'Rep', '11987654321', '', '', '', ''],
      ['', '', '', '', '', '', ''],
    ];
    const r = lerContatos(linhas);
    expect(r.linhasLidas).toBe(4);
    expect(r.invalidos).toBe(1);
    expect(r.duplicadosNoArquivo).toBe(1);
    expect(r.contatos).toEqual([
      { nome: 'Carina Souza', primeiroNome: 'Carina', telefone: '5511987654321', corretor: 'Lucas', referencia: null },
      { nome: 'João da Silva', primeiroNome: 'Joao', telefone: '5511977771234', corretor: null, referencia: null },
    ]);
  });

  it('reconhece cabecalhos da aba Contatos/Atendimentos', () => {
    const mapa = mapearCabecalho(['Situação', 'Nome', 'Telefone / WhatsApp', 'Telefone (só números)', 'Responsável (corretor)', 'Nº Lead']);
    expect(mapa).toMatchObject({ nome: 1, telefone: 3, corretor: 4, referencia: 5 });
  });

  it('sem coluna de telefone -> erro claro', () => {
    expect(() => lerContatos([['nome', 'email'], ['a', 'b']])).toThrow(CabecalhoInvalidoError);
  });
});

describe('regras da campanha', () => {
  it('estados', () => {
    expect(podeEditar('rascunho') && podeEditar('pausada')).toBe(true);
    expect(podeEditar('enviando')).toBe(false);
    expect(podeIniciar('concluida')).toBe(false);
    expect(podeCancelar('cancelada')).toBe(false);
  });

  it('config e link', () => {
    expect(validarConfig({ maxSegmentos: 1, taxaPorMinuto: 30, janelaInicio: 9, janelaFim: 20 })).toBeNull();
    expect(validarConfig({ maxSegmentos: 4, taxaPorMinuto: 30, janelaInicio: 9, janelaFim: 20 })).toMatch(/partes/);
    expect(validarConfig({ maxSegmentos: 1, taxaPorMinuto: 500, janelaInicio: 9, janelaFim: 20 })).toMatch(/Ritmo/);
    expect(validarConfig({ maxSegmentos: 1, taxaPorMinuto: 30, janelaInicio: 20, janelaFim: 9 })).toMatch(/Horário/);
    expect(validarLinkDestino('https://freguesia.ivillar.com.br')).toBeNull();
    expect(validarLinkDestino('http://freguesia.ivillar.com.br')).toMatch(/https/);
    expect(validarLinkDestino('javascript:alert(1)')).not.toBeNull();
    expect(validarLinkDestino('https://user:pass@x.com')).not.toBeNull();
  });

  it('url de destino leva o codigo e utm', () => {
    const u = new URL(urlDeDestino('https://freguesia.ivillar.com.br/?x=1', 'AbC123', '12345678-aaaa-bbbb-cccc-000000000000'));
    expect(u.hostname).toBe('freguesia.ivillar.com.br');
    expect(u.searchParams.get('x')).toBe('1');
    expect(u.searchParams.get('c')).toBe('AbC123');
    expect(u.searchParams.get('utm_source')).toBe('sms');
    expect(u.searchParams.get('utm_campaign')).toBe('12345678');
  });

  it('celula csv neutraliza formula', () => {
    expect(celulaCsvSegura('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(celulaCsvSegura('Ana')).toBe('"Ana"');
    expect(celulaCsvSegura(null)).toBe('""');
  });
});
