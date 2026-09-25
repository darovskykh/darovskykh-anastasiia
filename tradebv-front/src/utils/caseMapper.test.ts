import { describe, expect, it } from 'vitest';
import { createDefaultPersonaBehaviorConfig } from '@/types/personaBehavior';
import { mockPersonaToPersonaCreate, mockPersonaToPersonaUpdate } from './caseMapper';
import type { Persona } from '@/data/mockCases';

const personaFixture = (overrides: Partial<Persona> = {}): Persona => ({
  id: 'persona-1',
  name: 'Adrian',
  description: 'A commercial counterpart',
  emotions: [],
  actions: [{ id: 'action-1', name: 'ask', description: 'Ask a question', label: 'Ask' }],
  style_and_language: 'Keep the tone direct.',
  behavior_constraints: 'Never invent a commitment.',
  internal_reasoning: 'Check the offer ledger.',
  voice_enabled: false,
  behavior_mode: 'stateful_controller',
  behavior_config: createDefaultPersonaBehaviorConfig('discovery'),
  ...overrides,
});

describe('case mapper persona preservation', () => {
  it('keeps voice, labels, V2 config, and authored legacy text on create', () => {
    const persona = personaFixture();
    const result = mockPersonaToPersonaCreate(persona, 'case-1');

    expect(result.voice_enabled).toBe(false);
    expect(result.action_labels).toEqual({ ask: 'Ask' });
    expect(result.style_and_language).toBe(persona.style_and_language);
    expect(result.behavior_constraints).toBe(persona.behavior_constraints);
    expect(result.internal_reasoning).toBe(persona.internal_reasoning);
    expect(result.behavior_config).toEqual(persona.behavior_config);
  });

  it('keeps an explicit false voice flag and complete V2 config on update', () => {
    const persona = personaFixture();
    const result = mockPersonaToPersonaUpdate(persona);

    expect(result.voice_enabled).toBe(false);
    expect(result.behavior_mode).toBe('stateful_controller');
    expect(result.behavior_config).toEqual(persona.behavior_config);
    expect(result.action_labels).toEqual({ ask: 'Ask' });
  });

  it('rejects a stateful persona without its V2 configuration', () => {
    const persona = personaFixture({ behavior_config: null });

    expect(() => mockPersonaToPersonaCreate(persona, 'case-1')).toThrow('requires a V2 behavior profile');
    expect(() => mockPersonaToPersonaUpdate(persona)).toThrow('requires a V2 behavior profile');
  });
});
