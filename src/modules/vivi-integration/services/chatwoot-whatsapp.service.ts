import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

export interface EnviarMensagemParams {
  telefone: string;
  mensagem: string;
  nomeContato?: string;
}

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
    const { telefone, mensagem, nomeContato } = params;
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
      await axios.post(
        `${this.baseUrl}/api/v1/accounts/${this.accountId}/conversations/${conversaId}/messages`,
        { content: mensagem, message_type: 'outgoing', private: false },
        { headers: this.headers },
      );
      this.logger.log(`Mensagem enviada para ${telefone} (conversa #${conversaId})`);
    } catch (err: any) {
      this.logger.error(`Erro ao enviar WhatsApp para ${telefone}: ${err?.response?.data?.message || err.message}`);
    }
  }
}
