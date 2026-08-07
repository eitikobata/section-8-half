/**
 * Roster of original fictional agents for incident response suggestions.
 * CRITICAL: No names from Ghost in the Shell franchise.
 * Each agent has a specialty that shapes the protocol recommendation.
 */

export interface Agent {
  id: string;
  name: string;
  specialty: string;
  description: string;
}

export const AGENT_ROSTER: Agent[] = [
  {
    id: 'agent-alpha',
    name: 'Echo',
    specialty: 'Network Intrusion Detection',
    description: 'Specializes in lateral movement analysis and network segmentation breach response',
  },
  {
    id: 'agent-bravo',
    name: 'Sentinel',
    specialty: 'Endpoint Forensics',
    description: 'Expert in memory dumps, process analysis, and privilege escalation investigation',
  },
  {
    id: 'agent-charlie',
    name: 'Relay',
    specialty: 'Threat Hunting & Pattern Analysis',
    description: 'Builds behavioral baselines and identifies sophisticated attack chains',
  },
  {
    id: 'agent-delta',
    name: 'Nexus',
    specialty: 'Incident Containment',
    description: 'Coordinates rapid response, isolation protocols, and threat eradication',
  },
  {
    id: 'agent-echo',
    name: 'Prism',
    specialty: 'Threat Intelligence Integration',
    description: 'Cross-correlates with external intel feeds and manages attribution workflows',
  },
];

export function getAgentById(id: string): Agent | undefined {
  return AGENT_ROSTER.find((agent) => agent.id === id);
}

export function getRandomAgent(): Agent {
  return AGENT_ROSTER[Math.floor(Math.random() * AGENT_ROSTER.length)];
}
