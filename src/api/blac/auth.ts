import { useAuthStore, type AuthUser } from '@/store/authStore';
import { reachable } from './config';
import { apiRequest, saveSession } from './http';

/**
 * Where the backend sends the browser when Google sign-in is over. On iPhone the in-app sign-in sheet closes itself at
 * this address, so the app does not need to own its scheme. It must match the backend's setting.
 */
export const GOOGLE_REDIRECT = process.env.EXPO_PUBLIC_GOOGLE_AUTH_REDIRECT ?? 'blacmusic://auth/google';

interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  expiresAt: string;
  refreshToken: string;
}

/** The account calls: sign up, sign in, sign out and email verification. */
export const authApi = {
  async register(input: { email: string; password: string; displayName: string }): Promise<AuthUser> {
    const data = await apiRequest<AuthResponse>('/v1/auth/register', {
      method: 'POST',
      auth: false,
      body: { email: input.email.trim(), password: input.password, displayName: input.displayName.trim() },
    });
    saveSession(data);
    return data.user;
  },

  async login(input: { email: string; password: string }): Promise<AuthUser> {
    const data = await apiRequest<AuthResponse>('/v1/auth/login', {
      method: 'POST',
      auth: false,
      body: { email: input.email.trim(), password: input.password },
    });
    saveSession(data);
    return data.user;
  },

  /**
   * Signs in (or creates the account) with what the Apple sheet returned. Apple only gives the name the first time,
   * so it is sent along every time.
   */
  async signInWithApple(input: {
    identityToken: string;
    authorizationCode?: string | null;
    fullName?: { givenName?: string | null; familyName?: string | null } | null;
    email?: string | null;
  }): Promise<AuthUser> {
    const data = await apiRequest<AuthResponse>('/v1/auth/apple', {
      method: 'POST',
      auth: false,
      body: {
        identityToken: input.identityToken,
        ...(input.authorizationCode ? { authorizationCode: input.authorizationCode } : {}),
        ...(input.fullName ? { fullName: { givenName: input.fullName.givenName ?? undefined, familyName: input.fullName.familyName ?? undefined } } : {}),
        ...(input.email ? { email: input.email } : {}),
      },
    });
    saveSession(data);
    return data.user;
  },

  /** The Google sign-in page to open in the system browser. */
  async startGoogle(): Promise<{ authUrl: string }> {
    const data = await apiRequest<{ authUrl: string }>('/v1/auth/google/start', { method: 'POST', auth: false, body: {} });
    // On a local test server the page is on "localhost", which the phone cannot reach: point it at this computer.
    return { authUrl: reachable(data.authUrl) ?? data.authUrl };
  },

  /** Trades the one-time code from the Google redirect for a session. */
  async signInWithGoogle(code: string): Promise<AuthUser> {
    const data = await apiRequest<AuthResponse>('/v1/auth/google/exchange', { method: 'POST', auth: false, body: { code } });
    saveSession(data);
    return data.user;
  },

  /**
   * Deletes the account and all its data, for good. The password is only needed (and only checked) when the account
   * has one. On success the tokens are cleared, which sends the app back to the Get started screen.
   */
  async deleteAccount(password?: string): Promise<void> {
    await apiRequest<void>('/v1/me', { method: 'DELETE', ...(password !== undefined ? { body: { password } } : {}) });
    useAuthStore.getState().clear();
  },

  /** Ends the session on the server (best effort) and forgets the tokens on this device. */
  async logout(): Promise<void> {
    const { refreshToken, clear } = useAuthStore.getState();
    clear();
    if (!refreshToken) return;
    try {
      await apiRequest<void>('/v1/auth/logout', { method: 'POST', auth: false, body: { refreshToken } });
    } catch {
      // The tokens are already gone from this device; the server copy expires on its own.
    }
  },

  /** Re-reads the account (for example to see that the email is now verified). */
  async refreshMe(): Promise<AuthUser> {
    const user = await apiRequest<AuthUser>('/v1/me');
    useAuthStore.getState().setUser(user);
    return user;
  },

  /**
   * Changes the profile. `avatarImageId` is a finished image uploaded with purpose "avatar"; an empty string
   * removes the picture. The picture is also the artist's picture, so artists are re-read afterwards.
   */
  async updateProfile(patch: { displayName?: string; avatarImageId?: string }): Promise<AuthUser> {
    const user = await apiRequest<AuthUser>('/v1/me', {
      method: 'PATCH',
      body: {
        ...(patch.displayName !== undefined ? { displayName: patch.displayName.trim() } : {}),
        ...(patch.avatarImageId !== undefined ? { avatarImageId: patch.avatarImageId } : {}),
      },
    });
    useAuthStore.getState().setUser(user);
    return user;
  },

  /** Emails a 6 digit code. `alreadyVerified` is true when there is nothing to do. */
  async sendVerificationCode(): Promise<{ alreadyVerified: boolean; resendAfterSeconds: number }> {
    const data = await apiRequest<{ sent?: boolean; emailVerified?: boolean; resendAfterSeconds?: number }>(
      '/v1/auth/email/send-code',
      { method: 'POST', body: {} },
    );
    return { alreadyVerified: data.emailVerified === true, resendAfterSeconds: data.resendAfterSeconds ?? 60 };
  },

  async verifyEmail(code: string): Promise<void> {
    await apiRequest<{ emailVerified: boolean }>('/v1/auth/email/verify', { method: 'POST', body: { code: code.trim() } });
    const { user, setUser } = useAuthStore.getState();
    if (user) setUser({ ...user, emailVerified: true });
  },
};
