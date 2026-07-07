// src/shared/infra/services/console-email-sender.ts
import { Injectable } from '@nestjs/common';
import { IEmailSender, SendEmailInput } from '../../domain/services/email-sender.interface';

@Injectable()
export class ConsoleEmailSender implements IEmailSender {
  async send(input: SendEmailInput): Promise<void> {
    console.log(
      `[ConsoleEmailSender] Para: ${input.to} | Assunto: ${input.subject}\n${input.body}`,
    );
  }
}
