/** Mail through Resend. Plain text only. Switched off until both secrets are set. */

export interface MailEnv {
  RESEND_API_KEY?: string;
  MAIL_FROM?: string;
}

export type Mailer = (to: string, subject: string, text: string) => Promise<void>;

export const VERIFY_SUBJECT = 'Confirm your School Games email';
export const RESET_SUBJECT = 'Reset your School Games password';

export const emailEnabled = (env: MailEnv): boolean => Boolean(env.RESEND_API_KEY && env.MAIL_FROM);

export const verifyBody = (link: string): string =>
  `Tap this link to confirm your email for School Games: ${link}`;

export const resetBody = (link: string): string =>
  `Tap this link within an hour to choose a new School Games password: ${link}`;

/** Sends one mail. Throws when Resend refuses it. */
export async function sendMail(
  env: MailEnv,
  to: string,
  subject: string,
  text: string,
  fetchFn: typeof fetch = fetch,
): Promise<void> {
  if (!emailEnabled(env)) return;
  if (env.RESEND_API_KEY === 'log') {
    // Local development only: print the mail instead of sending it, so the links can be opened.
    console.log(`[mail] to ${to}: ${subject}\n${text}`);
    return;
  }
  const res = await fetchFn('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text }),
  });
  if (!res.ok) throw new Error('mail');
}
