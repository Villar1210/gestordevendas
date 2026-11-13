// test/campanhas/campanha-repo.fake.ts
// Repositorio em memoria com o MESMO comportamento condicional do Prisma
// (updateMany por status), para os testes de caso de uso e do job.
import { randomUUID } from 'crypto';
import {
  AlteracaoCampanha,
  CampanhaRecord,
  ContatoParaClique,
  ContatoRecente,
  ContatoRecord,
  Contagens,
  FiltroContatos,
  ICampanhaRepository,
  NovaCampanha,
  NovoContato,
} from '../../src/modules/campanhas_sms/domain/repositories/campanha-repository.interface';
import { STATUS_CONTATO, StatusCampanha, StatusContato } from '../../src/modules/campanhas_sms/domain/services/campanha-regras';

export class CampanhaRepoFake implements ICampanhaRepository {
  campanhas: CampanhaRecord[] = [];
  contatos: ContatoRecord[] = [];
  optouts: { tenantId: string; telefone: string; origem: string; createdAt: Date }[] = [];

  async criar(d: NovaCampanha): Promise<CampanhaRecord> {
    const agora = new Date();
    const c: CampanhaRecord = { ...d, id: randomUUID(), status: 'rascunho', iniciadaEm: null, concluidaEm: null, createdAt: agora, updatedAt: agora };
    this.campanhas.push(c);
    return { ...c };
  }
  async buscar(tenantId: string, id: string) {
    const c = this.campanhas.find((x) => x.tenantId === tenantId && x.id === id);
    return c ? { ...c } : null;
  }
  async listar(tenantId: string, limite: number) {
    return this.campanhas.filter((c) => c.tenantId === tenantId).slice(0, limite).map((c) => ({ ...c }));
  }
  async contarCampanhas(tenantId: string) {
    return this.campanhas.filter((c) => c.tenantId === tenantId).length;
  }
  async atualizar(tenantId: string, id: string, dados: AlteracaoCampanha, statusPermitidos: StatusCampanha[]) {
    const c = this.campanhas.find((x) => x.tenantId === tenantId && x.id === id && statusPermitidos.includes(x.status));
    if (!c) return false;
    Object.assign(c, dados, { updatedAt: new Date() });
    return true;
  }
  async mudarStatus(tenantId: string, id: string, de: StatusCampanha[], para: StatusCampanha, extra: { iniciadaEm?: Date; concluidaEm?: Date } = {}) {
    const c = this.campanhas.find((x) => x.tenantId === tenantId && x.id === id && de.includes(x.status));
    if (!c) return false;
    Object.assign(c, { status: para }, extra);
    return true;
  }
  async contagens(ids: string[]) {
    const mapa = new Map<string, Contagens>();
    for (const id of ids) {
      const base = Object.fromEntries(STATUS_CONTATO.map((s) => [s, 0])) as Record<StatusContato, number>;
      const cs = this.contatos.filter((c) => c.campanhaId === id);
      for (const c of cs) base[c.status]++;
      mapa.set(id, {
        ...base,
        total: cs.length,
        comClique: cs.filter((c) => c.cliques > 0).length,
        cliquesTotais: cs.reduce((s, c) => s + c.cliques, 0),
        comResposta: cs.filter((c) => c.respondidoEm).length,
      });
    }
    return mapa;
  }
  async contarContatos(campanhaId: string) {
    return this.contatos.filter((c) => c.campanhaId === campanhaId).length;
  }
  async telefonesDaCampanha(campanhaId: string) {
    return new Set(this.contatos.filter((c) => c.campanhaId === campanhaId).map((c) => c.telefone));
  }
  async inserirContatos(tenantId: string, campanhaId: string, novos: NovoContato[]) {
    let n = 0;
    for (const d of novos) {
      if (this.contatos.some((c) => c.campanhaId === campanhaId && c.telefone === d.telefone)) continue;
      if (this.contatos.some((c) => c.codigo === d.codigo)) continue;
      this.contatos.push({
        ...d,
        id: randomUUID(),
        campanhaId,
        tenantId,
        tentativas: 0,
        provedorMensagemId: null,
        erro: null,
        enviadoEm: null,
        entregueEm: null,
        cliques: 0,
        primeiroCliqueEm: null,
        ultimoCliqueEm: null,
        respostaTexto: null,
        respondidoEm: null,
        optoutEm: null,
        createdAt: new Date(Date.now() + n),
      });
      n++;
    }
    return n;
  }
  async apagarContatos(tenantId: string, campanhaId: string) {
    const antes = this.contatos.length;
    this.contatos = this.contatos.filter((c) => !(c.tenantId === tenantId && c.campanhaId === campanhaId));
    return antes - this.contatos.length;
  }
  private filtrar(tenantId: string, campanhaId: string, f: FiltroContatos) {
    return this.contatos.filter(
      (c) =>
        c.tenantId === tenantId &&
        c.campanhaId === campanhaId &&
        (!f.status || c.status === f.status) &&
        (!f.somenteClicou || c.cliques > 0) &&
        (!f.somenteRespondeu || c.respondidoEm) &&
        (!f.busca || c.nome.toLowerCase().includes(f.busca.toLowerCase()) || c.telefone.includes(f.busca.replace(/\D/g, '') || '§')),
    );
  }
  async listarContatos(tenantId: string, campanhaId: string, f: FiltroContatos, pagina: number, porPagina: number) {
    const todos = this.filtrar(tenantId, campanhaId, f);
    return { itens: todos.slice((pagina - 1) * porPagina, pagina * porPagina).map((c) => ({ ...c })), total: todos.length };
  }
  async contatosParaExportar(tenantId: string, campanhaId: string, f: FiltroContatos, limite: number) {
    return this.filtrar(tenantId, campanhaId, f).slice(0, limite).map((c) => ({ ...c }));
  }
  async maiorPrimeiroNome(campanhaId: string) {
    return this.contatos
      .filter((c) => c.campanhaId === campanhaId && c.status === 'pendente')
      .reduce((m, c) => (c.primeiroNome.length > m.length ? c.primeiroNome : m), '');
  }
  async cancelarPendentes(campanhaId: string) {
    let n = 0;
    for (const c of this.contatos) if (c.campanhaId === campanhaId && c.status === 'pendente') (c.status = 'cancelado'), n++;
    return n;
  }
  async codigosEmUso(codigos: string[]) {
    const usados = new Set([...this.contatos.map((c) => c.codigo), ...this.campanhas.map((c) => c.codigoTeste)]);
    return new Set(codigos.filter((c) => usados.has(c)));
  }
  async listarOptouts(tenantId: string, limite: number) {
    return this.optouts.filter((o) => o.tenantId === tenantId).slice(0, limite).map(({ telefone, origem, createdAt }) => ({ telefone, origem, createdAt }));
  }
  async telefonesEmOptout(tenantId: string, telefones: string[]) {
    return new Set(this.optouts.filter((o) => o.tenantId === tenantId && telefones.includes(o.telefone)).map((o) => o.telefone));
  }
  async registrarOptout(tenantId: string, telefone: string, origem: 'resposta' | 'manual' | 'importacao') {
    if (!this.optouts.some((o) => o.tenantId === tenantId && o.telefone === telefone)) this.optouts.push({ tenantId, telefone, origem, createdAt: new Date() });
  }
  async marcarOptoutPendentes(tenantId: string, telefone: string, quando: Date) {
    let n = 0;
    for (const c of this.contatos) if (c.tenantId === tenantId && c.telefone === telefone && c.status === 'pendente') (c.status = 'optout'), (c.optoutEm = quando), n++;
    return n;
  }
  async campanhasEnviando() {
    return this.campanhas.filter((c) => c.status === 'enviando').map((c) => ({ ...c }));
  }
  async pendentes(campanhaId: string, limite: number) {
    return this.contatos.filter((c) => c.campanhaId === campanhaId && c.status === 'pendente').slice(0, limite).map((c) => ({ ...c }));
  }
  private um(id: string) {
    return this.contatos.find((c) => c.id === id)!;
  }
  async reservar(id: string) {
    const c = this.um(id);
    if (c.status !== 'pendente') return false;
    c.status = 'enviando';
    c.tentativas++;
    return true;
  }
  async marcarEnviado(id: string, prov: string, quando: Date) {
    const c = this.um(id);
    if (c.status === 'enviando') Object.assign(c, { status: 'enviado', provedorMensagemId: prov, enviadoEm: quando, erro: null });
  }
  async devolverPendente(id: string, erro: string) {
    const c = this.um(id);
    if (c.status === 'enviando') Object.assign(c, { status: 'pendente', erro });
  }
  async marcarFalhou(id: string, erro: string) {
    const c = this.um(id);
    if (c.status === 'enviando') Object.assign(c, { status: 'falhou', erro });
  }
  async marcarBloqueado(id: string) {
    const c = this.um(id);
    if (c.status === 'pendente') c.status = 'bloqueado';
  }
  async existeAEnviar(campanhaId: string) {
    return this.contatos.some((c) => c.campanhaId === campanhaId && (c.status === 'pendente' || c.status === 'enviando'));
  }
  async falharTravados(erro: string) {
    let n = 0;
    for (const c of this.contatos) if (c.status === 'enviando') Object.assign(c, { status: 'falhou', erro }), n++;
    return n;
  }
  async contatoPorCodigo(codigo: string): Promise<ContatoParaClique | null> {
    const c = this.contatos.find((x) => x.codigo === codigo);
    if (!c) return null;
    const camp = this.campanhas.find((x) => x.id === c.campanhaId)!;
    return { contatoId: c.id, campanhaId: c.campanhaId, linkDestino: camp.linkDestino };
  }
  async campanhaPorCodigoTeste(codigo: string) {
    const c = this.campanhas.find((x) => x.codigoTeste === codigo);
    return c ? { id: c.id, linkDestino: c.linkDestino } : null;
  }
  async registrarClique(id: string, quando: Date) {
    const c = this.um(id);
    c.cliques++;
    c.ultimoCliqueEm = quando;
    c.primeiroCliqueEm ??= quando;
  }
  async atualizarEntrega(prov: string, status: 'entregue' | 'falhou' | 'enviado', quando: Date, erro?: string) {
    let n = 0;
    for (const c of this.contatos) {
      if (c.provedorMensagemId !== prov) continue;
      if (status === 'entregue' && (c.status === 'enviado' || c.status === 'falhou')) Object.assign(c, { status: 'entregue', entregueEm: quando, erro: null }), n++;
      if (status === 'falhou' && c.status === 'enviado') Object.assign(c, { status: 'falhou', erro }), n++;
    }
    return n;
  }
  async contatosRecentesDoTelefone(telefone: string, desde: Date): Promise<ContatoRecente[]> {
    return this.contatos
      .filter((c) => c.telefone === telefone && c.enviadoEm && c.enviadoEm >= desde)
      .map((c) => ({ id: c.id, tenantId: c.tenantId, campanhaId: c.campanhaId, enviadoEm: c.enviadoEm! }));
  }
  async registrarResposta(id: string, texto: string, quando: Date, optout: boolean) {
    const c = this.um(id);
    c.respostaTexto = texto || null;
    c.respondidoEm = quando;
    if (optout) Object.assign(c, { status: 'optout', optoutEm: quando });
  }
}
