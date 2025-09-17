import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend?: Resend;
  private readonly from: string;
  private readonly mfaResetEnforced: boolean;

  constructor() {
    const apiKey = process.env.RESEND_API_KEY;
    this.from = process.env.EMAIL_FROM || 'no-reply@example.com';
    this.mfaResetEnforced = process.env.RESET_REQUIRE_MFA === 'true';
    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn('RESEND_API_KEY not set. Emails will be logged only.');
    }
  }

  requireMfaOnReset(): boolean {
    return this.mfaResetEnforced;
  }

  async send(options: SendEmailOptions): Promise<void> {
    if (!this.resend) {
      // dev fallback
      this.logger.log(
        `[DEV EMAIL] To: ${options.to} | Subject: ${options.subject}`,
      );
      this.logger.debug(options.text);
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
    } catch (err) {
      this.logger.error('Resend send failed', err as Error);
    }
  }
}
