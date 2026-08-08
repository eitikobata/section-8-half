// Mirrors backend/src/ai/roster.agent.ts — kept in sync manually since
// the frontend needs the list client-side for dropdown options.
// CRITICAL: No names from Ghost in the Shell franchise.

export interface RosterAgent {
  id: string;
  name: string;
  specialty: string;
}

export const AGENT_ROSTER: RosterAgent[] = [
  { id: 'agent-alpha', name: 'Echo', specialty: 'Network Intrusion Detection' },
  { id: 'agent-bravo', name: 'Sentinel', specialty: 'Endpoint Forensics' },
  { id: 'agent-charlie', name: 'Relay', specialty: 'Threat Hunting & Pattern Analysis' },
  { id: 'agent-delta', name: 'Nexus', specialty: 'Incident Containment' },
  { id: 'agent-echo', name: 'Prism', specialty: 'Threat Intelligence Integration' },
];

// Fixed protocol options for the dispatch dropdown. Free-text on the
// backend (protocolOverride is just a string), but the frontend
// constrains input to this set so the analyst never has to type.
export const PROTOCOL_OPTIONS = [
  'SURVEILLANCE',
  'COUNTER_INTRUSION',
  'DIGITAL_WARFARE',
  'PHYSICAL_INTERVENTION',
  'STEALTH_OPS',
  'CONTAINMENT',
];

// Rules of engagement — same idea, fixed set for the dropdown.
export const RULES_OF_ENGAGEMENT_OPTIONS = [
  'NON_LETHAL_FORCE',
  'LETHAL_FORCE',
];
