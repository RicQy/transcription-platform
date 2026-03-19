import axios from 'axios';
import type { UserDto } from '@transcribe/shared-types';

import { getApiBaseUrl } from './config';

export const apiClient = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true,
});

let isRefreshing = false;
let refreshSubscribers: Array<(token: boolean) => void> = [];

function onRefreshed(success: boolean) {
  refreshSubscribers.forEach((cb) => cb(success));
  refreshSubscribers = [];
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      originalRequest.url !== '/auth/refresh' &&
      originalRequest.url !== '/auth/login'
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          refreshSubscribers.push((success) => {
            if (success) {
              resolve(apiClient(originalRequest));
            } else {
              reject(error);
            }
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await apiClient.post('/auth/refresh');
        isRefreshing = false;
        onRefreshed(true);
        return apiClient(originalRequest);
      } catch {
        isRefreshing = false;
        onRefreshed(false);
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  },
);

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: UserDto;
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
  return response.data;
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function refreshToken(): Promise<AuthResponse> {
  const response = await apiClient.post<AuthResponse>('/auth/refresh');
  return response.data;
}
