import type { Metadata } from 'next';
import { AuthProvider } from '@/components/AuthProvider';
import { WebSocketProvider } from '@/components/WebSocketProvider';
import { QueryClientProvider } from '@/components/QueryClientProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Section 8½ - Threat Correlation Engine',
  description: 'SIEM-inspired threat correlation dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-cyberpunk-bg text-white font-mono antialiased">
        <QueryClientProvider>
          <AuthProvider>
            <WebSocketProvider>{children}</WebSocketProvider>
          </AuthProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
