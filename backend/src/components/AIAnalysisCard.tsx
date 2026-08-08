'use client';

import React, { useState } from 'react';
import { CountdownTimer } from './CountdownTimer';
import { Incident, AIAnalysis } from '@/lib/types';
import { incidentsAPI } from '@/lib/api';
import { AGENT_ROSTER, PROTOCOL_OPTIONS, RULES_OF_ENGAGEMENT_OPTIONS } from '@/lib/roster';
import { DispatchCharacter } from './DispatchCharacter';

interface AIAnalysisCardProps {
  incident: Incident;
  onDecisionSubmitted?: (incident: Incident) => void;
}

export function AIAnalysisCard({ incident, onDecisionSubmitted }: AIAnalysisCardProps) {
  const analysis = incident.aiAgentSuggestion as AIAnalysis | undefined;
  const alreadyDecided = !!incident.analystDecision;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ action: string; timestamp: string } | null>(null);
  const [showPartialForm, setShowPartialForm] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [formData, setFormData] = useState({
    agent: '',
    protocol: '',
    rules: '',
  });

  const decisionTimeout = parseInt(
    process.env.NEXT_PUBLIC_INCIDENT_DECISION_TIMEOUT_MS || '120000',
    10
  );

  if (!analysis) {
    return (
      <div>
        <DispatchCharacter />
        <div className="p-3 border border-cyberpunk-warn bg-gray-900">
          <p className="text-cyberpunk-warn text-sm">⚠ Pending AI analysis...</p>
        </div>
      </div>
    );
  }

  const submitDecision = async (
    action: 'accept' | 'partial' | 'reject',
    overrides?: { agentId?: string; protocolOverride?: string; rulesOverride?: string }
  ) => {
    setLoading(true);
    setError(null);
    try {
      await incidentsAPI.registerDecision(incident.id, {
        action,
        agentId: overrides?.agentId || undefined,
        protocolOverride: overrides?.protocolOverride || undefined,
        rulesOverride: overrides?.rulesOverride || undefined,
      });
      setSuccess({ action, timestamp: new Date().toLocaleTimeString() });
      setShowPartialForm(false);
      setShowRejectForm(false);
      onDecisionSubmitted?.(incident);
    } catch (err: any) {
      // This is the fix: errors were being swallowed before (try/finally,
      // no catch) — a failed request looked identical to a successful one.
      const message =
        err?.response?.data?.message || err?.message || 'Failed to register decision';
      setError(Array.isArray(message) ? message.join(', ') : message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = () => submitDecision('accept');

  const handlePartialSubmit = () =>
    submitDecision('partial', {
      agentId: formData.agent,
      protocolOverride: formData.protocol,
      rulesOverride: formData.rules,
    });

  const handleRejectSubmit = () =>
    submitDecision('reject', {
      agentId: formData.agent,
      protocolOverride: formData.protocol,
      rulesOverride: formData.rules,
    });

  return (
    <div>
      <DispatchCharacter />
      <div className="border-2 border-cyberpunk-accent p-3 bg-gray-900 space-y-3">
      <div>
        <h3 className="text-cyberpunk-accent font-mono text-sm mb-1">AI SUGGESTION</h3>
        <div className="text-xs space-y-0.5 text-gray-300">
          <p>
            <span className="text-cyberpunk-pink">Agent:</span> {analysis.agentName} ({analysis.specialty})
          </p>
          <p>
            <span className="text-cyberpunk-pink">Protocol:</span> {analysis.protocol}
          </p>
          <p>
            <span className="text-cyberpunk-pink">Rules:</span> {analysis.rulesOfEngagement}
          </p>
        </div>
      </div>

      {success && (
        <div className="p-2 border border-cyberpunk-success bg-gray-800 text-cyberpunk-success text-xs">
          ✓ Decision Registered ({success.action}) — {success.timestamp}
        </div>
      )}

      {error && (
        <div className="p-2 border border-cyberpunk-pink bg-gray-800 text-cyberpunk-pink text-xs">
          ✕ {error}
        </div>
      )}

      {!alreadyDecided && !success && (
        <>
          <CountdownTimer initialMs={decisionTimeout} />

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={handleAccept}
              disabled={loading}
              className="px-2 py-1.5 border border-cyberpunk-success text-cyberpunk-success text-sm hover:bg-cyberpunk-success hover:text-black transition disabled:opacity-50"
            >
              {loading ? '...' : 'Accept'}
            </button>

            <button
              onClick={() => {
                setShowPartialForm(!showPartialForm);
                setShowRejectForm(false);
              }}
              disabled={loading}
              className="px-2 py-1.5 border border-cyberpunk-warn text-cyberpunk-warn text-sm hover:bg-cyberpunk-warn hover:text-black transition disabled:opacity-50"
            >
              Partial
            </button>

            <button
              onClick={() => {
                setShowRejectForm(!showRejectForm);
                setShowPartialForm(false);
              }}
              disabled={loading}
              className="px-2 py-1.5 border border-cyberpunk-pink text-cyberpunk-pink text-sm hover:bg-cyberpunk-pink hover:text-black transition disabled:opacity-50"
            >
              Reject
            </button>
          </div>
        </>
      )}

      {(showPartialForm || showRejectForm) && (
        <div
          className={`p-3 bg-gray-800 border space-y-3 ${
            showPartialForm ? 'border-cyberpunk-warn' : 'border-cyberpunk-pink'
          }`}
        >
          <div>
            <label className="block text-gray-400 text-sm mb-1.5">Agent</label>
            <select
              value={formData.agent}
              onChange={(e) => setFormData((p) => ({ ...p, agent: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-white text-sm"
              disabled={loading}
            >
              <option value="">Keep AI suggestion ({analysis.agentName})</option>
              {AGENT_ROSTER.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} — {a.specialty}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1.5">Protocol</label>
            <select
              value={formData.protocol}
              onChange={(e) => setFormData((p) => ({ ...p, protocol: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-white text-sm"
              disabled={loading}
            >
              <option value="">Keep AI suggestion ({analysis.protocol})</option>
              {PROTOCOL_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-gray-400 text-sm mb-1.5">Rules of Engagement</label>
            <select
              value={formData.rules}
              onChange={(e) => setFormData((p) => ({ ...p, rules: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 text-white text-sm"
              disabled={loading}
            >
              <option value="">Keep AI suggestion ({analysis.rulesOfEngagement})</option>
              {RULES_OF_ENGAGEMENT_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {r.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={showPartialForm ? handlePartialSubmit : handleRejectSubmit}
            disabled={loading}
            className={`w-full px-3 py-1.5 border text-sm transition disabled:opacity-50 ${
              showPartialForm
                ? 'border-cyberpunk-warn text-cyberpunk-warn hover:bg-cyberpunk-warn hover:text-black'
                : 'border-cyberpunk-pink text-cyberpunk-pink hover:bg-cyberpunk-pink hover:text-black'
            }`}
          >
            {loading ? 'Deploying...' : 'Deploy'}
          </button>
        </div>
      )}
      </div>
    </div>
  );
}
