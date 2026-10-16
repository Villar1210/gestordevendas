import { createHash } from 'crypto';
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

describe('regras novas do book (descricao sem institucional, descartar material interno)', () => {
  it('ficha: prompt manda ignorar texto institucional da construtora na descricao (com e sem imagens)', async () => {
    const { service, create } = servicoRespondendo(FICHA_JSON);
    await service.extrairFichaTecnicaEmpreendimento('texto');
    await service.extrairFichaTecnicaEmpreendimento('', [{ numero: 1, imagemJpegBase64: 'AAAA' }]);
    for (const call of create.mock.calls as unknown as ChamadaFicha[]) {
      const system = call[0].system;
      expect(system).toContain('descreva SOMENTE o EMPREENDIMENTO');
      expect(system).toContain('IGNORE textos institucionais sobre a construtora');
      expect(system).toContain('Se so houver texto institucional, use null');
      expect(system).toContain('premiacoes, sorteios, campanhas');
      // regras de sempre continuam
      expect(system).toContain('NUNCA estime');
      expect(system).toContain('IGNORE completamente qualquer tabela de precos');
    }
  });

  it('classificacao: institucional e material interno de vendas vao para "descartar"', async () => {
    const { service, create } = servicoRespondendo('{"paginas":[],"nome":null,"endereco":{}}');
    await service.classificarPaginasBook(PAGINAS);
    const system = (create.mock.calls[0] as unknown as [{ system: string }])[0].system;
    expect(system).toContain('texto institucional da construtora');
    expect(system).toContain('metas, premiacoes, sorteios');
    expect(system).toContain('NUNCA invente');
  });
});

describe('VIVI inalterada (generateReply / confirmarExistenciaEmpreendimento)', () => {
  const sha = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');

  it('generateReply: usa o system prompt recebido, mesmas tools e mensagem delimitada', async () => {
    const { service, create } = servicoRespondendo('Olá!');
    const r = await service.generateReply({ systemPrompt: 'PROMPT DA VIVI', history: [], userMessage: 'oi' });
    const chamada = (create.mock.calls[0] as unknown as [Record<string, unknown>])[0] as {
      model: string;
      max_tokens: number;
      system: string;
      messages: unknown[];
      tools: { name: string }[];
    };
    expect(r).toEqual({ replyText: 'Olá!', toolCalls: [] });
    expect(chamada.system).toBe('PROMPT DA VIVI');
    expect(chamada.model).toBe('claude-haiku-4-5-20251001');
    expect(chamada.max_tokens).toBe(1024);
    expect(chamada.messages).toEqual([{ role: 'user', content: '<mensagem_do_lead>\noi\n</mensagem_do_lead>' }]);
    expect(chamada.tools.map((t) => t.name)).toEqual([
      'salvar_dados_lead',
      'transferir_para_corretor',
      'transferir_para_fila',
      'agendar_visita',
      'salvar_dados_pos_visita',
      'buscar_empreendimento_por_endereco',
    ]);
    // schema/descricao das tools byte a byte iguais (hash do JSON)
    expect(sha(chamada.tools)).toBe(HASH_TOOLS_VIVI);
  });

  it('confirmarExistenciaEmpreendimento: mesmo prompt e mesma tool de busca', async () => {
    const { service, create } = servicoRespondendo('{"confirmado":true,"nome":"Res X"}');
    const r = await service.confirmarExistenciaEmpreendimento('Rua A, 10');
    const chamada = (create.mock.calls[0] as unknown as [{ system: string; tools: unknown }])[0];
    expect(r).toEqual({ confirmado: true, nomeEncontrado: 'Res X' });
    expect(sha({ system: chamada.system, tools: chamada.tools })).toBe(HASH_CONFIRMAR_VIVI);
  });
});

// Hash do JSON das tools/prompt da VIVI (nao alterados pelo book): se mudar, a VIVI mudou.
const HASH_TOOLS_VIVI = 'f951ed8b47d0d683cd878bdb8190fc5728a4a59e90b8aac965cc2fdd3ff0db57';
const HASH_CONFIRMAR_VIVI = 'c2dbc7923a6cf0f04be08b98931da5f95c050ff2b9342b67454029a55ccbd927';
