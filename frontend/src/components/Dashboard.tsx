'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IncidentDetailModal } from './IncidentDetailModal';
import { AlertFlash } from './AlertFlash';
import { AlertBanner } from './AlertBanner';
import { AlertSound } from './AlertSound';
import { incidentsAPI } from '@/lib/api';
import { getMuted, setMuted as persistMuted } from '@/lib/soundPrefs';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAuth } from '@/hooks/useAuth';
import { Incident, IncidentStatus } from '@/lib/types';

const STATUS_COLORS: Record<IncidentStatus, { bg: string; text: string }> = {
  [IncidentStatus.NEW]: { bg: 'bg-cyberpunk-pink', text: 'text-cyberpunk-pink' },
  [IncidentStatus.TRIAGED]: { bg: 'bg-cyberpunk-warn', text: 'text-cyberpunk-warn' },
  [IncidentStatus.RESPONSE_DEPLOYED]: { bg: 'bg-cyberpunk-accent', text: 'text-cyberpunk-accent' },
  [IncidentStatus.CLOSED]: { bg: 'bg-cyberpunk-success', text: 'text-cyberpunk-success' },
  [IncidentStatus.ESCALATED]: { bg: 'bg-cyberpunk-pink', text: 'text-cyberpunk-pink' },
};

// "Active" for threat-level/badge purposes: anything not yet closed.
const isActive = (status: IncidentStatus) => status !== IncidentStatus.CLOSED;

// "Unresolved" = still needs the analyst to act (hasn't been triaged/
// dispatched yet). This is what drives the flash + siren + banner —
// RESPONSE_DEPLOYED means someone's already on it, so it doesn't need
// to keep shouting for attention.
const needsAttention = (status: IncidentStatus) =>
  status === IncidentStatus.NEW || status === IncidentStatus.TRIAGED;

export function Dashboard() {
  const { user, logout } = useAuth();
  const { newIncidents, updatedIncidents } = useWebSocket();
  const [timestamp, setTimestamp] = useState(new Date());
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [flashKey, setFlashKey] = useState(0);
  const [muted, setMutedState] = useState(false);
  const lastSeenIncidentId = useRef<string | null>(null);

  // Load persisted mute preference on mount (client-only, avoids SSR
  // hydration mismatch since localStorage isn't available server-side).
  useEffect(() => {
    setMutedState(getMuted());
  }, []);

  const toggleMuted = () => {
    setMutedState((prev) => {
      const next = !prev;
      persistMuted(next);
      return next;
    });
  };

  // Real-time clock — 1s tick. Purely client-side (Date() + setInterval),
  // no network/backend calls involved, so this costs nothing server-side.
  useEffect(() => {
    const timer = setInterval(() => setTimestamp(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch incidents (historical + current status)
  // Backend returns a paginated shape: { items, total, limit, offset } —
  // not a bare array — so we unwrap .items here before it hits the component.
  const { data: incidents = [], refetch } = useQuery<Incident[]>({
    queryKey: ['incidents'],
    queryFn: async () => {
      const response = await incidentsAPI.list({ limit: 50 });
      return response.data.items ?? [];
    },
    refetchInterval: 10000, // Every 10s
  });

  // Combine fetched + new incidents from WebSocket, then apply any
  // partial patches (status/severity/analysis changes) that arrived via
  // incident.updated / incident.analysis — without this, automatic
  // transitions like NEW -> TRIAGED wouldn't show up until the next
  // 10s refetch.
  const baseIncidents = [
    ...newIncidents,
    ...incidents.filter((i) => !newIncidents.find((ni) => ni.id === i.id)),
  ];
  const allIncidents = baseIncidents.map((incident) => {
    const patch = updatedIncidents.get(incident.id);
    return patch ? { ...incident, ...patch } : incident;
  });

  // If the currently-open modal's incident just got patched (e.g. AI
  // analysis completed while the analyst was looking at it), merge that
  // into the open modal too, so "Pending AI analysis..." turns into the
  // decision menu live instead of requiring a close/reopen.
  useEffect(() => {
    if (!selectedIncident) return;
    const patch = updatedIncidents.get(selectedIncident.id);
    if (patch) {
      setSelectedIncident((prev) => (prev ? { ...prev, ...patch } : prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatedIncidents]);

  // Trigger a flash + siren whenever a genuinely new incident shows up
  // over the socket. Watching newIncidents[0]?.id (not just .length) so
  // it still fires correctly even if the array gets capped/reset.
  useEffect(() => {
    const topId = newIncidents[0]?.id;
    if (topId && topId !== lastSeenIncidentId.current) {
      lastSeenIncidentId.current = topId;
      setFlashKey((k) => k + 1);
    }
  }, [newIncidents]);

  const unresolvedCount = allIncidents.filter((i) => needsAttention(i.status)).length;

  // Get unique entities
  const entities = Array.from(
    new Map(
      allIncidents
        .filter((i) => i.entity)
        .map((i) => [i.entity!.id, i.entity!])
    ).values()
  );

  // Calculate threat level per entity (highest severity of active incidents)
  const getThreatLevel = (entityId: string) => {
    const entityIncidents = allIncidents.filter(
      (i) => i.entityId === entityId && isActive(i.status)
    );
    return entityIncidents.length > 0
      ? Math.max(...entityIncidents.map((i) => i.severity || 50))
      : 0;
  };

  return (
    <div className="min-h-screen bg-cyberpunk-bg text-white font-mono">
      <AlertFlash flashKey={flashKey} />
      <AlertSound triggerKey={flashKey} muted={muted} />

      {/* Header */}
      <header className="border-b border-cyberpunk-accent p-4 flex justify-between items-center">
        <div>
          <h1 className="text-cyberpunk-accent text-lg">Section 8½</h1>
          <p className="text-gray-400 text-xs">Threat Correlation Engine</p>
        </div>
        <div className="flex gap-4 items-center">
          {unresolvedCount > 0 && (
            <div className="text-right">
              <p className="danger-pulse text-cyberpunk-pink text-sm font-bold">
                ⚠ {unresolvedCount} UNRESOLVED
              </p>
            </div>
          )}
          <div className="text-right">
            <p className="text-gray-400 text-xs">Analyst</p>
            <p className="text-cyberpunk-accent">{user?.username}</p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs">Local Time</p>
            <p className="text-cyberpunk-accent text-sm">
              {timestamp.toLocaleTimeString()}
            </p>
          </div>
          <button
            onClick={toggleMuted}
            title={muted ? 'Unmute alert sound' : 'Mute alert sound'}
            className="px-3 py-1 border border-gray-600 text-gray-400 hover:border-cyberpunk-accent hover:text-cyberpunk-accent transition text-sm"
          >
            {muted ? '🔇' : '🔊'}
          </button>
          <button
            onClick={() => logout().then(() => window.location.href = '/')}
            className="px-3 py-1 border border-cyberpunk-pink text-cyberpunk-pink hover:bg-cyberpunk-pink hover:text-black transition text-sm"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Full-bleed alert banner — spans the entire site width, sits
          right above the Monitored Entities panel. Only visible while
          there's something unresolved. */}
      <AlertBanner unresolvedCount={unresolvedCount} />

      <div className="grid grid-cols-4 gap-4 p-4 min-h-[calc(100vh-80px)]">
        {/* Left: Entity Grid */}
        <div className="col-span-3 space-y-4">
          <div className="border-b border-cyberpunk-accent pb-2">
            <h2 className="text-cyberpunk-accent">MONITORED ENTITIES ({entities.length})</h2>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {entities.map((entity) => {
              const threat = getThreatLevel(entity.id);
              const threatColor =
                threat > 75
                  ? 'border-cyberpunk-pink'
                  : threat > 40
                    ? 'border-cyberpunk-warn'
                    : 'border-cyberpunk-success';

              const activeIncidents = allIncidents.filter(
                (i) => i.entityId === entity.id && isActive(i.status)
              ).length;

              return (
                <div
                  key={entity.id}
                  className={`border ${threatColor} p-3 bg-gray-900 cursor-pointer hover:bg-gray-800 transition`}
                >
                  <p className="text-cyberpunk-accent text-sm">{entity.label || entity.externalId}</p>
                  <p className="text-xs text-gray-400 mb-2">Type: {entity.type || 'unknown'}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-400">Threat: {threat}</span>
                    {activeIncidents > 0 && (
                      <span className="px-2 py-1 bg-cyberpunk-pink text-black text-xs font-bold">
                        {activeIncidents} Active
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Live Feed */}
        <div className="border-l border-cyberpunk-accent pl-4 space-y-4">
          <div className="border-b border-cyberpunk-accent pb-2">
            <h2 className="text-cyberpunk-accent">LIVE FEED ({allIncidents.length})</h2>
          </div>

          <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto">
            {allIncidents.slice(0, 15).map((incident) => (
              <div
                key={incident.id}
                onClick={() => setSelectedIncident(incident)}
                className={`p-2 border-l-4 ${STATUS_COLORS[incident.status].bg} bg-gray-900 cursor-pointer hover:bg-gray-800 transition`}
              >
                <p className="text-xs font-mono">
                  <span className="text-cyberpunk-accent">{incident.id.slice(0, 6)}</span>
                </p>
                <p className="text-xs text-gray-400">
                  {incident.entity?.externalId || 'unknown'}
                </p>
                <div className="flex justify-between items-center mt-1">
                  <span className={`text-xs ${STATUS_COLORS[incident.status].text}`}>
                    {incident.status.replace(/_/g, ' ')}
                  </span>
                  {incident.severity && (
                    <span className="text-xs text-cyberpunk-pink font-bold">
                      Sev: {incident.severity}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Incident Detail Modal — conditionally mounted (not just internally
          returning null) and keyed by incident id, so error/success state
          inside the modal and AI card resets fresh every time a different
          incident is opened, instead of leaking across opens. */}
      {selectedIncident && (
        <IncidentDetailModal
          key={selectedIncident.id}
          incident={selectedIncident}
          onClose={() => setSelectedIncident(null)}
          onRefresh={() => {
            refetch();
            incidentsAPI.getOne(selectedIncident.id).then((res) => {
              setSelectedIncident(res.data);
            });
          }}
        />
      )}
    </div>
  );
}
