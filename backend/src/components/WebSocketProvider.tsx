'use client';

import React, { createContext, ReactNode, useEffect, useState } from 'react';
import { Socket, io } from 'socket.io-client';
import { getWSBaseUrl, getAccessToken } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';
import { Incident } from '@/lib/types';

export interface WebSocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  newIncidents: Incident[];
  updatedIncidents: Map<string, Incident>;
}

export const WebSocketContext = createContext<WebSocketContextType | undefined>(undefined);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [newIncidents, setNewIncidents] = useState<Incident[]>([]);
  const [updatedIncidents, setUpdatedIncidents] = useState<Map<string, Incident>>(new Map());

  useEffect(() => {
    if (!isAuthenticated) return;

    const wsBaseUrl = getWSBaseUrl();
    // The token goes in `auth`, not the URL — this is the field
    // backend/src/auth/guards/ws-jwt.guard.ts actually reads
    // (socket.handshake.auth.token). Using a callback here (instead of
    // a fixed object) means every reconnection attempt re-reads
    // getAccessToken() at that moment, so if the token was refreshed
    // in between (access tokens expire every 15min), reconnects use
    // the current one instead of getting stuck retrying with a token
    // that's since gone stale.
    const newSocket = io(wsBaseUrl, {
      auth: (cb) => cb({ token: getAccessToken() }),
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => {
      setIsConnected(true);
      console.log('[WS] Connected');
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[WS] Disconnected');
    });

    // Surfaces the actual rejection reason (e.g. auth failure) instead
    // of just seeing a silent connect->disconnect loop with no clue why.
    newSocket.on('connect_error', (err) => {
      console.warn('[WS] Connection error:', err.message);
    });

    // Incoming events
    newSocket.on('incident.created', (incident: Incident) => {
      setNewIncidents((prev) => [incident, ...prev].slice(0, 10)); // Keep latest 10
    });

    newSocket.on('incident.updated', (incident: Incident) => {
      setUpdatedIncidents((prev) => new Map(prev).set(incident.id, incident));
    });

    newSocket.on('incident.analysis', (incident: Incident) => {
      setUpdatedIncidents((prev) => new Map(prev).set(incident.id, incident));
    });

    newSocket.on('incident.comment', (data: { incidentId: string }) => {
      console.log('[WS] New comment on', data.incidentId);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, [isAuthenticated]);

  return (
    <WebSocketContext.Provider
      value={{
        socket,
        isConnected,
        newIncidents,
        updatedIncidents,
      }}
    >
      {children}
    </WebSocketContext.Provider>
  );
}
