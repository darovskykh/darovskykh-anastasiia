import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const simulationSource = readFileSync(
  fileURLToPath(new URL('./Simulation.tsx', import.meta.url)),
  'utf8',
);

describe('Simulation turn delivery', () => {
  it('does not turn a missing receipt into a false reply error', () => {
    expect(simulationSource).not.toContain('TURN_ACK_TIMEOUT_MS');
    expect(simulationSource).not.toContain('turnAckRef');
    expect(simulationSource).not.toContain('id: `unsent-${Date.now()}`');
    expect(simulationSource).toContain('AI_REPLY_TIMEOUT_MS = 75_000');
  });
});
