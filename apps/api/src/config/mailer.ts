/**
 * EMAIL SENDER (Nodemailer SMTP)
 * Dev default: points at Mailpit localhost:1025 → opens in browser http://localhost:8025
 * No real emails go out to customers in dev.
 *
 * All templates are rendered via Handlebars (see src/modules/notifications/templates).
 */
import nodemailer, { type Transporter, type SendMailOptions } from "nodemailer";
import { env } from "./env";
import { logger } from "./logger";

let _transporter: Transporter | null = null;

export function getMailer(): Transporter {
  if (_transporter) return _transporter;

  if (env.MAIL_DRIVER === "log") {
    _transporter = nodemailer.createTransport({
      jsonTransport: true,
    });
    return _transporter;
  }

  const secure = env.SMTP_ENCRYPTION === "ssl";
  const port = env.SMTP_PORT;

  _transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
    requireTLS: env.SMTP_ENCRYPTION === "tls",
    pool: true,
    maxConnections: 5,
    maxMessages: 100,
  });
  return _transporter;
}

export type SendEmailArgs = Omit<SendMailOptions, "from"> & {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  attachments?: SendMailOptions["attachments"];
};

export async function sendEmail(args: SendEmailArgs): Promise<string | true> {
  const mailer = getMailer();
  const info = await mailer.sendMail({
    from: `"${env.MAIL_FROM_NAME}" <${env.MAIL_FROM_ADDRESS}>`,
    ...args,
  });
  if (env.MAIL_DRIVER === "log") {
    logger.info(
      { to: args.to, subject: args.subject, messageId: info.messageId },
      "📧 [DEV MAIL LOG — NOT actually sent]",
    );
    return info.messageId as string;
  }
  logger.info({ to: args.to, subject: args.subject }, "📧 Email sent");
  return true;
}
