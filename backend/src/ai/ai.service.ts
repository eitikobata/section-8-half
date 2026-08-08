import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IncidentsGateway } from '../incidents/incidents.gateway';
import { aiConfig } from '../config/ai.config';
import { Agent, getRandomAgent } from './roster.agent';
import { RawEvent, Incident } from '@prisma/client';

/**
 * AI integration service (Bloco 4).
 *
 * Generates:
 * 1. Summary: Natural-language description of the incident
 * 2. Suggested severity: Re-evaluated by AI from raw events
 * 3. Agent suggestion: Which agent should lead response + protocol + rules
 *
 * All calls are async-fire-and-forget from the correlation engine:
 * an incident is created immediately, then this service enriches it
 * in the background and notifies the dashboard via WebSocket.
 */
@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: IncidentsGateway,
  ) {}

  /**
   * Background task: fetch the incident + events, call AI for all three
   * fields (summary, suggested severity, agent suggestion), persist, emit.
   * Fire-and-forget from correlation engine.
   */
  async generateSuggestion(incidentId: string): Promise<void> {
    try {
      const incident = await this.prisma.incident.findUnique({
        where: { id: incidentId },
        include: {
          entity: true,
          events: { orderBy: { occurredAt: 'asc' } },
        },
      });

      if (!incident) {
        this.logger.warn(`Incident ${incidentId} not found for AI analysis`);
        return;
      }

      this.logger.log(`Generating AI analysis for incident ${incidentId}`);

      // Call AI for summary
      const summary = await this.generateSummary(
        incident.entity.label || incident.entity.externalId,
        incident.events,
      );

      // Call AI for severity re-evaluation
      const suggestedSeverity = await this.suggestSeverity(
        summary,
        incident.events,
      );

      // Get agent suggestion
      const agentSuggestion = await this.suggestAgent(
        incident,
        incident.events,
        summary,
      );

      // Persist to DB. Also move NEW -> TRIAGED automatically: finishing
      // AI analysis IS the triage step, so the analyst shouldn't have to
      // click a separate button for something the system already did.
      // Guarded so it's a no-op if the incident already moved past NEW
      // (e.g. an analyst manually escalated it while analysis was running).
      const updated = await this.prisma.incident.update({
        where: { id: incidentId },
        data: {
          summary,
          suggestedSeverity,
          aiAgentSuggestion: {
            agentId: agentSuggestion.agentId,
            agentName: agentSuggestion.agentName,
            specialty: agentSuggestion.specialty,
            protocol: agentSuggestion.protocol,
            rulesOfEngagement: agentSuggestion.rulesOfEngagement,
          } as Record<string, string>,
          ...(incident.status === 'NEW' ? { status: 'TRIAGED' as const } : {}),
        },
      });

      this.logger.log(
        `Incident ${incidentId} analysis complete: severity ${suggestedSeverity}, agent ${agentSuggestion.agentName}`,
      );

      // Emit via WebSocket so dashboard updates without refetch
      this.gateway.emitIncidentAnalysis({
        id: updated.id,
        summary: updated.summary,
        suggestedSeverity: updated.suggestedSeverity,
        aiAgentSuggestion: updated.aiAgentSuggestion,
        status: updated.status,
      });
    } catch (error) {
      this.logger.error(
        `Failed to generate AI analysis for incident ${incidentId}: ${error}`,
      );
      // Don't fail the incident creation — just log and continue
    }
  }

  /**
   * Analyst decision registration: accept, partially accept, or override
   * the AI suggestion, then persist the final decision.
   */
  async registerAnalystDecision(
    incidentId: string,
    decision: {
      action: 'accept' | 'partial' | 'reject';
      agentId?: string;
      protocolOverride?: string;
      rulesOverride?: string;
    },
  ): Promise<{ id: string; analystDecision: unknown }> {
    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
    });
    if (!incident) {
      throw new Error(`Incident ${incidentId} not found`);
    }

    const agentSuggestion = incident.aiAgentSuggestion as Record<
      string,
      unknown
    > | null;
    const baseAgent = (agentSuggestion?.agentName as string) || 'unassigned';

    const analystDecision: Record<string, string | number | boolean | null> = {
      action: decision.action,
      timestamp: new Date().toISOString(),
      agentFinal:
        decision.agentId || (agentSuggestion?.agentId as string) || baseAgent,
      protocolFinal:
        decision.protocolOverride ||
        (agentSuggestion?.protocol as string) ||
        'STANDARD_RESPONSE',
      rulesFinal:
        decision.rulesOverride ||
        (agentSuggestion?.rulesOfEngagement as string) ||
        'Follow incident response playbook',
    };

    const updated = await this.prisma.incident.update({
      where: { id: incidentId },
      data: { analystDecision },
    });

    this.gateway.emitIncidentAnalysis({
      id: updated.id,
      analystDecision: updated.analystDecision,
    });

    return { id: updated.id, analystDecision };
  }

  // --- Private AI call methods ---

  private async generateSummary(
    entityLabel: string,
    events: RawEvent[],
  ): Promise<string> {
    if (aiConfig.provider === 'mock') {
      return `Mock summary: ${events.length} suspicious event(s) detected on ${entityLabel}`;
    }

    const eventSummary = events
      .map(
        (e, i) =>
          `${i + 1}. [${e.eventType}] severity ${e.severityRaw} at ${e.occurredAt.toISOString()}${
            e.metadata ? ` (${JSON.stringify(e.metadata)})` : ''
          }`,
      )
      .join('\n');

    const prompt = `
You are a cybersecurity analyst. Summarize this security incident in 1-2 sentences.
Entity: ${entityLabel}
Events:
${eventSummary}

Respond with ONLY the summary, no preamble.`;

    return this.callAi(prompt);
  }

  private async suggestSeverity(
    summary: string,
    events: RawEvent[],
  ): Promise<number> {
    if (aiConfig.provider === 'mock') {
      return Math.min(100, 30 + events.length * 10);
    }

    const prompt = `
You are a cybersecurity risk analyst. Given this incident summary and event data,
assign a severity score from 0-100 (0 = minimal, 100 = critical).

Summary: ${summary}
Number of events: ${events.length}
Event types: ${[...new Set(events.map((e) => e.eventType))].join(', ')}
Max raw severity reported: ${Math.max(...events.map((e) => e.severityRaw))}

Respond with ONLY a single number from 0-100, no explanation.`;

    const response = await this.callAi(prompt);
    const parsed = parseInt(response.trim(), 10);
    return Math.max(0, Math.min(100, parsed || 50));
  }

  private async suggestAgent(
    incident: Incident,
    events: RawEvent[],
    summary: string,
  ): Promise<{
    agentId: string;
    agentName: string;
    specialty: string;
    protocol: string;
    rulesOfEngagement: string;
  }> {
    if (aiConfig.provider === 'mock') {
      const agent = getRandomAgent();
      return {
        agentId: agent.id,
        agentName: agent.name,
        specialty: agent.specialty,
        protocol: 'MOCK_PROTOCOL_01',
        rulesOfEngagement: 'Investigate and report',
      };
    }

    const availableAgents = [
      'Echo (Network Intrusion Detection)',
      'Sentinel (Endpoint Forensics)',
      'Relay (Threat Hunting & Pattern Analysis)',
      'Nexus (Incident Containment)',
      'Prism (Threat Intelligence Integration)',
    ];

    const prompt = `
You are an incident commander assigning response teams. Based on the attack pattern,
suggest which agent should lead and what protocol they should follow.

Incident summary: ${summary}
Entity severity: ${incident.severity}
Event count: ${events.length}
Event types: ${[...new Set(events.map((e) => e.eventType))].join(', ')}

Available agents:
${availableAgents.map((a, i) => `${i + 1}. ${a}`).join('\n')}

Respond in this exact JSON format (no markdown, just JSON):
{
  "agentName": "Echo|Sentinel|Relay|Nexus|Prism",
  "protocol": "Brief protocol name (e.g., ISOLATE_AND_MONITOR)",
  "rulesOfEngagement": "Brief rules summary (e.g., Enable full network capture, restrict outbound traffic)"
}`;

    const response = await this.callAi(prompt);
    try {
      const parsed = JSON.parse(response.trim());
      const agentRoster: Record<string, { id: string; specialty: string }> = {
        Echo: { id: 'agent-alpha', specialty: 'Network Intrusion Detection' },
        Sentinel: { id: 'agent-bravo', specialty: 'Endpoint Forensics' },
        Relay: { id: 'agent-charlie', specialty: 'Threat Hunting & Pattern Analysis' },
        Nexus: { id: 'agent-delta', specialty: 'Incident Containment' },
        Prism: { id: 'agent-echo', specialty: 'Threat Intelligence Integration' },
      };

      const agent =
        agentRoster[parsed.agentName] || agentRoster['Echo'];

      return {
        agentId: agent.id,
        agentName: parsed.agentName || 'Echo',
        specialty: agent.specialty,
        protocol: parsed.protocol || 'STANDARD_RESPONSE',
        rulesOfEngagement:
          parsed.rulesOfEngagement || 'Follow incident response playbook',
      };
    } catch {
      // Fallback if AI doesn't return valid JSON
      const fallback = getRandomAgent();
      return {
        agentId: fallback.id,
        agentName: fallback.name,
        specialty: fallback.specialty,
        protocol: 'STANDARD_RESPONSE',
        rulesOfEngagement: 'Follow incident response playbook',
      };
    }
  }

  // --- HTTP call to LLM provider ---

  private async callAi(prompt: string): Promise<string> {
    if (aiConfig.provider === 'mock') {
      return 'Mock response';
    }

    if (aiConfig.provider === 'claude') {
      return this.callClaude(prompt);
    }

    if (aiConfig.provider === 'gemini') {
      return this.callGemini(prompt);
    }

    throw new Error(`Unknown AI provider: ${aiConfig.provider}`);
  }

  private async callClaude(prompt: string): Promise<string> {
    if (!aiConfig.claudeApiKey) {
      throw new Error('CLAUDE_API_KEY not configured');
    }

    if (aiConfig.debug) {
      this.logger.debug(`[Claude] Prompt:\n${prompt}`);
    }

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': aiConfig.claudeApiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: aiConfig.claudeModel,
          max_tokens: 500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Claude API error: ${response.status} ${error}`);
      }

      const data = (await response.json()) as {
        content: Array<{ type: string; text?: string }>;
      };
      const text =
        data.content.find((c) => c.type === 'text')?.text || 'No response';

      if (aiConfig.debug) {
        this.logger.debug(`[Claude] Response:\n${text}`);
      }

      return text;
    } catch (error) {
      this.logger.error(`Claude API call failed: ${error}`);
      throw error;
    }
  }

  private async callGemini(prompt: string): Promise<string> {
    if (!aiConfig.geminiApiKey) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    if (aiConfig.debug) {
      this.logger.debug(`[Gemini] Prompt:\n${prompt}`);
    }

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${aiConfig.geminiModel}:generateContent?key=${aiConfig.geminiApiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            safetySettings: [],
          }),
        },
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${error}`);
      }

      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const text =
        data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';

      if (aiConfig.debug) {
        this.logger.debug(`[Gemini] Response:\n${text}`);
      }

      return text;
    } catch (error) {
      this.logger.error(`Gemini API call failed: ${error}`);
      throw error;
    }
  }
}
