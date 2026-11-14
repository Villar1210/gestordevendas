import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  ConversaChatwoot,
  conversaAtiva,
  converterMensagens,
  mesmoTelefone,
  MensagemHistorico,
  selecionarConversas,
} from './historico-chatwoot';

export interface EnviarMensagemParams {
  telefone: string;
  mensagem: string;
  nomeContato?: string;
  // Etiquetas adicionadas a conversa no Chatwoot (somadas as que ja existem).
  etiquetas?: string[];
  // Confere alguns segundos depois se o WhatsApp aceitou a mensagem. A API
  // oficial da Meta recusa mensagem livre fora da janela de 24h, e essa
  // recusa so aparece depois do POST (status "failed") - sem isso a falha
  // era silenciosa.
  verificarEntrega?: boolean;
}

const ESPERA_VERIFICACAO_MS = 5000;
const TIMEOUT_MS = 8000;
// Teto do Chatwoot para after+before numa chamada so (MessageFinder: 1000).
const ID_MAXIMO_MENSAGEM = 2_147_483_647;

export type ResultadoPassagem =
  | { ok: true; conversaId: number }
  | { ok: false; motivo: 'nao_configurado' | 'sem_conversa_ativa' | 'erro'; detalhe?: string };

@Injectable()
export class ChatwootWhatsappService {
  private readonly logger = new Logger(ChatwootWhatsappService.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly accountId: string;
  private readonly inboxId: string;
  // Etapa 1 (14/11/2026): caixa do numero OFICIAL (onde a VIVI conversa com
  // os clientes). CHATWOOT_INBOX_ID continua sendo a caixa dos avisos internos
  // (corretores/gestao). Sem esta variavel, o historico le todas as caixas e a
  // passagem para humano fica desligada.
  private readonly inboxOficialId: number | null;
  private idContaServico: Promise<number> | null = null;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('CHATWOOT_URL', 'https://chatwoot.ivillar.com.br');
    this.token = this.config.get<string>('CHATWOOT_API_TOKEN', '');
    this.accountId = this.config.get<string>('CHATWOOT_ACCOUNT_ID', '1');
    this.inboxId = this.config.get<string>('CHATWOOT_INBOX_ID', '1');
    const oficial = Number(this.config.get<string>('CHATWOOT_INBOX_OFICIAL_ID', ''));
    this.inboxOficialId = Number.isInteger(oficial) && oficial > 0 ? oficial : null;
  }

  private get base(): string {
    return `${this.baseUrl}/api/v1/accounts/${this.accountId}`;
  }

  private get headers() {
    return { 'api_access_token': this.token, 'Content-Type': 'application/json' };
  }

  async obterOuCriarContato(telefone: string, nome?: string): Promise<number> {
    const phoneFormatted = `+${telefone}`;
    try {
      const busca = await axios.get(
        `${this.baseUrl}/api/v1/accounts/${this.accountId}/contacts/search`,
        { headers: this.headers, params: { q: phoneFormatted, page: 1 } },
      );
      if (busca.data?.payload?.length > 0) return busca.data.payload[0].id;
    } catch (err: any) {
      this.logger.warn(`Falha ao buscar contato ${telefone}: ${err.message}`);
    }
    const criacao = await axios.post(
      `${this.baseUrl}/api/v1/accounts/${this.accountId}/contacts`,
      { name: nome || telefone, phone_number: phoneFormatted, identifier: telefone },
      { headers: this.headers },
    );
    return criacao.data.id;
  }

  async obterConversaAtiva(contatoId: number): Promise<number | null> {
    try {
      const resp = await axios.get(
        `${this.baseUrl}/api/v1/accounts/${this.accountId}/contacts/${contatoId}/conversations`,
        { headers: this.headers },
      );
      const conversas = resp.data?.payload ?? [];
      const ativa = conversas.find(
        (c: any) =>
          c.inbox_id === Number(this.inboxId) &&
          (c.status === 'open' || c.status === 'pending'),
      );
      return ativa ? ativa.id : null;
    } catch (err: any) {
      this.logger.warn(`Falha ao buscar conversas do contato ${contatoId}: ${err.message}`);
      return null;
    }
  }

  async enviarMensagem(params: EnviarMensagemParams): Promise<void> {
    const { telefone, mensagem, nomeContato, etiquetas, verificarEntrega } = params;
    try {
      const contatoId = await this.obterOuCriarContato(telefone, nomeContato);
      let conversaId = await this.obterConversaAtiva(contatoId);
      if (!conversaId) {
        const conversa = await axios.post(
          `${this.baseUrl}/api/v1/accounts/${this.accountId}/conversations`,
          { contact_id: contatoId, inbox_id: Number(this.inboxId), status: 'open' },
          { headers: this.headers },
        );
        conversaId = conversa.data.id;
      }
      const enviada = await axios.post(
        `${this.baseUrl}/api/v1/accounts/${this.accountId}/conversations/${conversaId}/messages`,
        { content: mensagem, message_type: 'outgoing', private: false },
        { headers: this.headers },
      );
      this.logger.log(`Mensagem enviada para ${telefone} (conversa #${conversaId})`);

      if (etiquetas?.length) {
        await this.adicionarEtiquetas(conversaId!, etiquetas);
      }
      if (verificarEntrega && enviada.data?.id) {
        setTimeout(() => {
          this.verificarEntrega(conversaId!, enviada.data.id, telefone).catch(() => {});
        }, ESPERA_VERIFICACAO_MS).unref?.();
      }
    } catch (err: any) {
      this.logger.error(`Erro ao enviar WhatsApp para ${telefone}: ${err?.response?.data?.message || err.message}`);
    }
  }

  // Historico da conversa da VIVI (e de atendentes) com o cliente, SO LEITURA
  // (apenas GET na API do Chatwoot). Etapa 1 (14/11/2026): junta TODAS as
  // conversas do telefone na caixa oficial (a caixa cria uma conversa nova a
  // cada retorno do cliente), ate MAX_CONVERSAS_HISTORICO, em ordem de tempo.
  async historicoPorTelefone(telefone: string): Promise<{
    encontrado: boolean;
    conversaUrl: string | null;
    status: string | null;
    mensagens: MensagemHistorico[];
  }> {
    const vazio = { encontrado: false, conversaUrl: null, status: null, mensagens: [] };
    if (!this.token) return vazio;
    const conversas = selecionarConversas(await this.conversasDoTelefone(telefone), this.inboxOficialId);
    if (conversas.length === 0) return vazio;
    const brutas: unknown[] = [];
    for (const conversa of conversas) {
      const msgs = await axios.get(`${this.base}/conversations/${conversa.id}/messages`, {
        headers: this.headers,
        params: { after: 0, before: ID_MAXIMO_MENSAGEM },
        timeout: TIMEOUT_MS,
      });
      brutas.push(...(msgs.data?.payload ?? []));
    }
    const maisRecente = conversas[conversas.length - 1];
    return {
      encontrado: true,
      conversaUrl: `${this.baseUrl}/app/accounts/${this.accountId}/conversations/${maisRecente.id}`,
      status: maisRecente.status ?? null,
      mensagens: converterMensagens(brutas as Parameters<typeof converterMensagens>[0]),
    };
  }

  // Etapa 1 (14/11/2026): passa a conversa em andamento do cliente, na caixa
  // oficial, para a conta de servico "Gestor de Vendas" e marca como aberta.
  // Validado em producao (conversa #59): a VIVI para de responder e os
  // lembretes automaticos dela sao cancelados. Nunca lanca erro: devolve o
  // motivo para quem chamou decidir (ex.: avisar a gestao).
  async passarParaHumano(telefone: string): Promise<ResultadoPassagem> {
    if (!this.token || this.inboxOficialId === null) return { ok: false, motivo: 'nao_configurado' };
    try {
      const ativa = conversaAtiva(await this.conversasDoTelefone(telefone), this.inboxOficialId);
      if (!ativa) return { ok: false, motivo: 'sem_conversa_ativa' };
      const assigneeId = await this.idDaContaDeServico();
      const conversa = `${this.base}/conversations/${ativa.id}`;
      await axios.post(`${conversa}/assignments`, { assignee_id: assigneeId }, { headers: this.headers, timeout: TIMEOUT_MS });
      await axios.post(`${conversa}/toggle_status`, { status: 'open' }, { headers: this.headers, timeout: TIMEOUT_MS });
      this.logger.log(`Conversa #${ativa.id} passada para atendimento humano (Gestor de Vendas).`);
      return { ok: true, conversaId: ativa.id };
    } catch (err: any) {
      const detalhe = err?.response?.status ? `HTTP ${err.response.status}` : err?.message ?? 'erro';
      this.logger.error(`Falha ao passar conversa para humano: ${detalhe}`);
      return { ok: false, motivo: 'erro', detalhe };
    }
  }

  // Conversas (todas as caixas) dos contatos com este telefone.
  private async conversasDoTelefone(telefone: string): Promise<ConversaChatwoot[]> {
    const digitos = telefone.replace(/\D/g, '');
    const busca = await axios.get(`${this.base}/contacts/search`, {
      headers: this.headers,
      params: { q: `+${digitos}`, page: 1 },
      timeout: TIMEOUT_MS,
    });
    const contatos = (busca.data?.payload ?? []).filter((c: any) => mesmoTelefone(c.phone_number, digitos));
    const conversas: ConversaChatwoot[] = [];
    for (const contato of contatos.slice(0, 3)) {
      const resp = await axios.get(`${this.base}/contacts/${contato.id}/conversations`, {
        headers: this.headers,
        timeout: TIMEOUT_MS,
      });
      conversas.push(...(resp.data?.payload ?? []));
    }
    return conversas;
  }

  // Id do usuario dono do token (a conta de servico). Guardado em memoria;
  // se a consulta falhar, tenta de novo na proxima vez.
  private idDaContaDeServico(): Promise<number> {
    if (!this.idContaServico) {
      this.idContaServico = axios
        .get(`${this.baseUrl}/api/v1/profile`, { headers: this.headers, timeout: TIMEOUT_MS })
        .then((r) => {
          const id = Number(r.data?.id);
          if (!Number.isInteger(id) || id <= 0) throw new Error('perfil sem id');
          return id;
        })
        .catch((err) => {
          this.idContaServico = null;
          throw err;
        });
    }
    return this.idContaServico;
  }

  private async adicionarEtiquetas(conversaId: number, etiquetas: string[]): Promise<void> {
    const url = `${this.baseUrl}/api/v1/accounts/${this.accountId}/conversations/${conversaId}/labels`;
    try {
      // O POST de labels SUBSTITUI a lista - soma com as atuais para nao
      // apagar etiquetas colocadas manualmente no Chatwoot.
      const atuais = await axios.get(url, { headers: this.headers });
      const lista: string[] = atuais.data?.payload ?? [];
      const novas = [...new Set([...lista, ...etiquetas])];
      if (novas.length !== lista.length) {
        await axios.post(url, { labels: novas }, { headers: this.headers });
      }
    } catch (err: any) {
      this.logger.warn(`Falha ao etiquetar conversa #${conversaId}: ${err?.response?.data?.message || err.message}`);
    }
  }

  private async verificarEntrega(conversaId: number, mensagemId: number, telefone: string): Promise<void> {
    try {
      const resp = await axios.get(
        `${this.baseUrl}/api/v1/accounts/${this.accountId}/conversations/${conversaId}/messages`,
        { headers: this.headers },
      );
      const msg = (resp.data?.payload ?? []).find((m: any) => m.id === mensagemId);
      if (msg?.status === 'failed') {
        const motivo = msg.content_attributes?.external_error || 'motivo nao informado';
        this.logger.error(
          `WhatsApp RECUSOU a mensagem para ${telefone} (conversa #${conversaId}): ${motivo}. ` +
            'Se for a janela de 24h da Meta, e preciso um modelo de mensagem aprovado.',
        );
      }
    } catch (err: any) {
      this.logger.warn(`Nao foi possivel verificar a entrega para ${telefone}: ${err.message}`);
    }
  }
}
