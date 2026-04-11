import { create } from 'zustand';
import { login as apiLogin, logout as apiLogout, signup as apiSignup } from '../api/auth';
import type { UserDto } from '@transcribe/shared-types';

interface AuthState {
  user: UserDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  initialCheck: () => Promise<void>;
  login: (credentials: any) => Promise<void>;
  signup: (credentials: any) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,

  initialCheck: async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        set({ user: null, isAuthenticated: false, isLoading: false, error: null });
        return;
      }
      set({ 
        user: { id: 'local', email: 'user@legal.app', role: 'user' as any, createdAt: new Date().toISOString() }, 
        isAuthenticated: true, 
        isLoading: false,
        error: null
      });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false, error: null });
    }
  },

  login: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const { user, accessToken } = await apiLogin(credentials);
      if (accessToken) localStorage.setItem('token', accessToken);
      set({ user, isAuthenticated: true, isLoading: false, error: null });
    } catch (error: any) {
      set({ isLoading: false, error: error.message || 'Login failed' });
      throw error;
    }
  },

  signup: async (credentials) => {
    set({ isLoading: true, error: null });
    try {
      const { user, accessToken } = await apiSignup(credentials);
      if (accessToken) localStorage.setItem('token', accessToken);
      set({ user, isAuthenticated: true, isLoading: false, error: null });
    } catch (error: any) {
      set({ isLoading: false, error: error.message || 'Signup failed' });
      throw error;
    }
  },

  logout: async () => {
    await apiLogout();
    localStorage.removeItem('token');
    set({ user: null, isAuthenticated: false, error: null });
  },
}));
