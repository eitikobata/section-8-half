'use client';

import React, { useState } from 'react';
import { AIAnalysisCard } from './AIAnalysisCard';
import { Incident, IncidentStatus } from '@/lib/types';
import { incidentsAPI } from '@/lib/api';
import { useAuth } from '@/hooks/useAuth';

interface IncidentDetailModalProps {
  incident: Incident | null;
  onClose: () => void;
  onRefresh?: () => void;
}

const STATUS_COLORS: Record<IncidentStatus, string> = {
  [IncidentStatus.NEW]: 'text-cyberpunk-pink',
  [IncidentStatus.TRIAGED]: 'text-cyberpunk-warn',
  [IncidentStatus.RESPONSE_DEPLOYED]: 'text-cyberpunk-accent',
  [IncidentStatus.CLOSED]: 'text-cyberpunk-success',
  [IncidentStatus.ESCALATED]: 'text-cyberpunk-pink',
};

// Mirrors ALLOWED_TRANSITIONS in backend/src/incidents/incidents.service.ts.
// NEW -> TRIAGED and TRIAGED -> RESPONSE_DEPLOYED happen automatically
// (AI analysis completing, decision being registered) — they're not
// buttons here. Close and Escalate stay manual, from any active state.
const ALLOWED_TRANSITIONS: Record<IncidentStatus, IncidentStatus[]> = {
  [IncidentStatus.NEW]: [IncidentStatus.TRIAGED, IncidentStatus.ESCALATED, IncidentStatus.CLOSED],
  [IncidentStatus.TRIAGED]: [IncidentStatus.RESPONSE_DEPLOYED, IncidentStatus.ESCALATED, IncidentStatus.CLOSED],
  [IncidentStatus.RESPONSE_DEPLOYED]: [IncidentStatus.ESCALATED, IncidentStatus.CLOSED],
  [IncidentStatus.ESCALATED]: [IncidentStatus.CLOSED],
  [IncidentStatus.CLOSED]: [],
};

export function IncidentDetailModal({ incident, onClose, onRefresh }: IncidentDetailModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [commentError, setCommentError] = useState<string | null>(null);
  const [comments, setComments] = useState(incident?.comments || []);

  if (!incident) return null;

  const handleStatusChange = async (status: 'close' | 'escalate') => {
    setLoading(true);
    setStatusError(null);
    try {
      if (status === 'close') {
        await incidentsAPI.close(incident.id);
      } else {
        await incidentsAPI.escalate(incident.id);
      }
      onRefresh?.();
    } catch (err: any) {
      const message =
        err?.response?.data?.message || err?.message || 'Failed to update status';
      setStatusError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim()) return;

    setLoading(true);
    setCommentError(null);
    try {
      await incidentsAPI.comment(incident.id, { body: commentText });
      setComments((prev) => [
        ...prev,
        {
          id: Date.now().toString(),
          incidentId: incident.id,
          authorId: user?.id || '',
          body: commentText,
          createdAt: new Date().toISOString(),
        },
      ]);
      setCommentText('');
      onRefresh?.();
    } catch (err: any) {
      const message =
        err?.response?.data?.message || err?.message || 'Failed to post comment';
      setCommentError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4">
      <div className="bg-cyberpunk-bg border-2 border-cyberpunk-accent w-full max-w-2xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="border-b border-cyberpunk-accent p-4 flex justify-between items-start shrink-0">
          <div>
            <h2 className="text-cyberpunk-accent font-mono text-base">
              Incident {incident.id.slice(0, 8)}
            </h2>
            <p className={`${STATUS_COLORS[incident.status]} font-mono text-xs`}>
              {incident.status.replace(/_/g, ' ')}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-cyberpunk-accent hover:text-cyberpunk-pink transition"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto">
          {/* Summary */}
          {incident.summary && (
            <div>
              <p className="text-cyberpunk-accent text-xs mb-1">AI SUMMARY</p>
              <p className="text-gray-300 text-xs">{incident.summary}</p>
            </div>
          )}

          {/* Timeline */}
          {incident.events && incident.events.length > 0 && (
            <div>
              <p className="text-cyberpunk-accent text-xs mb-1">TIMELINE</p>
              <div className="space-y-0.5 max-h-24 overflow-y-auto">
                {incident.events.map((event) => (
                  <div key={event.id} className="text-xs text-gray-400 font-mono">
                    <span className="text-cyberpunk-pink">{event.eventType}</span> @{' '}
                    {new Date(event.occurredAt).toLocaleTimeString()} | Sev: {event.severityRaw}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status Actions — only Close/Escalate: NEW->TRIAGED->RESPONSE_DEPLOYED
              happen automatically (AI analysis, decision registration) */}
          <div>
            <div className="flex gap-2">
              <button
                onClick={() => handleStatusChange('escalate')}
                disabled={
                  loading || !ALLOWED_TRANSITIONS[incident.status].includes(IncidentStatus.ESCALATED)
                }
                className="flex-1 px-3 py-1.5 border border-cyberpunk-pink text-cyberpunk-pink text-sm hover:bg-cyberpunk-pink hover:text-black transition disabled:opacity-50"
              >
                Escalate
              </button>
              <button
                onClick={() => handleStatusChange('close')}
                disabled={
                  loading || !ALLOWED_TRANSITIONS[incident.status].includes(IncidentStatus.CLOSED)
                }
                className="flex-1 px-3 py-1.5 border border-cyberpunk-success text-cyberpunk-success text-sm hover:bg-cyberpunk-success hover:text-black transition disabled:opacity-50"
              >
                Close
              </button>
            </div>
            {statusError && (
              <p className="text-cyberpunk-pink text-xs mt-1">✕ {statusError}</p>
            )}
          </div>

          {/* AI Analysis Card */}
          <AIAnalysisCard incident={incident} onDecisionSubmitted={onRefresh} />

          {/* Comments */}
          <div>
            <p className="text-cyberpunk-accent text-xs mb-1">COMMENTS</p>
            <div className="space-y-1 max-h-20 overflow-y-auto mb-2 border border-gray-800 p-2">
              {comments.length === 0 && (
                <p className="text-gray-600 text-xs">No comments yet.</p>
              )}
              {comments.map((c) => (
                <div key={c.id} className="text-xs text-gray-400">
                  <span className="text-cyberpunk-accent">{c.author?.username || 'Unknown'}:</span>{' '}
                  {c.body}
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add comment..."
                className="flex-1 px-2 py-1 bg-gray-900 border border-gray-700 text-white text-xs"
                disabled={loading}
              />
              <button
                onClick={handleAddComment}
                disabled={loading || !commentText.trim()}
                className="px-3 py-1 border border-cyberpunk-accent text-cyberpunk-accent text-xs hover:bg-cyberpunk-accent hover:text-black transition disabled:opacity-50"
              >
                Post
              </button>
            </div>
            {commentError && (
              <p className="text-cyberpunk-pink text-xs mt-1">✕ {commentError}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
