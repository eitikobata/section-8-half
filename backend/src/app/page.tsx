'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { LoginForm } from '@/components/LoginForm';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-cyberpunk-accent animate-pulse">Initializing...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="border-2 border-cyberpunk-accent p-8 bg-cyberpunk-bg">
          <h1 className="text-cyberpunk-accent text-3xl font-bold mb-2">Section 8½</h1>
          <p className="text-gray-400 text-sm mb-8">Threat Correlation Engine</p>

          <LoginForm />
        </div>

        <div className="mt-4 text-center text-gray-500 text-xs">
          Demo credentials: analyst-demo / demo12345
        </div>
      </div>
    </div>
  );
}
