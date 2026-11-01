import type {
  ApiErrorCode,
  AuthResponse,
  ServerConfig,
  SyncRequest,
  SyncResponse,
} from './protocol';

export type ApiFailure = ApiErrorCode | 'network';

export class ApiError extends Error {
  constructor(readonly code: ApiFailure) {
    super(code);
    this.name = 'ApiError';
  }
}

const KNOWN: ApiErrorCode[] = [
  'invalid',
  'bad_credentials',
  'exists',
  'rate_limited',
  'unauthorized',
  'too_large',
  'limit',
];

export type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

/** The sync service's API. Every failure is an `ApiError`; a dead connection is `'network'`. */
export function createSyncApi(base: string, fetchFn: FetchFn = (url, init) => fetch(url, init)) {
  async function request<T>(
    method: string,
    path: string,
    options: { body?: unknown; token?: string; keepalive?: boolean } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    let res: Response;
    try {
      res = await fetchFn(`${base}${path}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        keepalive: options.keepalive,
      });
    } catch {
      throw new ApiError('network');
    }
    if (res.status === 204) return null as T;
    let data: unknown = null;
    try {
      data = await res.json();
    } catch {
      // Not JSON: handled below.
    }
    if (!res.ok) {
      const code = (data as { error?: unknown } | null)?.error;
      throw new ApiError(KNOWN.includes(code as ApiErrorCode) ? (code as ApiErrorCode) : 'network');
    }
    if (data === null) throw new ApiError('network');
    return data as T;
  }

  return {
    config: () => request<ServerConfig>('GET', '/config'),
    signUp: (email: string, password: string) =>
      request<AuthResponse>('POST', '/auth/signup', { body: { email, password } }),
    signIn: (email: string, password: string) =>
      request<AuthResponse>('POST', '/auth/login', { body: { email, password } }),
    signOut: (token: string) => request<null>('POST', '/auth/logout', { token }),
    sync: (token: string, req: SyncRequest, opts: { keepalive?: boolean } = {}) =>
      request<SyncResponse>('POST', '/sync', { body: req, token, keepalive: opts.keepalive }),
  };
}

export type SyncApi = ReturnType<typeof createSyncApi>;
