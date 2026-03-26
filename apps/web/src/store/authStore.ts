import { create } from 'zustand';
import { insforge } from '../api/insforge';
import type { UserDto } from '@transcribe/shared-types';
import { Role } from '@transcribe/shared-types';

interface InsForgeUser {
  id: string;
  email: string;
  createdAt: string;
  emailVerified: boolean;
  metadata?: {
    role?: string;
    is_project_admin?: boolean;
  };
}

interface AuthState {
  user: UserDto | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: UserDto | null) => void;
}

function mapUser(sessionUser: InsForgeUser): UserDto {
  const metadata = sessionUser.metadata || {};
  const isAdmin = metadata.role === 'ADMIN' || metadata.is_project_admin === true;

  return {
    id: sessionUser.id,
    email: sessionUser.email,
    role: isAdmin ? Role.ADMIN : Role.TRANSCRIPTIONIST,
    createdAt: sessionUser.createdAt,
  };
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  initialize: async () => {
    set({ isLoading: true });
    const { data } = await insforge.auth.getCurrentUser();
    if (data?.user) {
      set({
        user: mapUser(data.user as InsForgeUser),
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      set({ isLoading: false });
    }
  },

  login: async (email: string, password: string) => {
    set({ isLoading: true, error: null });
    const { data, error } = await insforge.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      set({ isLoading: false, error: error.message, isAuthenticated: false });
      throw error;
    }
    if (data) {
      set({
        user: mapUser(data.user as InsForgeUser),
        isAuthenticated: true,
        isLoading: false,
      });
    }
  },

  signup: async (email: string, password: string, name?: string) => {
    set({ isLoading: true, error: null });
    const { data, error } = await insforge.auth.signUp({
      email,
      password,
      name,
    });
    if (error) {
      set({ isLoading: false, error: error.message });
      throw error;
    }
    if (data?.requireEmailVerification) {
      set({ isLoading: false, error: 'Please verify your email' });
    }
  },

  logout: async () => {
    set({ isLoading: true });
    await insforge.auth.signOut();
    set({ user: null, isAuthenticated: false, isLoading: false, error: null });
  },

  setUser: (user: UserDto | null) => {
    set({ user, isAuthenticated: user !== null });
  },
}));
