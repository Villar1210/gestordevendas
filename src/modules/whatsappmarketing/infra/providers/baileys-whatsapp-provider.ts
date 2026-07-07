// src/modules/whatsappmarketing/infra/providers/baileys-whatsapp-provider.ts
// Camada de INFRA: adapta o contrato de dominio (IWhatsAppProvider) para a
// biblioteca nao-oficial Baileys (conexao via QR Code). Ver CLAUDE.md
// "Decisao tecnica: Integracao WhatsApp" - nao misturar com a API oficial da Meta.
import { Injectable, Inject } from '@nestjs/common';
import * as fs from 'fs/promises';
import * as path from 'path';
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

        await this.messageRepository.create({
          tenantId: session.tenantId,
          sessionId,
          direction: 'IN',
          fromNumber: remoteJid.split('@')[0],
          toNumber: session.phoneNumber || '',
          body,
          timestamp: new Date(timestampSeconds * 1000),
        });
      }
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

    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: body });

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
