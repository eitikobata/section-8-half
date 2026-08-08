// Backend API types — mirrors Prisma schema + DTOs

export enum IncidentStatus {
  NEW = 'NEW',
  TRIAGED = 'TRIAGED',
  RESPONSE_DEPLOYED = 'RESPONSE_DEPLOYED',
  ESCALATED = 'ESCALATED',
  CLOSED = 'CLOSED',
}

export interface User {
  id: string;
  username: string;
  role: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface Entity {
  id: string;
  externalId: string;
  label?: string;
  type?: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RawEvent {
  id: string;
  entityId: string;
  eventType: string;
  location?: string;
  severityRaw: number;
  occurredAt: string;
  receivedAt: string;
  metadata?: Record<string, any>;
}

export interface Agent {
  id: string;
  name: string;
  specialty: string;
  description?: string;
}

export interface AIAnalysis {
  agentId: string;
  agentName: string;
  specialty: string;
  protocol: string;
  rulesOfEngagement: string;
}

export interface AnalystDecision {
  action: 'accept' | 'partial' | 'reject';
  agentFinal?: string;
  protocolFinal?: string;
  rulesFinal?: string;
  timestamp: string;
}

export interface IncidentComment {
  id: string;
  incidentId: string;
  authorId: string;
  author?: { username: string };
  body: string;
  createdAt: string;
}

export interface Incident {
  id: string;
  entityId: string;
  entity?: Entity;
  status: IncidentStatus;
  severity?: number;
  summary?: string;
  suggestedSeverity?: number;
  aiAgentSuggestion?: AIAnalysis;
  analystDecision?: AnalystDecision;
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
  events?: RawEvent[];
  comments?: IncidentComment[];
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface RefreshRequest {
  refreshToken: string;
}

export interface CreateCommentRequest {
  body: string;
}

export interface RegisterDecisionRequest {
  action: 'accept' | 'partial' | 'reject';
  agentId?: string;
  protocolOverride?: string;
  rulesOverride?: string;
}

export interface ListIncidentsQuery {
  status?: IncidentStatus;
  entityId?: string;
  limit?: number;
  offset?: number;
}

// Matches IncidentsService.list() return shape on the backend:
// { items, total, limit, offset } — NOT a bare array.
export interface PaginatedIncidents {
  items: Incident[];
  total: number;
  limit: number;
  offset: number;
}
