'use client';

import React, { createContext, ReactNode, useEffect, useState } from 'react';
import { authAPI, setTokens, clearTokens, getAccessToken, getRefreshToken } from '@/lib/api';
import { User, LoginRequest, AuthResponse } from '@/lib/types';

export interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (req: LoginRequest) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  error: string | null;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = getAccessToken();
    if (token) {
      // Decode JWT to get user info (for MVP, we store user in login response)
      // In a real app, you'd verify with /auth/me endpoint
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUser({
          id: payload.sub,
          username: payload.username,
          role: payload.role,
        });
      } catch {
        clearTokens();
      }
    }
    setIsLoading(false);
  }, []);

  // Auto-refresh token 1 min before expiry (access token is 15min)
  useEffect(() => {
    if (!user || !getRefreshToken()) return;

    const timer = setInterval(async () => {
      try {
        const response = await authAPI.refresh({ refreshToken: getRefreshToken()! });
        setTokens(response.data.accessToken, response.data.refreshToken);
      } catch {
        clearTokens();
        setUser(null);
      }
    }, 14 * 60 * 1000); // 14 minutes

    return () => clearInterval(timer);
  }, [user]);

  const login = async (req: LoginRequest) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await authAPI.login(req);
      setTokens(response.data.accessToken, response.data.refreshToken);
      setUser(response.data.user);
      return response.data;
    } catch (err: any) {
      const message = err.response?.data?.message || 'Login failed';
      setError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      const token = getRefreshToken();
      if (token) {
        await authAPI.logout({ refreshToken: token });
      }
    } finally {
      clearTokens();
      setUser(null);
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
