import { describe, expect, it, vi } from 'vitest';
import { createDefaultPersonaBehaviorConfig } from '@/types/personaBehavior';
import type { Persona as MockPersona } from '@/data/mockCases';
import type { CaseAllData } from '@/types/case';
import { savePersonaOnly } from './personaSave';

const persona: MockPersona = {
  id: 'persona-1',
  name: 'Adrian',
  description: 'Commercial counterpart',
  emotions: [],
  actions: [],
  voice_enabled: false,
  behavior_mode: 'stateful_controller',
  behavior_config: createDefaultPersonaBehaviorConfig('discovery'),
  style_and_language: 'Keep the tone direct.',
  behavior_constraints: 'Never invent a commitment.',
  internal_reasoning: 'Check the offer ledger.',
};

const savedCase = {
  case: {
    id: 'case-1',
    title: 'Saved case',
    prompt: '',
    intro_text: '',
    evaluation_prompt_id: null,
    evaluation_prompt_model_name: 'gpt-4o-mini',
    final_evaluation_prompt_id: null,
    final_evaluation_prompt_model_name: 'gpt-4o-mini',
    is_draft: false,
    original_case_id: null,
    evaluation_categories: [],
    final_summary_rule: null,
    created_at: '2026-01-01T00:00:00Z',
    scenario_behavior_rules_coarse: null,
    scenario_behavior_rules_full: null,
    llm_1_model_name: 'gpt-4o-mini',
    llm_2_model_name: 'gpt-4o-mini',
  },
  persona: {
    id: 'persona-1',
    case_id: 'case-1',
    name: 'Adrian',
    role: '',
    voice: 'openai_alloy',
    avatar_base_url: null,
    is_draft: false,
    persona_description: 'Commercial counterpart',
    goal_description: '',
    emotions: [],
    actions: {},
    reactions: [],
    scenarios: [],
    created_at: '2026-01-01T00:00:00Z',
    style_and_language: 'Keep the tone direct.',
    behavior_constraints: 'Never invent a commitment.',
    internal_reasoning: 'Check the offer ledger.',
    voice_enabled: false,
    behavior_mode: 'stateful_controller',
    behavior_config: createDefaultPersonaBehaviorConfig('default'),
  },
} as CaseAllData;

describe('savePersonaOnly', () => {
  it('updates and reads back only the persona while leaving case updates untouched', async () => {
    const updatePersona = vi.fn().mockResolvedValue(undefined);
    const getCaseAllData = vi.fn().mockResolvedValue(savedCase);

    const saved = await savePersonaOnly({ updatePersona, getCaseAllData }, 'case-1', persona);

    expect(updatePersona).toHaveBeenCalledWith(
      'persona-1',
      expect.objectContaining({
        case_id: 'case-1',
        voice_enabled: false,
        behavior_mode: 'stateful_controller',
      }),
    );
    expect(updatePersona).toHaveBeenCalledTimes(1);
    expect(getCaseAllData).toHaveBeenCalledWith('case-1');
    expect(saved.name).toBe('Adrian');
    expect(saved.voice_enabled).toBe(false);
  });
});

