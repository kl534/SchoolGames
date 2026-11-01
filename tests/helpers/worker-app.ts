import { handle, type Env } from '../../worker/src/app';
import { createMemoryRepo } from './memory-repo';

export const ORIGIN = 'https://kl534.github.io';

export const testEnv = (): Env => ({
  DB: {} as Env['DB'],
  ALLOWED_ORIGINS: `${ORIGIN},http://localhost:5173`,
  SITE_URL: `${ORIGIN}/schoolgames/`,
});

/** The real Worker `handle` on an in-memory repo, with a clock the test can move. */
export function createTestWorker() {
  const memory = createMemoryRepo();
  const clock = { now: 1_000_000 };
  const env = testEnv();
  const fetchFn = async (url: string, init?: RequestInit): Promise<Response> =>
    handle(new Request(url, init), env, memory.repo, () => clock.now);

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
  return { memory, clock, env, fetchFn, call };
}

export type TestWorker = ReturnType<typeof createTestWorker>;
