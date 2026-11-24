import { useAuthStore } from '@/store/authStore';
import { API_URL } from './config';

/** A failed call to the backend, with the backend's own error code and message. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const TIMEOUT_MS = 20_000;
/** Refresh the access token a little before it runs out, so a request never starts with a dead one. */
const REFRESH_MARGIN_MS = 30_000;

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  /** Extra request headers, such as `Idempotency-Key`. */
  headers?: Record<string, string>;
  /** Send the sign-in token. Default true. */
  auth?: boolean;
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: RequestOptions['query']) {
  if (!API_URL) throw new ApiError(0, 'no_backend', 'The app is not connected to a server.');
  const params = Object.entries(query ?? {})
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  return `${API_URL}${path}${params ? `?${params}` : ''}`;
}

async function send(path: string, options: RequestOptions, token: string | null): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  options.signal?.addEventListener('abort', () => controller.abort());
  try {
    return await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        ...options.headers,
        ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    throw new ApiError(0, 'network', "Can't reach Blac right now. Check your connection and try again.");
  } finally {
    clearTimeout(timer);
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let code = 'error';
  let message = `Something went wrong (${response.status}).`;
  let details: Record<string, unknown> | undefined;
  try {
    const json = (await response.json()) as { error?: { code?: string; message?: string; details?: Record<string, unknown> } };
    if (json.error) {
      code = json.error.code ?? code;
      message = json.error.message ?? message;
      details = json.error.details;
    }
  } catch {
    // Not JSON: keep the generic message.
  }
  return new ApiError(response.status, code, message, details);
}

// ---- Sign-in tokens -------------------------------------------------------------------------------

interface TokenResponse {
  accessToken: string;
  expiresAt: string;
  refreshToken: string;
}

let refreshing: Promise<string | null> | null = null;

/**
 * Gets a new access token with the refresh token. Refresh tokens are single use, so concurrent callers
 * share one refresh. Returns null (and signs the user out) when the refresh token is no longer valid.
 */
function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const { refreshToken, setSession, clear } = useAuthStore.getState();
    if (!refreshToken) return null;
    let response: Response;
    try {
      response = await send('/v1/auth/refresh', { method: 'POST', body: { refreshToken }, auth: false }, null);
    } catch {
      // Offline: keep the session, the next call will try again.
      return null;
    }
    if (!response.ok) {
      // 400 to 499 means the token is dead (used, expired or revoked); 5xx means try again later.
      if (response.status < 500 && response.status !== 429) clear();
      return null;
    }
    const data = (await response.json()) as TokenResponse;
    setSession({
      accessToken: data.accessToken,
      accessExpiresAt: Date.parse(data.expiresAt),
      refreshToken: data.refreshToken,
    });
    return data.accessToken;
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

async function currentToken(): Promise<string | null> {
  const { accessToken, accessExpiresAt, refreshToken } = useAuthStore.getState();
  if (!refreshToken) return null;
  if (accessToken && accessExpiresAt && accessExpiresAt - Date.now() > REFRESH_MARGIN_MS) return accessToken;
  return (await refreshAccessToken()) ?? accessToken;
}

/** Calls the backend and returns its JSON. Adds the sign-in token and renews it when needed. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const auth = options.auth ?? true;
  let token = auth ? await currentToken() : null;
  let response = await send(path, options, token);

  if (response.status === 401 && auth && useAuthStore.getState().refreshToken) {
    token = await refreshAccessToken();
    if (token) response = await send(path, options, token);
  }

  if (!response.ok) throw await toApiError(response);
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Stores the tokens from a register or login response. */
export function saveSession(data: TokenResponse & { user?: import('@/store/authStore').AuthUser }) {
  useAuthStore.getState().setSession({
    user: data.user,
    accessToken: data.accessToken,
    accessExpiresAt: Date.parse(data.expiresAt),
    refreshToken: data.refreshToken,
  });
}
