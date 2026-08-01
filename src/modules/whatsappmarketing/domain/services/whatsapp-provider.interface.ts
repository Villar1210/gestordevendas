// src/modules/whatsappmarketing/domain/services/whatsapp-provider.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Baileys, Meta Cloud API, etc.

export interface IWhatsAppProvider {
  createSession(sessionId: string): Promise<void>;
  getQrCode(sessionId: string): Promise<string | null>;
  // "to" aceita, preferencialmente, um JID completo (ex: "123@lid" ou
  // "5511999999999@s.whatsapp.net"), usado como esta para o ENVIO em si -
  // nunca derivado de "phoneNumber" abaixo. Se vier so digitos (sem "@"),
  // cai no fallback de montar "<digitos>@s.whatsapp.net" - mantido para
  // compatibilidade com o envio manual (formulario) e as campanhas de
  // Repique, que so tem o numero de telefone (Card.phone), nunca o JID
  // completo do WhatsApp - nenhum dos dois usa @lid, entao esse fallback
  // continua correto pra eles.
  //
  // "phoneNumber" (opcional): o numero REAL do destinatario, quando quem
  // chama ja o resolveu de forma confiavel (ex: ProcessIncomingMessageUseCase/
  // EnviarMensagemAtendimentoUseCase, que respondem a uma mensagem recebida
  // e ja tem o numero certo, mesmo quando "to" e um JID @lid). Usado SO para
  // gravar WhatsAppMessage.toNumber - nunca para decidir o destino do envio.
  // Sem ele, cai no comportamento historico (extrair digitos de "to"), que
  // grava o LID em vez do numero real quando "to" e um JID @lid (bug
  // conhecido, ver extract-phone-number.ts) - por isso os chamadores que
  // respondem a uma mensagem recebida devem sempre passar este parametro.
  // simularDigitando (Integracao VIVI 2026, opcional, default false): manda
  // um indicador de presenca "composing" (digitando...) antes da mensagem,
  // com uma pausa artificial (ver BaileysWhatsAppProvider - sendPresenceUpdate
  // sozinho nao tem efeito visivel sem esse delay). So a VIVI passa true -
  // resposta manual do corretor (Central de Atendimento) e envio via
  // formulario continuam sem esse delay, decisao deliberada (nao ha ganho em
  // simular digitacao quando um humano ja digitou de verdade).
  sendMessage(
    sessionId: string,
    to: string,
    body: string,
    phoneNumber?: string,
    simularDigitando?: boolean,
  ): Promise<void>;
  disconnect(sessionId: string): Promise<void>;
  // Estado real do socket em memoria (sincrono, sem I/O) - diferente do
  // status gravado no banco, que so reflete o ultimo evento 'open'/'close'
  // processado e pode ficar stale apos um restart do processo.
  isConnected(sessionId: string): boolean;
}
