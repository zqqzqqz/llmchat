import { create } from 'zustand';

interface AuthUser {
  id: string;
  username: string;
  role?: string;
}

interface AuthState {
  token: string | null;
  user: AuthUser | null;
  expiresAt: number | null; // epoch ms
  login: (payload: { token: string; user: AuthUser; expiresIn: number }) => void;
  logout: () => void;
  restore: () => void;
  isAuthenticated: () => boolean;
}

const LS_TOKEN = 'auth.token';
const LS_USER = 'auth.user';
const LS_EXPIRES = 'auth.expiresAt';

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  user: null,
  expiresAt: null,

  login: ({ token, user, expiresIn }) => {
    const expiresAt = Date.now() + expiresIn * 1000;
    localStorage.setItem(LS_TOKEN, token);
    localStorage.setItem(LS_USER, JSON.stringify(user));
    localStorage.setItem(LS_EXPIRES, String(expiresAt));
    set({ token, user, expiresAt });
  },

  logout: () => {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
    localStorage.removeItem(LS_EXPIRES);
    set({ token: null, user: null, expiresAt: null });
  },

  restore: () => {
    const token = localStorage.getItem(LS_TOKEN);
    const userStr = localStorage.getItem(LS_USER);
    const expStr = localStorage.getItem(LS_EXPIRES);
    const exp = expStr ? Number(expStr) : null;
    if (token && userStr && exp && Date.now() <= exp) {
      try {
        const user = JSON.parse(userStr) as AuthUser;
        set({ token, user, expiresAt: exp });
      } catch {
        // ignore parse error
      }
    } else {
      // cleanup if expired
      localStorage.removeItem(LS_TOKEN);
      localStorage.removeItem(LS_USER);
      localStorage.removeItem(LS_EXPIRES);
      set({ token: null, user: null, expiresAt: null });
    }
  },

  isAuthenticated: () => {
    const { token, expiresAt } = get();
    return Boolean(token) && typeof expiresAt === 'number' && Date.now() <= expiresAt;
  },
}));

