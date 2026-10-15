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

const FICHA_JSON =
  '{"nome":"Residencial Teste","endereco":null,"descricao":null,"areaTerreno":5000,"totalUnidades":null,' +
  '"numeroTorres":2,"unidadesPorAndar":null,"gabarito":null,"vagas":null,"tipologias":[],"itensLazer":["Piscina"]}';

type ChamadaFicha = [{ system: string; messages: { content: string | { type: string; text?: string }[] }[] }];

describe('extrairFichaTecnicaEmpreendimento', () => {
  it('sem imagens: prompt e mensagem exatamente como antes (so texto)', async () => {
    const { service, create } = servicoRespondendo(FICHA_JSON);
    const r = await service.extrairFichaTecnicaEmpreendimento('Area do terreno 5000 m2');
    const chamada = (create.mock.calls[0] as unknown as ChamadaFicha)[0];
    expect(chamada.messages[0].content).toBe('Texto extraido do PDF:\n\nArea do terreno 5000 m2');
    expect(chamada.system).not.toContain('IMAGENS');
    expect(r.areaTerreno).toBe(5000);
  });

  it('com imagens: envia texto + imagem de cada pagina (max 10) e acrescenta a regra de imagens', async () => {
    const { service, create } = servicoRespondendo(FICHA_JSON);
    const imagens = Array.from({ length: 12 }, (_, i) => ({ numero: i + 1, imagemJpegBase64: 'AAAA' }));
    const r = await service.extrairFichaTecnicaEmpreendimento('', imagens);
    const chamada = (create.mock.calls[0] as unknown as ChamadaFicha)[0];
    const content = chamada.messages[0].content as { type: string; text?: string }[];
    expect(content.filter((c) => c.type === 'image')).toHaveLength(10);
    expect(content[0].text).toContain('(sem texto)');
    expect(content[1].text).toContain('pagina 1');
    // regras de sempre continuam + regra de imagens
    expect(chamada.system).toContain('NUNCA estime');
    expect(chamada.system).toContain('IMAGENS');
    expect(r.itensLazer).toEqual(['Piscina']);
  });
});
