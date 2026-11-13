import { CampanhaRepoFake } from '../../../../../test/campanhas/campanha-repo.fake';
import { CampanhaConfig } from '../services/campanha-config';
import { GeradorCodigoService } from '../services/gerador-codigo.service';
import { ProcessadorEnvioService, ERRO_INTERROMPIDO } from '../services/processador-envio.service';
import { EnviarSmsInput, ISmsProvider, SmsProviderError } from '../../domain/services/sms-provider.interface';
import { ILeitorPlanilhaContatos } from '../../domain/services/leitor-planilha.interface';
import {
  AtualizarCampanhaUseCase,
  CancelarCampanhaUseCase,
  CriarCampanhaUseCase,
  EnviarTesteUseCase,
  ExportarContatosUseCase,
  ImportarContatosUseCase,
  IniciarCampanhaUseCase,
  ListarCampanhasUseCase,
  ListarContatosUseCase,
  ObterCampanhaUseCase,
  PausarCampanhaUseCase,
  RegistrarOptoutManualUseCase,
} from './campanhas.use-cases';
import { ProcessarEventoSmsUseCase, RegistrarCliqueUseCase } from './publicos.use-cases';

const T1 = '11111111-1111-1111-1111-111111111111';
const T2 = '22222222-2222-2222-2222-222222222222';
const ADMIN = { tenantId: T1, requesterRole: 'Administrador', requesterUserId: 'u1', impersonadoPor: null };
const MSG = 'Oi {primeiro_nome}! Novolar Freguesia: Minha Casa Minha Vida com FGTS. Veja a tabela: {link} SAIR p/ parar';

class ProviderFake implements ISmsProvider {
  nome = 'Fake';
  simulado = false;
  ligado = true;
  enviados: EnviarSmsInput[] = [];
  falhar: ((i: EnviarSmsInput) => SmsProviderError | null) | null = null;
  disponivel() {
    return this.ligado;
  }
  async enviar(i: EnviarSmsInput) {
    const e = this.falhar?.(i);
    if (e) throw e;
    this.enviados.push(i);
    return { provedorMensagemId: `prov-${this.enviados.length}` };
  }
}

class ConfigFixa extends CampanhaConfig {
  agoraFixo = new Date('2026-11-16T14:00:00Z'); // segunda, 11h em SP
  get baseLink() {
    return 'https://gestordevendas.ivillar.com.br/r';
  }
  agora() {
    return this.agoraFixo;
  }
}

class LeitorFake implements ILeitorPlanilhaContatos {
  linhas: unknown[][] = [];
  async ler() {
    return this.linhas;
  }
}

function montar() {
  const repo = new CampanhaRepoFake();
  const provider = new ProviderFake();
  const config = new ConfigFixa();
  const leitor = new LeitorFake();
  const codigos = new GeradorCodigoService(repo);
  return {
    repo,
    provider,
    config,
    leitor,
    criar: new CriarCampanhaUseCase(repo, codigos),
    atualizar: new AtualizarCampanhaUseCase(repo),
    importar: new ImportarContatosUseCase(repo, leitor, codigos),
    obter: new ObterCampanhaUseCase(repo, provider, config),
    listar: new ListarCampanhasUseCase(repo),
    listarContatos: new ListarContatosUseCase(repo, config),
    exportar: new ExportarContatosUseCase(repo, config),
    teste: new EnviarTesteUseCase(repo, provider, config),
    iniciar: new IniciarCampanhaUseCase(repo, provider, config),
    pausar: new PausarCampanhaUseCase(repo),
    cancelar: new CancelarCampanhaUseCase(repo, config),
    optout: new RegistrarOptoutManualUseCase(repo, config),
    processador: new ProcessadorEnvioService(repo, provider, config),
    clique: new RegistrarCliqueUseCase(repo, config),
    evento: new ProcessarEventoSmsUseCase(repo, config),
  };
}

async function campanhaComContatos(s: ReturnType<typeof montar>, telefones = ['5511987654321', '5511977771234', '5521999990000']) {
  const c = await s.criar.execute({ ...ADMIN, nome: 'Repique Freguesia', mensagem: MSG, linkDestino: 'https://freguesia.ivillar.com.br' });
  s.leitor.linhas = [['nome', 'primeiro_nome', 'telefone', 'corretor'], ...telefones.map((t, i) => [`Cliente ${i}`, `Nome${i}`, t, 'Lucas'])];
  await s.importar.execute({ ...ADMIN, id: c.id, arquivo: Buffer.from('x'), nomeArquivo: 'a.xlsx', substituir: false });
  return c;
}

describe('permissoes', () => {
  it('so Administrador; impersonacao so le', async () => {
    const s = montar();
    await expect(s.listar.execute({ tenantId: T1, requesterRole: 'Corretor' })).rejects.toMatchObject({ status: 403 });
    await expect(
      s.criar.execute({ ...ADMIN, impersonadoPor: 'super', nome: 'x', mensagem: MSG, linkDestino: 'https://a.com' }),
    ).rejects.toMatchObject({ response: { code: 'CAMPANHA_SOMENTE_LEITURA' } });
  });

  it('isolamento de tenant: campanha de outro tenant = 404', async () => {
    const s = montar();
    const c = await s.criar.execute({ ...ADMIN, nome: 'A', mensagem: MSG, linkDestino: 'https://a.com' });
    await expect(s.obter.execute({ tenantId: T2, requesterRole: 'Administrador', id: c.id })).rejects.toMatchObject({ status: 404 });
    await expect(s.iniciar.execute({ ...ADMIN, tenantId: T2, id: c.id })).rejects.toMatchObject({ status: 404 });
  });
});

describe('criar / editar', () => {
  it('valida mensagem, link e config', async () => {
    const s = montar();
    await expect(s.criar.execute({ ...ADMIN, nome: 'x', mensagem: 'sem link', linkDestino: 'https://a.com' })).rejects.toMatchObject({ status: 400 });
    await expect(s.criar.execute({ ...ADMIN, nome: 'x', mensagem: MSG, linkDestino: 'http://a.com' })).rejects.toMatchObject({ status: 400 });
    await expect(s.criar.execute({ ...ADMIN, nome: 'x', mensagem: MSG, linkDestino: 'https://a.com', taxaPorMinuto: 1000 })).rejects.toMatchObject({
      status: 400,
    });
    const c = await s.criar.execute({ ...ADMIN, nome: ' Repique ', mensagem: MSG, linkDestino: 'https://a.com' });
    expect(c).toMatchObject({ nome: 'Repique', status: 'rascunho', maxSegmentos: 1, taxaPorMinuto: 30, janelaInicio: 9, janelaFim: 20 });
    expect(c.codigoTeste).toMatch(/^[A-Za-z0-9]{6}$/);
  });

  it('nao edita campanha enviando', async () => {
    const s = montar();
    const c = await campanhaComContatos(s);
    await s.iniciar.execute({ ...ADMIN, id: c.id });
    await expect(s.atualizar.execute({ ...ADMIN, id: c.id, nome: 'outro' })).rejects.toMatchObject({ status: 409 });
    await s.pausar.execute({ ...ADMIN, id: c.id });
    await expect(s.atualizar.execute({ ...ADMIN, id: c.id, nome: 'outro' })).resolves.toMatchObject({ nome: 'outro' });
  });
});

describe('importar', () => {
  it('conta importados, invalidos, duplicados e bloqueados (opt-out)', async () => {
    const s = montar();
    await s.repo.registrarOptout(T1, '5521999990000', 'manual');
    const c = await s.criar.execute({ ...ADMIN, nome: 'A', mensagem: MSG, linkDestino: 'https://a.com' });
    s.leitor.linhas = [
      ['nome', 'telefone'],
      ['Ana Maria', '11987654321'],
      ['Bia', '5521999990000'],
      ['Fixo', '1133334444'],
      ['Ana de novo', '+55 11 98765-4321'],
    ];
    const r = await s.importar.execute({ ...ADMIN, id: c.id, arquivo: Buffer.from('x'), nomeArquivo: 'a.csv', substituir: false });
    expect(r).toMatchObject({ linhasLidas: 4, importados: 1, bloqueados: 1, invalidos: 1, duplicados: 1, totalNaCampanha: 2 });
    // reimportar o mesmo arquivo nao duplica
    const r2 = await s.importar.execute({ ...ADMIN, id: c.id, arquivo: Buffer.from('x'), nomeArquivo: 'a.csv', substituir: false });
    expect(r2).toMatchObject({ importados: 0, duplicados: 3, totalNaCampanha: 2 });
    // codigos unicos e primeiro nome sem acento
    const cs = s.repo.contatos;
    expect(new Set(cs.map((x) => x.codigo)).size).toBe(2);
    expect(cs[0].primeiroNome).toBe('Ana');
  });

  it('substituir so em rascunho', async () => {
    const s = montar();
    const c = await campanhaComContatos(s);
    await s.iniciar.execute({ ...ADMIN, id: c.id });
    await s.pausar.execute({ ...ADMIN, id: c.id });
    await expect(s.importar.execute({ ...ADMIN, id: c.id, arquivo: Buffer.from('x'), nomeArquivo: 'a', substituir: true })).rejects.toMatchObject({
      status: 409,
    });
  });

  it('sem coluna de telefone -> 400', async () => {
    const s = montar();
    const c = await s.criar.execute({ ...ADMIN, nome: 'A', mensagem: MSG, linkDestino: 'https://a.com' });
    s.leitor.linhas = [['nome'], ['Ana']];
    await expect(s.importar.execute({ ...ADMIN, id: c.id, arquivo: Buffer.from('x'), nomeArquivo: 'a', substituir: false })).rejects.toMatchObject({
      status: 400,
    });
  });
});

describe('iniciar', () => {
  it('sem contatos -> 422; provedor desligado -> 503', async () => {
    const s = montar();
    const c = await s.criar.execute({ ...ADMIN, nome: 'A', mensagem: MSG, linkDestino: 'https://a.com' });
    await expect(s.iniciar.execute({ ...ADMIN, id: c.id })).rejects.toMatchObject({ response: { code: 'CAMPANHA_SEM_CONTATOS' } });
    s.provider.ligado = false;
    await expect(s.iniciar.execute({ ...ADMIN, id: c.id })).rejects.toMatchObject({ response: { code: 'SMS_PROVEDOR_INDISPONIVEL' } });
  });

  it('mensagem que passa de 1 SMS no pior caso -> 422 com o tamanho', async () => {
    const s = montar();
    const c = await campanhaComContatos(s);
    await s.atualizar.execute({ ...ADMIN, id: c.id, mensagem: `${MSG} ${'x'.repeat(60)}` });
    await expect(s.iniciar.execute({ ...ADMIN, id: c.id })).rejects.toMatchObject({ response: { code: 'CAMPANHA_MENSAGEM_LONGA' } });
    await s.atualizar.execute({ ...ADMIN, id: c.id, maxSegmentos: 2 });
    await expect(s.iniciar.execute({ ...ADMIN, id: c.id })).resolves.toMatchObject({ status: 'enviando', pendentes: 3 });
  });

  it('acento na mensagem vira UCS-2 e e detectado', async () => {
    const s = montar();
    const c = await campanhaComContatos(s);
    await s.atualizar.execute({ ...ADMIN, id: c.id, mensagem: 'Olá {primeiro_nome}, condições especiais no Novolar Freguesia! Veja {link}' });
    const d = await s.obter.execute({ ...ADMIN, id: c.id });
    expect(d.mensagemAnalise).toMatchObject({ codificacao: 'UCS2', cabe: false });
  });
});

describe('job de envio', () => {
  it('envia com link unico, conclui, e respeita a janela', async () => {
    const s = montar();
    const c = await campanhaComContatos(s);
    await s.iniciar.execute({ ...ADMIN, id: c.id });

    s.config.agoraFixo = new Date('2026-11-15T14:00:00Z'); // domingo
    expect((await s.processador.rodar()).enviados).toBe(0);

    s.config.agoraFixo = new Date('2026-11-16T14:00:00Z'); // segunda 11h
    const r = await s.processador.rodar();
    expect(r).toMatchObject({ enviados: 3, concluidas: 1 });
    const textos = s.provider.enviados.map((e) => e.texto);
    expect(textos[0]).toMatch(/^Oi Nome! .* https:\/\/gestordevendas\.ivillar\.com\.br\/r\/[A-Za-z0-9]{6} SAIR p\/ parar$/);
    expect(new Set(textos).size).toBe(3);
    expect((await s.repo.buscar(T1, c.id))!.status).toBe('concluida');
  });

  it('ritmo: 6/min = 2 por rodada', async () => {
    const s = montar();
    const c = await campanhaComContatos(s);
    await s.atualizar.execute({ ...ADMIN, id: c.id, taxaPorMinuto: 6 });
    await s.iniciar.execute({ ...ADMIN, id: c.id });
    expect((await s.processador.rodar()).enviados).toBe(2);
    expect((await s.processador.rodar()).enviados).toBe(1);
  });

  it('falha temporaria tenta de novo ate 3 vezes; permanente falha na hora', async () => {
    const s = montar();
    const c = await campanhaComContatos(s, ['5511987654321', '5511977771234']);
    await s.iniciar.execute({ ...ADMIN, id: c.id });
    s.provider.falhar = (i) =>
      i.para === '5511987654321' ? new SmsProviderError('timeout', true) : new SmsProviderError('HTTP 400', false);
    await s.processador.rodar();
    const [a, b] = s.repo.contatos;
    expect(a).toMatchObject({ status: 'pendente', tentativas: 1 });
    expect(b).toMatchObject({ status: 'falhou', erro: 'HTTP 400' });
    await s.processador.rodar();
    await s.processador.rodar();
    expect(a).toMatchObject({ status: 'falhou', tentativas: 3 });
    expect((await s.repo.buscar(T1, c.id))!.status).toBe('concluida');
  });

  it('opt-out feito depois da importacao bloqueia no envio', async () => {
    const s = montar();
    const c = await campanhaComContatos(s);
    await s.iniciar.execute({ ...ADMIN, id: c.id });
    await s.repo.registrarOptout(T1, '5511977771234', 'manual');
    const r = await s.processador.rodar();
    expect(r).toMatchObject({ enviados: 2, bloqueados: 1 });
  });

  it('contato preso em "enviando" vira falha no boot (nunca reenvia)', async () => {
    const s = montar();
    const c = await campanhaComContatos(s);
    await s.iniciar.execute({ ...ADMIN, id: c.id });
    await s.repo.reservar(s.repo.contatos[0].id);
    expect(await s.processador.recuperarTravados()).toBe(1);
    expect(s.repo.contatos[0]).toMatchObject({ status: 'falhou', erro: ERRO_INTERROMPIDO });
  });

  it('pausada nao envia; cancelar marca pendentes como cancelado', async () => {
    const s = montar();
    const c = await campanhaComContatos(s);
    await s.iniciar.execute({ ...ADMIN, id: c.id });
    await s.pausar.execute({ ...ADMIN, id: c.id });
    expect((await s.processador.rodar()).enviados).toBe(0);
    expect(await s.cancelar.execute({ ...ADMIN, id: c.id })).toMatchObject({ status: 'cancelada', cancelados: 3 });
  });
});

describe('teste, clique, webhook e exportacao', () => {
  it('SMS de teste usa o link de teste (redireciona sem contar)', async () => {
    const s = montar();
    const c = await campanhaComContatos(s);
    const r = await s.teste.execute({ ...ADMIN, id: c.id, telefone: '(11) 96666-1234' });
    expect(r.texto).toContain(`/r/${c.codigoTeste}`);
    expect(s.provider.enviados[0].para).toBe('5511966661234');
    const destino = await s.clique.execute({ codigo: c.codigoTeste, contar: true });
    expect(destino).toMatch(/^https:\/\/freguesia\.ivillar\.com\.br\/\?c=/);
    expect(s.repo.contatos.every((x) => x.cliques === 0)).toBe(true);
    await expect(s.teste.execute({ ...ADMIN, id: c.id, telefone: '1133334444' })).rejects.toMatchObject({ status: 400 });
  });

  it('clique conta, HEAD nao conta, codigo invalido -> null', async () => {
    const s = montar();
    await campanhaComContatos(s);
    const ct = s.repo.contatos[0];
    expect(await s.clique.execute({ codigo: ct.codigo, contar: false })).toContain(`c=${ct.codigo}`);
    expect(ct.cliques).toBe(0);
    await s.clique.execute({ codigo: ct.codigo, contar: true });
    await s.clique.execute({ codigo: ct.codigo, contar: true });
    expect(ct.cliques).toBe(2);
    expect(await s.clique.execute({ codigo: 'zzzzzz', contar: true })).toBeNull();
    expect(await s.clique.execute({ codigo: '../../x', contar: true })).toBeNull();
  });

  it('webhook: entrega, resposta e SAIR (opt-out nos tenants que mandaram)', async () => {
    const s = montar();
    const c = await campanhaComContatos(s);
    await s.iniciar.execute({ ...ADMIN, id: c.id });
    await s.processador.rodar();
    const [a, b] = s.repo.contatos;
    await s.evento.execute({ tipo: 'status', provedorMensagemId: a.provedorMensagemId!, status: 'entregue' });
    expect(a.status).toBe('entregue');
    await s.evento.execute({ tipo: 'resposta', de: '5511977771234', texto: 'Quero saber o valor' });
    expect(b).toMatchObject({ respostaTexto: 'Quero saber o valor', status: 'enviado' });
    await s.evento.execute({ tipo: 'resposta', de: '+55 11 98765-4321', texto: 'SAIR' });
    expect(a).toMatchObject({ status: 'optout' });
    expect(await s.repo.telefonesEmOptout(T1, ['5511987654321'])).toEqual(new Set(['5511987654321']));
    expect(await s.repo.telefonesEmOptout(T2, ['5511987654321'])).toEqual(new Set());
  });

  it('exportacao CSV filtra quem clicou e protege contra formula', async () => {
    const s = montar();
    const c = await s.criar.execute({ ...ADMIN, nome: 'Repique Freguesia', mensagem: MSG, linkDestino: 'https://a.com' });
    s.leitor.linhas = [['nome', 'telefone'], ['=HYPERLINK("mal")', '11987654321'], ['Bia', '11977771234']];
    await s.importar.execute({ ...ADMIN, id: c.id, arquivo: Buffer.from('x'), nomeArquivo: 'a', substituir: false });
    await s.clique.execute({ codigo: s.repo.contatos[0].codigo, contar: true });
    const r = await s.exportar.execute({ ...ADMIN, id: c.id, filtro: 'clicou' });
    expect(r.nomeArquivo).toBe('Repique_Freguesia_clicou.csv');
    const linhas = r.conteudo.trim().split('\r\n');
    expect(linhas).toHaveLength(2);
    expect(linhas[1]).toContain(`"'=HYPERLINK(""mal"")"`);
  });

  it('opt-out manual marca pendentes; lista de contatos pagina e busca', async () => {
    const s = montar();
    const c = await campanhaComContatos(s);
    expect(await s.optout.execute({ ...ADMIN, telefone: '11 97777-1234' })).toMatchObject({ contatosPendentesMarcados: 1 });
    const l = await s.listarContatos.execute({ ...ADMIN, id: c.id, busca: '7777' });
    expect(l.total).toBe(1);
    expect(l.itens[0]).toMatchObject({ status: 'optout', telefoneFormatado: '+55 (11) 97777-1234' });
    expect(l.itens[0]).not.toHaveProperty('tenantId');
  });
});
