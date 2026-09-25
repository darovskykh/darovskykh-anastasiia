// AI Model constants for evaluation
// Last updated: 2026-04 — refreshed with current generation models (Claude 4.x, GPT-5.x, Gemini 3.x, Grok 4.x).
// Older models are kept under "Legacy / Deprecated" group at the bottom for backward compatibility
// with existing cases that reference them.

export const AI_MODELS = {
  // Default model for personas' dialogue on a new case. Stored in OpenRouter
  // id form; the backend registry accepts it directly.
  DEFAULT: 'openai/gpt-4.1',

  // ─── Anthropic — current ──────────────────────────────────────────────
  CLAUDE_OPUS_4_7: 'claude-opus-4-7',
  CLAUDE_OPUS_4_6: 'claude-opus-4-6',
  CLAUDE_SONNET_4_6: 'claude-sonnet-4-6',
  CLAUDE_SONNET_4_5: 'claude-sonnet-4-5-20250929',
  CLAUDE_HAIKU_4_5: 'claude-haiku-4-5-20251001',

  // ─── Anthropic — legacy ───────────────────────────────────────────────
  CLAUDE_SONNET_3_7: 'claude-3-7-sonnet-latest',
  CLAUDE_SONNET_3_5: 'claude-3-5-sonnet-latest',
  CLAUDE_HAIKU_3_5: 'claude-3-5-haiku-latest',
  CLAUDE_OPUS_3: 'claude-3-opus-20240229',

  // ─── OpenAI — current ─────────────────────────────────────────────────
  GPT_5_5: 'gpt-5.5-2026-04-23',
  GPT_5_5_PRO: 'gpt-5.5-pro-2026-04-23',
  GPT_5_4_MINI: 'gpt-5.4-mini',
  GPT_5_4_NANO: 'gpt-5.4-nano',
  GPT_5_2: 'gpt-5.2',

  // OpenRouter id form — what personas' dialogue is set to run on.
  GPT_OPENAI_4_1_OR: 'openai/gpt-4.1',

  // ─── OpenAI — legacy ──────────────────────────────────────────────────
  GPT_OPENAI_4_1: 'gpt-4.1',
  GPT_OPENAI_4_O: 'gpt-4o',
  GPT_OPENAI_4_O_MINI: 'gpt-4o-mini',
  GPT_OPENAI_4_TURBO: 'gpt-4-turbo',
  GPT_OPENAI_3_5: 'gpt-3.5-turbo',
  GPT_OPENAI_O1: 'o1-preview',
  GPT_OPENAI_O1_MINI: 'o1-mini',

  // ─── OpenAI Azure — legacy ────────────────────────────────────────────
  GPT_AZURE_4_1: 'azure-gpt-4.1',
  GPT_AZURE_4_O: 'azure-gpt-4o',
  GPT_AZURE_4_O_MINI: 'azure-gpt-4o-mini',
  GPT_AZURE_4_TURBO: 'azure-gpt-4-turbo',
  GPT_AZURE_3_5: 'azure-gpt-3.5-turbo',
  GPT_AZURE_O1: 'azure-o1-preview',
  GPT_AZURE_O1_MINI: 'azure-o1-mini',

  // ─── Google Gemini — current ──────────────────────────────────────────
  GEMINI_3_1_PRO: 'gemini-3-1-pro',
  GEMINI_3_FLASH: 'gemini-3-flash',
  GEMINI_3_1_FLASH_LITE: 'gemini-3-1-flash-lite',

  // ─── Google Gemini — legacy ───────────────────────────────────────────
  GEMINI_PRO_2_5: 'gemini-2.5-pro-preview-03-25',
  GEMINI_FLASH_2_5: 'gemini-2.5-flash-preview-04-17',
  GEMINI_FLASH_2_0: 'gemini-2.0-flash',
  GEMINI_PRO_1_5: 'gemini-1.5-pro',
  GEMINI_FLASH_1_5: 'gemini-1.5-flash',

  // ─── xAI Grok — current ───────────────────────────────────────────────
  GROK_4_20: 'grok-4.20',
  GROK_4_3_BETA: 'grok-4.3-beta',
  GROK_4_1_FAST: 'grok-4.1-fast',
  GROK_4: 'grok-4-0709',
  GROK_CODE_FAST_1: 'grok-code-fast-1',

  // ─── xAI Grok — legacy ────────────────────────────────────────────────
  GROK_3_LATEST: 'grok-3-latest',
  GROK_3_FAST: 'grok-3-fast-latest',
  GROK_3_MINI: 'grok-3-mini-latest',

  // ─── DeepSeek ─────────────────────────────────────────────────────────
  DEEPSEEK_V3: 'deepseek-chat',
  DEEPSEEK_R1: 'deepseek-reasoner',

  // ─── Mistral ──────────────────────────────────────────────────────────
  MISTRAL_MEDIUM_2508: 'mistral-medium-2508',
  MAGISTRAL_MEDIUM_2509: 'magistral-medium-2509',
  MISTRAL_LARGE_2411: 'mistral-large-2411',
} as const;

// AI Voice constants
export const AI_VOICES = {
  OPENAI_ALLOY: 'openai_alloy',
  OPENAI_ASH: 'openai_ash',
  OPENAI_CORAL: 'openai_coral',
  OPENAI_ECHO: 'openai_echo',
  OPENAI_FABLE: 'openai_fable',
  OPENAI_ONYX: 'openai_onyx',
  OPENAI_NOVA: 'openai_nova',
  OPENAI_SAGE: 'openai_sage',
  OPENAI_SHIMMER: 'openai_shimmer',
} as const;

// Model type definition
export interface ModelOption {
  value: string;
  label: string;
  description: string;
}

export interface ModelCategory {
  label: string;
  models: ModelOption[];
}

// Model groups for UI display.
// Order matters: "Popular (Recommended)" is shown first so the most common
// choices are immediately visible. "Legacy / Deprecated" sits at the bottom
// — kept for backward-compat with existing cases but marked clearly.
// Values are OpenRouter ids — the exact strings the backend model registry
// (SUPPORTED_MODELS) resolves to and sends to OpenRouter. Cases store this same
// form so the editor dropdown always matches the persisted value.
export const MODEL_GROUPS: ModelCategory[] = [
  {
    label: 'Recommended',
    models: [
      {
        value: 'openai/gpt-4.1',
        label: 'GPT-4.1 ⭐',
        description: 'Default. Solid, fast general-purpose model — what the personas run on.',
      },
      {
        value: 'anthropic/claude-sonnet-4-6',
        label: 'Claude Sonnet 4.6',
        description: 'Strong in-character dialogue. Good balance of quality, latency and cost.',
      },
      {
        value: 'anthropic/claude-haiku-4.5',
        label: 'Claude Haiku 4.5',
        description: 'Fast and cheap with 4.x-generation quality. Good when you want quicker replies.',
      },
    ],
  },
  {
    label: 'Faster / cheaper',
    models: [
      {
        value: 'openai/gpt-4o-mini',
        label: 'GPT-4o mini',
        description: 'Very fast and inexpensive. Best for high-volume testing or the snappiest replies.',
      },
      {
        value: 'openai/gpt-5.4-mini',
        label: 'GPT-5.4 mini',
        description: 'Fast newer-generation OpenAI model.',
      },
      {
        value: 'google/gemini-2.5-flash',
        label: 'Gemini 2.5 Flash',
        description: 'Google’s fast model. Strong on long dialogue history.',
      },
    ],
  },
  {
    label: 'Strongest',
    models: [
      {
        value: 'anthropic/claude-opus-4-7',
        label: 'Claude Opus 4.7',
        description: 'Anthropic flagship. Deepest reasoning and most nuanced persona — slower and pricier.',
      },
      {
        value: 'openai/gpt-5.5',
        label: 'GPT-5.5',
        description: 'OpenAI flagship. State-of-the-art reasoning.',
      },
      {
        value: 'openai/gpt-5.5-pro',
        label: 'GPT-5.5 Pro',
        description: 'Higher-accuracy GPT-5.5. Slower and pricier.',
      },
      {
        value: 'google/gemini-2.5-pro',
        label: 'Gemini 2.5 Pro',
        description: 'Google’s long-context reasoning model.',
      },
      {
        value: 'x-ai/grok-4.20',
        label: 'Grok 4.20',
        description: 'xAI flagship. Large context, fast for its tier.',
      },
    ],
  },
];


// Voice options for UI display
export const VOICE_OPTIONS = [
  { value: AI_VOICES.OPENAI_ALLOY, label: 'Alloy' },
  { value: AI_VOICES.OPENAI_ASH, label: 'Ash' },
  { value: AI_VOICES.OPENAI_CORAL, label: 'Coral' },
  { value: AI_VOICES.OPENAI_ECHO, label: 'Echo' },
  { value: AI_VOICES.OPENAI_FABLE, label: 'Fable' },
  { value: AI_VOICES.OPENAI_ONYX, label: 'Onyx' },
  { value: AI_VOICES.OPENAI_NOVA, label: 'Nova' },
  { value: AI_VOICES.OPENAI_SAGE, label: 'Sage' },
  { value: AI_VOICES.OPENAI_SHIMMER, label: 'Shimmer' },
];

// Get all models as flat array
export const ALL_MODELS = MODEL_GROUPS.flatMap(group => group.models);

// Helper function to get model label by value
export function getModelLabel(value: string): string {
  const model = ALL_MODELS.find(m => m.value === value);
  return model?.label || value;
}

// Helper function to get model description by value
export function getModelDescription(value: string): string | undefined {
  const model = ALL_MODELS.find(m => m.value === value);
  return model?.description;
}

// Helper function to get voice label by value
export function getVoiceLabel(value: string): string {
  const voice = VOICE_OPTIONS.find(v => v.value === value);
  return voice?.label || value;
}
