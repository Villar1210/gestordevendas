// src/shared/infra/services/resend-email-sender.ts
import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';
import { IEmailSender, SendEmailInput } from '../../domain/services/email-sender.interface';

@Injectable()
export class ResendEmailSender implements IEmailSender {
  private readonly resend: Resend;

  constructor() {
    this.resend = new Resend(process.env.RESEND_API_KEY);
  }

  async send(input: SendEmailInput): Promise<void> {
    await this.resend.emails.send({
      from: process.env.EMAIL_FROM || 'onboarding@resend.dev',
      to: input.to,
      subject: input.subject,
      html: input.body,
    });
  }
}
