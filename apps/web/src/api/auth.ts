import { insforge } from './insforge';
import type { UserDto } from '@transcribe/shared-types';
import { Role } from '@transcribe/shared-types';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: UserDto;
  accessToken?: string | null;
}

/**
 * Sign in an existing user with email and password via InsForge SDK.
 */
export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const { data, error } = await insforge.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) {
    throw new Error(error.message || 'Login failed');
  }

  if (!data || !data.user) {
    throw new Error('User not found in response');
  }

  const user = {
    id: data.user.id,
    email: data.user.email,
    role: (data.user as any).role || (data.user.profile as any)?.role || Role.USER,
    createdAt: data.user.createdAt,
  } as UserDto;

  return {
    user,
    accessToken: data.accessToken,
  };
}

/**
 * Sign out the current user via InsForge SDK.
 */
export async function logout(): Promise<void> {
  const { error } = await insforge.auth.signOut();
  if (error) throw error;
}

/**
 * Refresh user session via InsForge SDK.
 * refreshSession() uses httpOnly cookies in browser mode to restore the session.
 */
export async function refreshToken(): Promise<AuthResponse> {
  const { data, error } = await insforge.auth.refreshSession();

  if (error) throw error;
  if (!data) throw new Error('No session available');

  const user = {
    id: data.user.id,
    email: data.user.email,
    role: (data.user as any).role || (data.user as any).profile?.role || Role.USER,
    createdAt: data.user.createdAt,
  } as UserDto;

  return {
    user,
    accessToken: data.accessToken,
  };
}
