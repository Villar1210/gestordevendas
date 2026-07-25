// src/modules/whatsappmarketing/infra/providers/baileys-whatsapp-provider.ts
// Camada de INFRA: adapta o contrato de dominio (IWhatsAppProvider) para a
// biblioteca nao-oficial Baileys (conexao via QR Code). Ver CLAUDE.md
// "Decisao tecnica: Integracao WhatsApp" - nao misturar com a API oficial da Meta.
import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
import { extractPhoneNumber } from '../../domain/services/extract-phone-number';
import { IWhatsAppSessionRepository } from '../../domain/repositories/whatsapp-session-repository.interface';
import { IWhatsAppMessageRepository } from '../../domain/repositories/whatsapp-message-repository.interface';

const SESSIONS_FOLDER = '.whatsapp-sessions';

@Injectable()
export class BaileysWhatsAppProvider implements IWhatsAppProvider, OnModuleInit {
  private readonly sockets = new Map<string, WASocket>();
  private readonly latestQr = new Map<string, string>();
  // Sessoes com o socket REALMENTE aberto agora (evento 'open' ja
  // disparou). Diferente de `sockets` (que pode ter uma entrada durante o
  // handshake, antes de 'open') - usado por isConnected() para o frontend
  // saber se o "CONNECTED" do banco ainda e verdade ou so um valor stale
  // (ex: logo apos um restart do processo, antes da reconexao automatica
  // do onModuleInit terminar).
  private readonly connectedSessions = new Set<string>();
  // Pino com nivel "silent" suprime todos os logs internos do Baileys,
  // inclusive os erros "Bad MAC" (falhas de descriptografia Signal Protocol
  // que acontecem antes do nosso filtro de mensagens ser aplicado - ver
  // CLAUDE.md). Nao alterar sem ter certeza do impacto na verbosidade de
  // producao.
  private readonly logger = pino({ level: 'silent' });

  constructor(
    @Inject('IWhatsAppSessionRepository')
    private readonly sessionRepository: IWhatsAppSessionRepository,
    @Inject('IWhatsAppMessageRepository')
    private readonly messageRepository: IWhatsAppMessageRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // Reconexao automatica no boot: para cada sessao que o banco diz estar
  // CONNECTED, tenta reabrir o socket usando as credenciais ja salvas em
  // disco (.whatsapp-sessions/<id>/, via useMultiFileAuthState) - sem gerar
  // QR novo, exceto se o WhatsApp tiver invalidado a sessao remotamente
  // enquanto o processo estava fora (nesse caso o handler de 'close' ja
  // existente assume e marca DISCONNECTED normalmente).
  // Fire-and-forget por sessao (nao usa await no loop): o NestJS aguarda
  // a Promise retornada por onModuleInit antes de terminar o boot do app -
  // bloquear aqui atrasaria app.listen() esperando o handshake do Baileys,
  // e uma sessao lenta/travada nao pode impedir as demais nem a subida do
  // resto do sistema.
  async onModuleInit(): Promise<void> {
    const connectedSessions = await this.sessionRepository.findAllConnected();
    for (const session of connectedSessions) {
      this.connect(session.id).catch((err) => {
        console.error(
          `[WhatsApp] Falha ao reconectar sessao ${session.id} no boot:`,
          err instanceof Error ? err.message : err,
        );
      });
    }
  }

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
        this.connectedSessions.add(sessionId);
        const phoneNumber = sock.user?.id?.split(':')[0] ?? null;
        await this.sessionRepository.updateStatus(sessionId, 'CONNECTED', phoneNumber);
      }

      if (update.connection === 'close') {
        this.latestQr.delete(sessionId);
        this.sockets.delete(sessionId);
        this.connectedSessions.delete(sessionId);

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
        // Cada mensagem e processada independentemente: uma falha de
        // descriptografia (ex: "Bad MAC" do Signal Protocol, comum em
        // mensagens de protocolo/sistema que chegam antes dos filtros
        // abaixo) nao deve derrubar o processamento das demais mensagens
        // do mesmo lote.
        try {
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

          // Bug do @lid (ver CLAUDE.md + extract-phone-number.ts): prefere
          // o numero real (msg.key.senderPn/participantPn), quando o
          // Baileys o disponibiliza, ao inves dos digitos crus do
          // remoteJid - que podem ser um identificador @lid, nao um MSISDN.
          const fromNumber = extractPhoneNumber(remoteJid, msg.key.senderPn ?? msg.key.participantPn ?? null);

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
        } catch (err) {
          // Suprime silenciosamente erros de mensagens individuais (ex: "Bad
          // MAC" de descriptografia Signal Protocol em mensagens de protocolo
          // que escaparam dos filtros acima). A sessao continua rodando.
          const message = err instanceof Error ? err.message : String(err);
          // So loga se nao for um erro "Bad MAC" conhecido (para nao poluir
          // o log de producao com noise que o Baileys ja gerencia internamente).
          if (!message.includes('Bad MAC') && !message.includes('bad mac')) {
            console.error(`[WhatsApp] Erro ao processar mensagem (sessao ${sessionId}):`, message);
          }
        }
      }
    });
  }

  async getQrCode(sessionId: string): Promise<string | null> {
    const qr = this.latestQr.get(sessionId);
    if (!qr) return null;
    return QRCode.toDataURL(qr);
  }

  // Estado REAL do socket em memoria, sincrono - usado pelos use cases de
  // status para nao confiar cegamente no valor gravado no banco (que so
  // muda quando um evento 'open'/'close' do Baileys realmente acontece,
  // nunca quando o processo e simplesmente morto por um restart).
  isConnected(sessionId: string): boolean {
    return this.connectedSessions.has(sessionId);
  }

  async sendMessage(sessionId: string, to: string, body: string, phoneNumber?: string): Promise<void> {
    const sock = this.sockets.get(sessionId);
    if (!sock) {
      throw new Error('Sessao WhatsApp nao esta conectada.');
    }

    // "to" ja com "@" (JID completo, ex: remoteJid salvo no recebimento) e
    // usado como esta - preserva o sufixo correto (@lid ou @s.whatsapp.net).
    // Sem "@" (envio manual via formulario, so digitos), cai no fallback -
    // so funciona para numeros @s.whatsapp.net reais, nao para @lid. O
    // ENVIO em si (sock.sendMessage) SEMPRE usa este "jid" - nunca o
    // "phoneNumber" abaixo, que so afeta o que fica gravado no banco.
    const jid = to.includes('@') ? to : `${to}@s.whatsapp.net`;
    await sock.sendMessage(jid, { text: body });

    const session = await this.sessionRepository.findById(sessionId);
    await this.messageRepository.create({
      tenantId: session?.tenantId || '',
      sessionId,
      direction: 'OUT',
      fromNumber: session?.phoneNumber || '',
      // Sempre so digitos (mesmo padrao ja usado em fromNumber das
      // mensagens IN, ver messages.upsert acima) - "to" pode chegar com
      // sufixo "@s.whatsapp.net"/"@lid" (remoteJid completo, usado para o
      // envio de fato) ou so digitos (envio manual via formulario). Gravar
      // o JID completo aqui quebrava a busca de historico
      // (findRecentBySessionAndNumber compara com o numero so-digitos de
      // Atendimento.phoneNumber/ViviConversation.phoneNumber) - o JID
      // completo nao e necessario aqui porque a resposta e sempre enviada
      // via remoteJid da MENSAGEM RECEBIDA, nunca reconstruida a partir de
      // uma mensagem OUT salva.
      //
      // "phoneNumber" (quando informado pelo chamador) e SEMPRE preferido a
      // extractPhoneNumber(jid) - correcao de um bug real confirmado em
      // producao (25/07/2026): sem isso, toda resposta a um contato @lid
      // gravava os digitos do LID em vez do numero real, e
      // findRecentBySessionAndNumber (historico passado a IA) nunca
      // encontrava as proprias respostas da VIVI nessas conversas. Callers
      // que respondem a uma mensagem RECEBIDA (ProcessIncomingMessageUseCase/
      // EnviarMensagemAtendimentoUseCase) sempre tem esse numero real
      // disponivel e devem passa-lo. Callers sem esse numero (envio manual
      // via formulario, campanhas de Repique) continuam com o fallback
      // antigo - "to" neles ja e so digitos de telefone (nunca @lid), entao
      // o fallback ja era correto para eles, sem risco de regressao.
      toNumber: phoneNumber ?? extractPhoneNumber(jid),
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
    this.connectedSessions.delete(sessionId);

    const sessionFolder = path.join(SESSIONS_FOLDER, sessionId);
    await fs.rm(sessionFolder, { recursive: true, force: true }).catch(() => {});
  }
}
