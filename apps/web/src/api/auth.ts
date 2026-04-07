import { getApiUrl } from './config';
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

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await fetch(getApiUrl('/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Login failed');
  }

  const { user, accessToken } = await response.json();
  if (accessToken) localStorage.setItem('token', accessToken);

  return { user, accessToken };
}

export async function logout(): Promise<void> {
  localStorage.removeItem('token');
}

export async function refreshToken(): Promise<AuthResponse> {
  const token = localStorage.getItem('token');
  if (!token) throw new Error('No session');
  
  // For a simple local backend, we might just return the existing token
  // Or check if it's still valid by calling a profile endpoint
  const response = await fetch(getApiUrl('/health'), {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  if (!response.ok) {
    localStorage.removeItem('token');
    throw new Error('Session expired');
  }
  
  // Real implement might fetch user profile here
  return { 
    user: { id: 'temp', email: 'user@legal.app', role: Role.USER, createdAt: new Date().toISOString() }, 
    accessToken: token 
  };
}
