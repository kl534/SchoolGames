import { handle, type Env } from '../../worker/src/app';
import type { FetchJwks } from '../../worker/src/google';
import { createMemoryRepo } from './memory-repo';

export const ORIGIN = 'https://kl534.github.io';

export const testEnv = (): Env => ({
  DB: {} as Env['DB'],
  ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173`,
  SITE_URL: `${ORIGIN}/schoolgames/`,
});

/** Env with mail switched on (the mailer itself is always the test's fake). */
export const mailEnv = (): Env => ({
  ...testEnv(),
  RESEND_API_KEY: 'test-key',
  MAIL_FROM: 'School Games <hello@example.com>',
});

export interface SentMail {
  to: string;
  subject: string;
  text: string;
}

/** The real Worker `handle` on an in-memory repo, with a clock the test can move. */
export function createTestWorker(options: { env?: Env; fetchJwks?: FetchJwks } = {}) {
  const memory = createMemoryRepo();
  const clock = { now: 1_000_000 };
  const env = options.env ?? testEnv();
  const mails: SentMail[] = [];
  const mailer = async (to: string, subject: string, text: string) => {
    mails.push({ to, subject, text });
  };
  const fetchFn = async (url: string, init?: RequestInit): Promise<Response> =>
    handle(new Request(url, init), env, memory.repo, () => clock.now, {
      mailer,
      fetchJwks: options.fetchJwks,
    });

  const call = async (
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
    const res = await fetchFn(`https://sync.test${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, headers: res.headers, text, body: text ? JSON.parse(text) : null };
  };
  return { memory, clock, env, mails, fetchFn, call };
}

export type TestWorker = ReturnType<typeof createTestWorker>;
