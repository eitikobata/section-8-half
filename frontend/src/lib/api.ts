import axios, { AxiosInstance, AxiosError } from 'axios';
import { AuthResponse, LoginRequest, CreateCommentRequest, RegisterDecisionRequest, PaginatedIncidents } from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// Access token lives in memory only now — never localStorage. The
// refresh token isn't handled here at all anymore: it's an httpOnly
// cookie the browser attaches automatically, invisible to this JS
// (that's the whole point — an XSS bug can't exfiltrate what the page
// can't read). Losing the in-memory accessToken on page reload is
// expected; AuthProvider calls /auth/refresh on mount to silently
// re-establish it from the cookie.
let accessToken: string | null = null;

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Required for the browser to send/receive the httpOnly refresh
  // cookie cross-origin (frontend and backend run on different ports
  // in dev, different subdomains possibly in prod).
  withCredentials: true,
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

    // Guard against refreshing a refresh call: if /auth/refresh itself
    // 401s, there's no cookie to recover from, and retrying it here
    // used to double the request and, on failure, hard-redirect to
    // '/' — which reloads the page, remounts AuthProvider, which
    // calls /auth/refresh on mount again, 401s again, and so on.
    // That loop was firing fast enough to trip the rate limiter (429).
    const isRefreshCall = originalRequest?.url?.includes('/auth/refresh');

    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshCall) {
      originalRequest._retry = true;

      try {
        // No body needed — the httpOnly refresh cookie goes along
        // automatically because of withCredentials above.
        const response = await axios.post<AuthResponse>(
          `${API_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        accessToken = response.data.accessToken;

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch {
        // Refresh failed — the cookie is gone/expired/invalid. Clear
        // in-memory state and send the user back to login, but only
        // if we're not already there (avoids reloading '/' onto
        // itself in a loop).
        clearAccessToken();
        if (typeof window !== 'undefined' && window.location.pathname !== '/') {
          window.location.href = '/';
        }
      }
    }

    return Promise.reject(error);
  }
);

export const clearAccessToken = () => {
  accessToken = null;
};

export const setAccessToken = (token: string) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

// Auth endpoints — refreshToken no longer appears in any request body;
// it travels exclusively via the httpOnly cookie the browser manages.
export const authAPI = {
  login: (req: LoginRequest) =>
    api.post<AuthResponse>('/auth/login', req),
  refresh: () => api.post<AuthResponse>('/auth/refresh', {}),
  logout: () => api.post('/auth/logout', {}),
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
