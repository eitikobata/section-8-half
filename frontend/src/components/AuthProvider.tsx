'use client';

import React, { createContext, ReactNode, useEffect, useState } from 'react';
import { authAPI, setAccessToken, clearAccessToken, getAccessToken } from '@/lib/api';
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

  // Silent refresh on mount: the access token lives in memory only, so
  // it's gone after any page reload. The httpOnly refresh cookie
  // survives reloads (that's the point), so we use it here to quietly
  // re-establish a session without the user having to log in again —
  // same UX as before, just without anything sitting in localStorage.
  useEffect(() => {
    authAPI
      .refresh()
      .then((response) => {
        setAccessToken(response.data.accessToken);
        setUser(response.data.user);
      })
      .catch(() => {
        // No valid cookie (never logged in, or it expired) — that's a
        // normal, silent "logged out" state, not an error to surface.
        clearAccessToken();
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Auto-refresh token 1 min before expiry (access token is 15min).
  useEffect(() => {
    if (!user) return;

    const timer = setInterval(async () => {
      try {
        const response = await authAPI.refresh();
        setAccessToken(response.data.accessToken);
      } catch {
        clearAccessToken();
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
      setAccessToken(response.data.accessToken);
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
      await authAPI.logout();
    } finally {
      clearAccessToken();
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
