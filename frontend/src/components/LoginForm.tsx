'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export function LoginForm() {
  const router = useRouter();
  const { login, isLoading, error } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    try {
      await login({ username, password });
      router.push('/dashboard');
    } catch (err: any) {
      setLocalError(err.message || 'Login failed');
    }
  };

  const handleAutoFill = () => {
    setUsername('analyst-demo');
    setPassword('demo12345');
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <div>
          <label className="block text-cyberpunk-accent text-sm mb-2">Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="analyst-demo"
            className="w-full px-3 py-2 bg-gray-900 border border-cyberpunk-accent text-white placeholder-gray-500 focus:outline-none focus:border-cyberpunk-pink"
            disabled={isLoading}
          />
        </div>

        <div>
          <label className="block text-cyberpunk-accent text-sm mb-2">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-3 py-2 bg-gray-900 border border-cyberpunk-accent text-white placeholder-gray-500 focus:outline-none focus:border-cyberpunk-pink"
            disabled={isLoading}
          />
        </div>

        {(error || localError) && (
          <div className="text-cyberpunk-pink text-sm">{error || localError}</div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-2 border border-cyberpunk-accent text-cyberpunk-accent hover:bg-cyberpunk-accent hover:text-black transition disabled:opacity-50"
        >
          {isLoading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>

      <button
        onClick={handleAutoFill}
        disabled={isLoading}
        className="px-4 py-2 border border-cyberpunk-pink text-cyberpunk-pink hover:bg-cyberpunk-pink hover:text-black transition disabled:opacity-50"
      >
        Auto-fill Demo
      </button>
    </div>
  );
}
