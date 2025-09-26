import { api } from './api';

export interface LoginResponse {
  token: string;
  user: { id: string; username: string; role?: string };
  expiresIn: number;
}

export async function loginApi(username: string, password: string) {
  const { data } = await api.post<LoginResponse>('/auth/login', { username, password });
  return data;
}

export async function profileApi() {
  const { data } = await api.get<{ user: { id: string; username: string; role?: string } }>(
    '/auth/profile'
  );
  return data.user;
}

export async function logoutApi() {
  try {
    await api.post('/auth/logout', {});
  } catch {
    // ignore
  }
}

export async function changePasswordApi(oldPassword: string, newPassword: string) {
  const { data } = await api.post('/auth/change-password', { oldPassword, newPassword });
  return data;
}

