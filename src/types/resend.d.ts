declare module 'resend' {
  export interface ResendSendParams {
    from: string;
    to: string | string[];
    subject: string;
    html?: string;
    text?: string;
  }
  export interface ResendEmailsApi {
    send(params: ResendSendParams): Promise<{ id?: string; error?: unknown }>;
  }
  export class Resend {
    constructor(apiKey: string);
    emails: ResendEmailsApi;
  }
}
