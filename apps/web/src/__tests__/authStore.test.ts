import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act } from '@testing-library/react';

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
}));

import * as authApi from '../api/auth';

async function getStore() {
  const { useAuthStore } = await import('../store/authStore');
  return useAuthStore;
}

describe('authStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('starts with unauthenticated state', async () => {
    const useAuthStore = await getStore();
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it('sets user and isAuthenticated after successful login', async () => {
    const mockUser = { id: '1', email: 'test@example.com', role: 'TRANSCRIPTIONIST' as never, createdAt: '' };
    vi.mocked(authApi.login).mockResolvedValueOnce({ user: mockUser });

    const useAuthStore = await getStore();

    await act(async () => {
      await useAuthStore.getState().login({ email: 'test@example.com', password: 'password123' });
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toEqual(mockUser);
  });

  it('sets error on failed login', async () => {
    vi.mocked(authApi.login).mockRejectedValueOnce(new Error('Invalid credentials'));

    const useAuthStore = await getStore();

    await act(async () => {
      try {
        await useAuthStore.getState().login({ email: 'bad@example.com', password: 'wrong' });
      } catch {
      }
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
    expect(state.error).toBe('Invalid credentials');
  });

  it('clears user on logout', async () => {
    const mockUser = { id: '1', email: 'test@example.com', role: 'TRANSCRIPTIONIST' as never, createdAt: '' };
    vi.mocked(authApi.login).mockResolvedValueOnce({ user: mockUser });
    vi.mocked(authApi.logout).mockResolvedValueOnce(undefined);

    const useAuthStore = await getStore();

    await act(async () => {
      await useAuthStore.getState().login({ email: 'test@example.com', password: 'password123' });
    });

    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    await act(async () => {
      await useAuthStore.getState().logout();
    });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(false);
    expect(state.user).toBeNull();
  });

  it('setUser updates user and isAuthenticated', async () => {
    const useAuthStore = await getStore();
    const mockUser = { id: '2', email: 'admin@example.com', role: 'ADMIN' as never, createdAt: '' };

    act(() => {
      useAuthStore.getState().setUser(mockUser);
    });

    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);

    act(() => {
      useAuthStore.getState().setUser(null);
    });

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
