import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { secureStorage } from './secureStorage';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin' | string;
  emailVerified: boolean;
  /** The profile picture (also the artist picture), or absent when none is set. */
  avatarUrl?: string | null;
  /** False for accounts made with Apple or Google only: they have no password to type. */
  hasPassword?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  /** Epoch ms when the access token stops working. */
  accessExpiresAt: number | null;
  refreshToken: string | null;
  setSession: (session: { user?: AuthUser; accessToken: string; accessExpiresAt: number; refreshToken: string }) => void;
  setUser: (user: AuthUser) => void;
  clear: () => void;
}

/** The signed-in account and its tokens. Kept in the system keychain where available. */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      accessExpiresAt: null,
      refreshToken: null,
      setSession: ({ user, accessToken, accessExpiresAt, refreshToken }) =>
        set((s) => ({ user: user ?? s.user, accessToken, accessExpiresAt, refreshToken })),
      setUser: (user) => set({ user }),
      clear: () => set({ user: null, accessToken: null, accessExpiresAt: null, refreshToken: null }),
    }),
    { name: 'blac-auth', storage: secureStorage },
  ),
);

export const useIsSignedIn = () => useAuthStore((s) => s.refreshToken !== null);
