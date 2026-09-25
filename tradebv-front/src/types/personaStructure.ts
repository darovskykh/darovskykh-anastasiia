/**
 * Draft shape for the persona structure (states → phases, conditional facts)
 * and the shared base prompt. Field names are provisional until the backend
 * data schema is agreed.
 */

export type Audience = 'ai' | 'user' | 'both';

export interface PersonaPhase {
  id: string;
  name: string;
  /** How the persona behaves while this phase is active. Sent to the AI. */
  instruction: string;
  /** Phase ids reachable from this phase. May include the phase's own id. */
  transitions: string[];
  /** How to choose among `transitions`. Sent to the dialogue-steering AI. */
  transitionRule: string;
  /** Only used when the parent state drives the persona's emotion image. */
  emotionImageUrl?: string | null;
}

export interface PersonaState {
  id: string;
  name: string;
  description: string;
  /** At most one state per persona drives the emotion image. */
  drivesEmotion: boolean;
  startPhaseId: string;
  phases: PersonaPhase[];
}

export interface ConditionalFact {
  id: string;
  name: string;
  /** When the fact becomes relevant during the dialogue. */
  condition: string;
  /** The information or instruction itself. */
  fact: string;
}

export interface PersonaStructure {
  states: PersonaState[];
  facts: ConditionalFact[];
}

export interface BasePromptConfig {
  /** Base prompt for the AI that talks to the user. */
  talkerPrompt: string;
  /** Base prompt for the AI that steers the dialogue (phases, facts). */
  controllerPrompt: string;
  universalFacts: ConditionalFact[];
}

export const newId = (prefix: string) =>
  `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
