import axios, { AxiosInstance, AxiosError } from 'axios';
import { AuthResponse, RefreshRequest, LoginRequest, CreateCommentRequest, RegisterDecisionRequest, PaginatedIncidents } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

let accessToken: string | null = null;
let refreshToken: string | null = null;

// Load tokens from localStorage (client-side only)
if (typeof window !== 'undefined') {
  accessToken = localStorage.getItem('accessToken');
  refreshToken = localStorage.getItem('refreshToken');
}

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: add access token
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle 401, refresh token
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      if (refreshToken) {
        try {
          const response = await axios.post<AuthResponse>(`${API_URL}/auth/refresh`, {
            refreshToken,
          } as RefreshRequest);

          accessToken = response.data.accessToken;
          refreshToken = response.data.refreshToken;

          if (typeof window !== 'undefined') {
            localStorage.setItem('accessToken', accessToken);
            localStorage.setItem('refreshToken', refreshToken);
          }

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        } catch {
          // Refresh failed — clear tokens and redirect to login
          clearTokens();
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
        }
      }
    }

    return Promise.reject(error);
  }
);

export const clearTokens = () => {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
};

export const setTokens = (access: string, refresh: string) => {
  accessToken = access;
  refreshToken = refresh;
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  }
};

export const getAccessToken = () => accessToken;
export const getRefreshToken = () => refreshToken;

// Auth endpoints
export const authAPI = {
  login: (req: LoginRequest) => api.post<AuthResponse>('/auth/login', req),
  refresh: (req: RefreshRequest) => api.post<AuthResponse>('/auth/refresh', req),
  logout: (req: RefreshRequest) => api.post('/auth/logout', req),
};

// Incidents endpoints
export const incidentsAPI = {
  list: (query?: { status?: string; limit?: number; offset?: number }) =>
    api.get<PaginatedIncidents>('/incidents', { params: query }),
  getOne: (id: string) => api.get(`/incidents/${id}`),
  investigate: (id: string) => api.patch(`/incidents/${id}/investigate`),
  close: (id: string) => api.patch(`/incidents/${id}/close`),
  escalate: (id: string) => api.patch(`/incidents/${id}/escalate`),
  comment: (id: string, req: CreateCommentRequest) =>
    api.post(`/incidents/${id}/comments`, req),
  registerDecision: (id: string, req: RegisterDecisionRequest) =>
    api.post(`/incidents/${id}/decision`, req),
};

// Base WS URL — no token here. The backend's WsJwtGuard reads the token
// from socket.handshake.auth.token (the socket.io `auth` handshake
// field), not from a URL query param, so the token has to be passed via
// the `auth` option when calling io(), not appended to this URL.
export const getWSBaseUrl = () => process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000';

export default api;
