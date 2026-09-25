import type { PersonaBehaviorMode, StatefulControllerConfigV2 } from '@/types/personaBehavior';

export interface TrainingCase {
  id: string;
  title: string;
  userDescription: string; // Description for end user
  aiDescription: string; // Full context for AI
  status: 'Draft' | 'Active' | 'Paused' | 'Completed';
  enrolledUsers: number;
  completedUsers: number;
  averageScore: number;
  createdAt: string;
  lastModified: string;
  persona: Persona;
  scenarios: Scenario[];
  evaluationCategories: EvaluationCategory[];
  evaluationPromptId?: string | null;
  evaluationPromptModelName?: string;
  scenario_behavior_rules_coarse?: string;
  scenario_behavior_rules_full?: string;
  simulation_navigation?: string | null;
  finalEvaluationPromptId?: string | null;
  finalEvaluationPromptModelName?: string;
  finalSummaryRule?: string; // Rule for creating final analysis PDF
  llm1ModelName?: string;
  llm2ModelName?: string;
  roleInSimulation?: string | null;
  personaDescription?: string | null;
  caseOverview?: string | null;
  briefItems?: BriefItem[];
  phases?: Phase[];
}

export interface BriefItem {
  label: string;
  value: string;
}

export interface Phase {
  id: string;
  name: string;
  reactionIds?: string[];
}

export interface Persona {
  id: string;
  name: string;
  role?: string; // Role in the organization (e.g., Leadership, Manager, Employee)
  voice?: string; // OpenAI TTS voice: alloy, echo, fable, onyx, nova, shimmer
  description: string; // Who they are, goals, behavior
  goalDescription?: string;
  emotions: PersonaEmotion[];
  actions: PersonaAction[];
  reactions?: PersonaReaction[];
  voice_enabled?: boolean;
  router_temperature?: number | null;
  talker_temperature?: number | null;
  behavior_mode?: PersonaBehaviorMode;
  behavior_config?: StatefulControllerConfigV2 | null;
  style_and_language?: string | null;
  behavior_constraints?: string | null;
  internal_reasoning?: string | null;
}

export interface PersonaEmotion {
  id: string;
  name: string;
  description: string;
  imageUrl?: string; // Only for regular personas, not test personas
}

export interface PersonaAction {
  id: string;
  name: string;
  description: string; // Full guidance text injected into LLM as prompt-injection
  shortDescription?: string; // Short UI subtitle shown under the action card name
  chatMessage?: string; // Text posted to chat as the user message after confirming the action
  popupText?: string; // Confirmation popup body (falls back to generic prompt when empty)
  label?: string; // Optional display label distinct from the action key
}

export interface PersonaReaction {
  id: string;
  name: string;
  description: string;
  prompt: string;
  selectionLogic?: string;
  goals?: string;
}

export interface Scenario {
  id: string;
  condition: string; // When this reaction is chosen
  reaction: string; // How the persona behaves in this reaction
}

export interface EvaluationCategory {
  id: string;
  name: string;
  description: string; // How to evaluate this aspect of the dialogue
}

export interface TestPersona {
  id: string;
  name: string;
  role: string;
  personality: string;
  language: string;
  background: string;
  objectives: string[];
  avatar?: string;
  emotion: 'happy' | 'neutral' | 'concerned' | 'surprised' | 'thinking';
  category: 'HR' | 'Customer Service' | 'Leadership' | 'Technical' | 'Sales' | 'General';
}

// REMOVED: Mock data is no longer used in production
// All test personas and training cases now come from real API endpoints
// Keep only the interfaces for TypeScript support
