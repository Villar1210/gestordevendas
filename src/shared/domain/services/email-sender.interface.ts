// src/shared/domain/services/email-sender.interface.ts
// Camada de DOMINIO: define o contrato sem saber que existe Resend, SMTP, etc.

export interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

export interface IEmailSender {
  send(input: SendEmailInput): Promise<void>;
}
