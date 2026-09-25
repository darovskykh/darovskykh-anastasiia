export interface SimulationVoiceSettings {
  voice_enabled?: boolean;
}

/**
 * A chat snapshot is the runtime source for a conversation that already
 * exists. Older chats without a snapshot keep the current persona fallback
 * and therefore retain the legacy voice behavior.
 */
export function getSimulationVoiceEnabled(
  chatPersonaSnapshot: SimulationVoiceSettings | null | undefined,
  currentPersona: SimulationVoiceSettings | null | undefined,
): boolean {
  return (chatPersonaSnapshot ?? currentPersona)?.voice_enabled !== false;
}
