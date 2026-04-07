import { create } from 'zustand';
import { login as apiLogin, logout as apiLogout } from '../api/auth';
import type { UserDto } from '@transcribe/shared-types';

interface AuthState {
  user: UserDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  initialCheck: () => Promise<void>;
  login: (credentials: any) => Promise<void>;
  signup: (credentials: any) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  initialCheck: async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        set({ user: null, isAuthenticated: false, isLoading: false });
        return;
      }
      // Simple validation for now, could be a /me endpoint
      set({ 
        user: { id: 'local', email: 'user@legal.app', role: 'user' as any, createdAt: new Date().toISOString() }, 
        isAuthenticated: true, 
        isLoading: false 
      });
    } catch {
      set({ user: null, isAuthenticated: false, isLoading: false });
    }
  },

  login: async (credentials) => {
    set({ isLoading: true });
    try {
      const { user, accessToken } = await apiLogin(credentials);
      if (accessToken) localStorage.setItem('token', accessToken);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  signup: async (credentials) => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      if (!response.ok) throw new Error('Signup failed');
      
      const { user, accessToken } = await response.json();
      if (accessToken) localStorage.setItem('token', accessToken);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    await apiLogout();
    localStorage.removeItem('token');
    set({ user: null, isAuthenticated: false });
  },
}));
