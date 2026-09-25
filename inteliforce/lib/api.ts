// lib/api.ts
import { config } from '@/constants/config';
import { getAuthToken, useAuth } from './auth';

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export function isNetworkError(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  return (
    msg.includes('network request failed') ||
    msg.includes('failed to fetch') ||
    msg.includes('timeout') ||
    msg.includes('network') ||
    err.status === 0 ||
    err.status >= 500
  );
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const url = `${config.apiBaseUrl}${path}`;

  let res: Response;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (err: any) {
    throw new ApiError(err?.message || 'Network request failed', 0, err);
  }

  if (!res.ok) {
    let errData: any = {};
    try {
      errData = await res.json();
    } catch {
      errData = { detail: res.statusText };
    }
    const message = errData?.detail || errData?.message || res.statusText || 'Error en la petición';

    if (res.status === 401) {
      if (!path.includes('/auth/')) {
        await useAuth.getState().logout();
      }
      throw new ApiError(message || 'Credenciales inválidas o no autorizadas', 401, errData);
    }

    throw new ApiError(message, res.status, errData);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

export const api = {
  get: <T>(path: string, options?: RequestInit) => request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: any, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T>(path: string, body?: any, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: 'PATCH',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  put: <T>(path: string, body?: any, options?: RequestInit) =>
    request<T>(path, {
      ...options,
      method: 'PUT',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const token = await getAuthToken();
    const headers: Record<string, string> = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const url = `${config.apiBaseUrl}${path}`;
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: formData,
      });
    } catch (err: any) {
      throw new ApiError(err?.message || 'Network request failed on upload', 0, err);
    }

    if (res.status === 401) {
      await useAuth.getState().logout();
      throw new ApiError('Sesión expirada', 401);
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      throw new ApiError(errText || 'Error al subir archivo', res.status);
    }

    return res.json();
  },
};
