import { describe, expect, it } from 'vitest';
import { getSimulationVoiceEnabled } from './simulationPersona';

describe('getSimulationVoiceEnabled', () => {
  it('uses the immutable chat snapshot for an existing conversation', () => {
    expect(
      getSimulationVoiceEnabled(
        { voice_enabled: true },
        { voice_enabled: false },
      ),
    ).toBe(true);
  });

  it('keeps media disabled for a text-only chat snapshot', () => {
    expect(
      getSimulationVoiceEnabled(
        { voice_enabled: false },
        { voice_enabled: true },
      ),
    ).toBe(false);
  });

  it('keeps the legacy fallback for chats without a snapshot', () => {
    expect(getSimulationVoiceEnabled(null, { voice_enabled: false })).toBe(false);
    expect(getSimulationVoiceEnabled(null, { voice_enabled: true })).toBe(true);
  });
});
