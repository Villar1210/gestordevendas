import { preencherEmailTemplate, botaoAcessoHtml } from './preencher-email-template';

describe('preencherEmailTemplate', () => {
  const dados = { nome: 'Ana <a href="x">clique</a>', email: 'ana@ex.com', empresa: 'A & B', linkAcesso: 'https://app/login' };

  it('escapa os valores no corpo (html) e preenche LINK_ACESSO', () => {
    const corpo = preencherEmailTemplate('<p>Olá, {{NOME}} - {{EMPRESA}}</p><a href="{{LINK_ACESSO}}">ir</a>', dados, { html: true });
    expect(corpo).toBe('<p>Olá, Ana &lt;a href=&quot;x&quot;&gt;clique&lt;/a&gt; - A &amp; B</p><a href="https://app/login">ir</a>');
  });

  it('nao escapa o assunto (texto puro)', () => {
    expect(preencherEmailTemplate('Bem-vindo à {{EMPRESA}}', dados)).toBe('Bem-vindo à A & B');
  });

  it('placeholder ausente vira vazio', () => {
    expect(preencherEmailTemplate('[{{CARGO}}]', dados, { html: true })).toBe('[]');
  });

  it('botaoAcessoHtml leva o link escapado', () => {
    expect(botaoAcessoHtml('https://app/login?a=1&b=2')).toContain('href="https://app/login?a=1&amp;b=2"');
  });
});
