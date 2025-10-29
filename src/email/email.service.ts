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

  private maskEmail(email: string): string {
    const [localPart, domain] = email.split('@');
    if (!domain) return '***';

    const visibleChars = Math.min(2, Math.floor(localPart.length / 2));
    const maskedLocal = localPart.substring(0, visibleChars) + '***';
    return `${maskedLocal}@${domain}`;
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
      const result = await this.resend.emails.send({
        from: this.from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      this.logger.log(
        `Email sent successfully to ${this.maskEmail(options.to)}. ID: ${result.id || 'unknown'}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to send email to ${this.maskEmail(options.to)}`,
        err,
      );
      throw err; // Re-throw so calling code knows it failed
    }
  }
}
