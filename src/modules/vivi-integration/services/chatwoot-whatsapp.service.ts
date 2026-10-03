import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { converterMensagens, mesmoTelefone, MensagemHistorico } from './historico-chatwoot';

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

@Injectable()
export class ChatwootWhatsappService {
  private readonly logger = new Logger(ChatwootWhatsappService.name);
  private readonly baseUrl: string;
  private readonly token: string;
  private readonly accountId: string;
  private readonly inboxId: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get<string>('CHATWOOT_URL', 'https://chatwoot.ivillar.com.br');
    this.token = this.config.get<string>('CHATWOOT_API_TOKEN', '');
    this.accountId = this.config.get<string>('CHATWOOT_ACCOUNT_ID', '1');
    this.inboxId = this.config.get<string>('CHATWOOT_INBOX_ID', '1');
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

  // Fatia 3 (WhatsApp do corretor): historico da conversa da VIVI com o
  // cliente, SO LEITURA (apenas GET na API do Chatwoot - nada e enviado,
  // atribuido ou alterado). Procura o contato pelo telefone em toda a conta
  // (a VIVI atende em outra caixa, diferente da usada nos avisos ao
  // corretor) e devolve as mensagens da conversa mais recente.
  async historicoPorTelefone(telefone: string): Promise<{
    encontrado: boolean;
    conversaUrl: string | null;
    status: string | null;
    mensagens: MensagemHistorico[];
  }> {
    const vazio = { encontrado: false, conversaUrl: null, status: null, mensagens: [] };
    if (!this.token) return vazio;
    const base = `${this.baseUrl}/api/v1/accounts/${this.accountId}`;
    const busca = await axios.get(`${base}/contacts/search`, {
      headers: this.headers,
      params: { q: `+${telefone.replace(/\D/g, '')}`, page: 1 },
      timeout: 8000,
    });
    const contatos = (busca.data?.payload ?? []).filter((c: any) => mesmoTelefone(c.phone_number, telefone));
    let maisRecente: any = null;
    for (const contato of contatos.slice(0, 3)) {
      const resp = await axios.get(`${base}/contacts/${contato.id}/conversations`, { headers: this.headers, timeout: 8000 });
      for (const conversa of resp.data?.payload ?? []) {
        const ultima = conversa.last_activity_at ?? conversa.timestamp ?? 0;
        if (!maisRecente || ultima > (maisRecente.last_activity_at ?? maisRecente.timestamp ?? 0)) maisRecente = conversa;
      }
    }
    if (!maisRecente) return vazio;
    const msgs = await axios.get(`${base}/conversations/${maisRecente.id}/messages`, { headers: this.headers, timeout: 8000 });
    return {
      encontrado: true,
      conversaUrl: `${this.baseUrl}/app/accounts/${this.accountId}/conversations/${maisRecente.id}`,
      status: maisRecente.status ?? null,
      mensagens: converterMensagens(msgs.data?.payload ?? []),
    };
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
