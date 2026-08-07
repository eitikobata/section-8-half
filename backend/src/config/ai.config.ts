// Centralized AI config (Bloco 4), same pattern as auth.config.ts
// Supports Claude, Gemini, or other LLM providers via ENV.

export type AiProvider = 'claude' | 'gemini' | 'mock';

export const aiConfig = {
  // Provider: claude | gemini | mock (for tests/dev without API calls)
  provider: (process.env.AI_PROVIDER || 'claude') as AiProvider,

  // Claude (Claude 3.5 Sonnet recommended, or latest available)
  claudeApiKey: process.env.CLAUDE_API_KEY || '',
  claudeModel: process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022',

  // Gemini (Google AI Studio or Vertex)
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.0-flash',

  // Timeout for AI calls (ms)
  timeoutMs: parseInt(process.env.AI_TIMEOUT_MS || '30000', 10),

  // Whether to log prompts/responses (dev only)
  debug: process.env.AI_DEBUG === 'true',
};
