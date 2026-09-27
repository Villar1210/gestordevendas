import { AnthropicConversationService } from './anthropic-conversation.service';

function servicoRespondendo(texto: string) {
  process.env.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || 'sk-ant-teste';
  const service = new AnthropicConversationService();
  const create = jest.fn(async () => ({ content: [{ type: 'text', text: texto }] }));
  (service as unknown as { client: { messages: { create: typeof create } } }).client = { messages: { create } };
  return { service, create };
}

const PAGINAS = [
  { numero: 1, texto: 'Perspectiva ilustrada da fachada', imagemJpegBase64: 'AAAA' },
  { numero: 2, texto: 'Ficha tecnica', imagemJpegBase64: null },
  { numero: 3, texto: '', imagemJpegBase64: 'BBBB' },
];

describe('classificarPaginasBook', () => {
  it('envia texto + imagem por pagina e le a resposta', async () => {
    const { service, create } = servicoRespondendo(
      'Aqui esta:\n{"paginas":[{"numero":1,"categoria":"fachada","legenda":"Fachada"},' +
        '{"numero":2,"categoria":"ficha_tecnica","legenda":null},{"numero":3,"categoria":"piscina","legenda":"Piscina"}],' +
        '"nome":"Residencial Teste","construtora":null,"endereco":{"rua":"Rua A","numero":"10","bairro":null,"cidade":"Sao Paulo","uf":"sp","cep":null}}',
    );
    const r = await service.classificarPaginasBook(PAGINAS);
    const chamada = (create.mock.calls[0] as unknown as [{ messages: { content: { type: string }[] }[] }])[0];
    const tipos = chamada.messages[0].content.map((c) => c.type);
    expect(tipos.filter((t) => t === 'image')).toHaveLength(2);
    expect(r.paginas).toEqual([
      { numero: 1, categoria: 'fachada', legenda: 'Fachada' },
      { numero: 2, categoria: 'ficha_tecnica', legenda: null },
      // categoria inventada pela IA vira "descartar"
      { numero: 3, categoria: 'descartar', legenda: 'Piscina' },
    ]);
    expect(r.endereco.uf).toBe('SP');
    expect(r.nome).toBe('Residencial Teste');
  });

  it('pagina que a IA esqueceu vira "descartar"; UF invalida vira null', async () => {
    const { service } = servicoRespondendo(
      '{"paginas":[{"numero":1,"categoria":"fachada","legenda":null}],"nome":null,"endereco":{"uf":"Sao Paulo"}}',
    );
    const r = await service.classificarPaginasBook(PAGINAS);
    expect(r.paginas.map((p) => p.categoria)).toEqual(['fachada', 'descartar', 'descartar']);
    expect(r.endereco).toEqual({ rua: null, numero: null, bairro: null, cidade: null, uf: null, cep: null });
  });

  it('resposta sem JSON gera erro (o use case avisa o usuario)', async () => {
    const { service } = servicoRespondendo('nao consegui');
    await expect(service.classificarPaginasBook(PAGINAS)).rejects.toThrow();
  });
});
