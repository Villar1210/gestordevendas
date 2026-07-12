// src/modules/whatsappmarketing/infra/providers/baileys-whatsapp-provider.ts
// Camada de INFRA: adapta o contrato de dominio (IWhatsAppProvider) para a
// biblioteca nao-oficial Baileys (conexao via QR Code). Ver CLAUDE.md
// "Decisao tecnica: Integracao WhatsApp" - nao misturar com a API oficial da Meta.
import { Injectable, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as util from 'util';
import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  getContentType,
  DisconnectReason,
  WASocket,
} from 'baileys';
import { Boom } from '@hapi/boom';
import { pino } from 'pino';
import * as QRCode from 'qrcode';
import { IWhatsAppProvider } from '../../domain/services/whatsapp-provider.interface';
import { IWhatsAppSessionRepository } from '../../domain/repositories/whatsapp-session-repository.interface';
import { IWhatsAppMessageRepository } from '../../domain/repositories/whatsapp-message-repository.interface';

const SESSIONS_FOLDER = '.whatsapp-sessions';

@Injectable()
export class BaileysWhatsAppProvider implements IWhatsAppProvider {
  private readonly sockets = new Map<string, WASocket>();
  private readonly latestQr = new Map<string, string>();
  private readonly logger = pino({ level: 'silent' });

  constructor(
    @Inject('IWhatsAppSessionRepository')
    private readonly sessionRepository: IWhatsAppSessionRepository,
    @Inject('IWhatsAppMessageRepository')
    private readonly messageRepository: IWhatsAppMessageRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createSession(sessionId: string): Promise<void> {
    await this.connect(sessionId);
  }

  private async connect(sessionId: string): Promise<void> {
    const { state, saveCreds } = await useMultiFileAuthState(
      path.join(SESSIONS_FOLDER, sessionId),
    );

    // Baileys embute uma versao padrao do protocolo WhatsApp Web que fica
    // desatualizada rapidamente e causa erro 405 "Connection Failure" na Meta.
    // Buscar a versao mais recente evita esse problema.
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      auth: state,
      logger: this.logger,
      version,
    });

    this.sockets.set(sessionId, sock);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      if (update.qr) {
        this.latestQr.set(sessionId, update.qr);
      }

      if (update.connection === 'open') {
        this.latestQr.delete(sessionId);
        const phoneNumber = sock.user?.id?.split(':')[0] ?? null;
        await this.sessionRepository.updateStatus(sessionId, 'CONNECTED', phoneNumber);
      }

      if (update.connection === 'close') {
        this.latestQr.delete(sessionId);
        this.sockets.delete(sessionId);

        const statusCode = (update.lastDisconnect?.error as Boom | undefined)?.output
          ?.statusCode;

        // Excecao estreita (decisao confirmada): o proprio Baileys forca um
        // stream:error 515 "restart required" logo apos o primeiro pareamento
        // via QR ser bem-sucedido -- sem reconectar essa UMA vez usando as
        // credenciais ja salvas, o login nunca completa. Qualquer outro
        // motivo de queda continua sem reconexao automatica.
        if (statusCode === DisconnectReason.restartRequired) {
          await this.connect(sessionId);
          return;
        }

        await this.sessionRepository.updateStatus(sessionId, 'DISCONNECTED');
      }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
      for (const msg of messages) {
        // So registra mensagens recebidas (IN). Envios (OUT) sao gravados em sendMessage.
        if (!msg.message || msg.key.fromMe) continue;

        const remoteJid = msg.key.remoteJid;
        if (!remoteJid) continue;

        // So salva conversas 1:1 reais. Ignora grupos (@g.us) e
        // atualizacoes de status/stories (@broadcast). Qualquer outro
        // formato (@s.whatsapp.net ou @lid, o identificador mais novo
        // usado pelo WhatsApp por privacidade) e tratado como 1:1 valido.
        if (remoteJid.endsWith('@g.us') || remoteJid.endsWith('@broadcast')) continue;

        // Filtra por TIPO de conteudo, nao so pelo JID: mensagens de
        // protocolo/sistema (ex: senderKeyDistributionMessage, usadas na
        // troca de chaves de criptografia entre dispositivos) chegam via
        // messages.upsert com msg.message preenchido mas sem texto real,
        // e podem vir com um remoteJid que nao bate com nenhum sufixo
        // conhecido de grupo/status. So aceitamos tipos de texto de fato.
        const contentType = getContentType(msg.message);
        if (contentType !== 'conversation' && contentType !== 'extendedTextMessage') {
          continue;
        }

        const session = await this.sessionRepository.findById(sessionId);
        if (!session) continue;

        const body =
          msg.message.conversation || msg.message.extendedTextMessage?.text || '';
        const timestampSeconds =
          typeof msg.messageTimestamp === 'number'
            ? msg.messageTimestamp
            : Number(msg.messageTimestamp || 0);

        const fromNumber = remoteJid.split('@')[0];

        await this.messageRepository.create({
          tenantId: session.tenantId,
          sessionId,
          direction: 'IN',
          fromNumber,
          toNumber: session.phoneNumber || '',
          // JID completo (com sufixo @lid ou @s.whatsapp.net) - guardado
          // para poder responder corretamente depois. Numeros @lid nao sao
          // um MSISDN valido sob @s.whatsapp.net, entao reconstruir o JID
          // so a partir de fromNumber quebra o envio de resposta.
          remoteJid,
          body,
          timestamp: new Date(timestampSeconds * 1000),
        });

        // Evento generico, sem conhecer quem escuta (ex: modulos vivi_sdr e
        // atendimento). emit() nao aguarda os listeners - nao bloqueia o
        // recebimento das proximas mensagens do messages.upsert.
        // remoteJid incluido (alem de phoneNumber) desde o modulo
        // atendimento: GetOrCreateAtendimentoUseCase precisa do JID
        // completo para responder corretamente (numeros @lid, ver
        // CLAUDE.md).
        this.eventEmitter.emit('whatsapp.message.received', {
          tenantId: session.tenantId,
          sessionId,
          phoneNumber: fromNumber,
          remoteJid,
          messageBody: body,
        });
      }
    });

    // DEBUG TEMPORARIO (investigacao do bug @lid nao entregue - remover
    // depois de diagnosticado): mostra a evolucao do status de entrega
    // (PENDING -> SERVER_ACK -> DELIVERY_ACK -> READ) das mensagens que
    // enviamos, para saber se o servidor do WhatsApp sequer confirmou o
    // recebimento antes de tentar entregar ao destinatario.
    sock.ev.on('messages.update', (updates) => {
      console.log(
        '[VIVI-DEBUG messages.update]',
        util.inspect(updates, { depth: null, colors: false }),
      );
    });
  }

  async getQrCode(sessionId: string): Promise<string | null> {
    const qr = this.latestQr.get(sessionId);
    if (!qr) return null;
    return QRCode.toDataURL(qr);
  }

  async sendMessage(sessionId: string, to: string, body: string): Promise<void> {
    const sock = this.sockets.get(sessionId);
    if (!sock) {
      throw new Error('Sessao WhatsApp nao esta conectada.');
    }

    // "to" ja com "@" (JID completo, ex: remoteJid salvo no recebimento) e
    // usado como esta - preserva o sufixo correto (@lid ou @s.whatsapp.net).
    // Sem "@" (envio manual via formulario, so digitos), cai no fallback -
    // so funciona para numeros @s.whatsapp.net reais, nao para @lid.
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    const sendResult = await sock.sendMessage(jid, { text: body });

    // DEBUG TEMPORARIO (investigacao do bug @lid nao entregue - remover
    // depois de diagnosticado): retorno completo de sock.sendMessage().
    console.log(
      '[VIVI-DEBUG sendMessage retorno]',
      util.inspect(sendResult, { depth: null, colors: false }),
    );

    const session = await this.sessionRepository.findById(sessionId);
    await this.messageRepository.create({
      tenantId: session?.tenantId || '',
      sessionId,
      direction: 'OUT',
      fromNumber: session?.phoneNumber || '',
      toNumber: to,
      body,
      timestamp: new Date(),
    });
  }

  async disconnect(sessionId: string): Promise<void> {
    const sock = this.sockets.get(sessionId);
    if (sock) {
      await sock.logout().catch(() => {
        // Ignora erro se a sessao ja estiver desconectada do lado do WhatsApp
      });
      this.sockets.delete(sessionId);
    }
    this.latestQr.delete(sessionId);

    const sessionFolder = path.join(SESSIONS_FOLDER, sessionId);
    await fs.rm(sessionFolder, { recursive: true, force: true }).catch(() => {});
  }
}
