import { api } from './api';

export interface SystemInfo {
  platform: string;
  release: string;
  arch: string;
  nodeVersion: string;
  uptimeSec: number;
  memory: { total: number; free: number; used: number; rss: number };
  cpu: { count: number; load1: number; load5: number; load15: number };
}

export interface LogItem { id: number; timestamp: string; level: 'INFO' | 'WARN' | 'ERROR'; message: string }

export interface GetLogsParams { level?: 'INFO'|'WARN'|'ERROR'; start?: string; end?: string; page?: number; pageSize?: number }
export interface LogsPage { data: LogItem[]; total: number; page: number; pageSize: number }

export async function getSystemInfo(): Promise<SystemInfo> {
  const { data } = await api.get<{ data: SystemInfo }>('/admin/system-info');
  return data.data;
}

export async function getLogsPage(params?: GetLogsParams): Promise<LogsPage> {
  const { data } = await api.get<{ data: LogItem[]; total: number; page: number; pageSize: number }>('/admin/logs', { params });
  return { data: data.data, total: (data as any).total, page: (data as any).page, pageSize: (data as any).pageSize };
}

export async function getLogs(params?: GetLogsParams): Promise<LogItem[]> {
  const pageData = await getLogsPage(params);
  return pageData.data;
}

export interface AdminUser { id: number; username: string; role?: string; status?: string; created_at?: string; updated_at?: string }
export async function getUsers(): Promise<AdminUser[]> {
  const { data } = await api.get<{ data: AdminUser[] }>('/admin/users');
  return data.data;
}


export async function createUser(payload: { username: string; password: string; role?: string; status?: string }) {
  const { data } = await api.post<{ data: AdminUser }>('/admin/users/create', payload);
  return data.data;
}

export async function updateUser(payload: { id: number; role?: string; status?: string }) {
  const { data } = await api.post<{ data: AdminUser }>('/admin/users/update', payload);
  return data.data;
}

export async function resetUserPassword(payload: { id: number; newPassword?: string }): Promise<{ ok: boolean; newPassword: string }> {
  const { data } = await api.post('/admin/users/reset-password', payload);
  return data as any;
}

export async function exportLogsCsv(params?: GetLogsParams): Promise<string> {
  const { data } = await api.get('/admin/logs/export', { params, responseType: 'text' });
  return data as string;
}

