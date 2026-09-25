// Case and Persona types matching backend schema

import type { PersonaBehaviorMode, StatefulControllerConfigV2 } from '@/types/personaBehavior';

export interface Scenario {
  condition: string;
  reaction: string;
}

export interface Emotion {
  name: string;
  description: string;
  image_url?: string;
}

export interface Reaction {
  name: string;
  description: string;
  prompt: string;
  selection_logic?: string;
  goals?: string;
}

export interface EvaluationCategory {
  name: string;
  description: string;
}

export interface BriefItem {
  label: string;
  value: string;
}

export interface Phase {
  id: string;
  name: string;
  reaction_ids?: string[];
}

export interface Case {
  id: string;
  title: string;
  prompt: string;
  intro_text: string;
  simulation_navigation?: string | null;
  evaluation_prompt_id: string | null;
  evaluation_prompt_model_name: string;
  final_evaluation_prompt_id?: string | null;
  final_evaluation_prompt_model_name: string;
  is_draft: boolean;
  original_case_id: string | null;
  evaluation_categories: EvaluationCategory[];
  final_summary_rule: string | null;
  created_at: string;
  scenario_behavior_rules_coarse: string | null;
  scenario_behavior_rules_full: string | null;
  llm_1_model_name: string;
  llm_2_model_name: string;
  role_in_simulation?: string | null;
  persona_description?: string | null;
  case_overview?: string | null;
  brief_items?: BriefItem[];
  phases?: Phase[];
}

export interface CaseCreate {
  title: string;
  prompt: string;
  intro_text: string;
  simulation_navigation?: string | null;
  evaluation_prompt_id?: string | null;
  evaluation_prompt_model_name?: string;
  final_evaluation_prompt_id?: string | null;
  final_evaluation_prompt_model_name?: string;
  is_draft?: boolean;
  original_case_id?: string | null;
  evaluation_categories?: EvaluationCategory[];
  final_summary_rule?: string | null;
  scenario_behavior_rules_coarse?: string | null;
  scenario_behavior_rules_full?: string | null;
  llm_1_model_name?: string;
  llm_2_model_name?: string;
  simulation_navigation?: string | null;
  role_in_simulation?: string | null;
  persona_description?: string | null;
  case_overview?: string | null;
  brief_items?: BriefItem[];
  phases?: Phase[];
}

export interface CaseUpdate {
  title?: string;
  prompt?: string;
  intro_text?: string;
  evaluation_prompt_id?: string | null;
  evaluation_prompt_model_name?: string;
  final_evaluation_prompt_id?: string | null;
  final_evaluation_prompt_model_name?: string;
  // Note: is_draft and original_case_id are managed by the draft workflow
  // and should not be included in regular case updates
  evaluation_categories?: EvaluationCategory[];
  final_summary_rule?: string | null;
  scenario_behavior_rules_coarse?: string | null;
  scenario_behavior_rules_full?: string | null;
  llm_1_model_name?: string;
  llm_2_model_name?: string;
  role_in_simulation?: string | null;
  persona_description?: string | null;
  case_overview?: string | null;
  brief_items?: BriefItem[];
  phases?: Phase[];
}

export interface Persona {
  id: string;
  case_id: string;
  name: string;
  role: string;
  voice: string;
  avatar_base_url: string | null;
  is_draft: boolean;
  persona_description: string;
  goal_description: string;
  emotions: Emotion[];
  actions: Record<string, string>;
  action_descriptions?: Record<string, string>;
  action_labels?: Record<string, string>;
  action_chat_messages?: Record<string, string>;
  action_popup_texts?: Record<string, string>;
  scenarios: Scenario[];
  reactions: Reaction[];
  created_at: string;
  style_and_language: string | null;
  behavior_constraints: string | null;
  internal_reasoning: string | null;
  voice_enabled: boolean;
  router_temperature?: number | null;
  talker_temperature?: number | null;
  behavior_mode?: PersonaBehaviorMode;
  behavior_config?: StatefulControllerConfigV2 | null;
}

export interface PersonaCreate {
  case_id: string;
  name: string;
  role?: string;
  voice?: string;
  avatar_base_url?: string | null;
  is_draft?: boolean;
  persona_description: string;
  goal_description: string;
  emotions?: Emotion[];
  actions?: Record<string, string>;
  action_descriptions?: Record<string, string>;
  action_labels?: Record<string, string>;
  action_chat_messages?: Record<string, string>;
  action_popup_texts?: Record<string, string>;
  scenarios?: Scenario[];
  reactions?: Reaction[];
  style_and_language?: string | null;
  behavior_constraints?: string | null;
  internal_reasoning?: string | null;
  voice_enabled?: boolean;
  router_temperature?: number | null;
  talker_temperature?: number | null;
  behavior_mode?: PersonaBehaviorMode;
  behavior_config?: StatefulControllerConfigV2 | null;
}

export interface PersonaUpdate {
  case_id?: string;
  name?: string;
  role?: string;
  voice?: string;
  avatar_base_url?: string | null;
  is_draft?: boolean;
  persona_description?: string;
  goal_description?: string;
  emotions?: Emotion[];
  actions?: Record<string, string>;
  action_descriptions?: Record<string, string>;
  action_labels?: Record<string, string>;
  action_chat_messages?: Record<string, string>;
  action_popup_texts?: Record<string, string>;
  scenarios?: Scenario[];
  reactions?: Reaction[];
  style_and_language?: string | null;
  behavior_constraints?: string | null;
  internal_reasoning?: string | null;
  voice_enabled?: boolean;
  router_temperature?: number | null;
  talker_temperature?: number | null;
  behavior_mode?: PersonaBehaviorMode;
  behavior_config?: StatefulControllerConfigV2 | null;
}

export interface CaseAllData {
  case: Case;
  persona: Persona;
  evaluation_prompt?: any;
  final_evaluation_prompt?: any;
}

export interface PersonaAllData {
  persona: Persona;
  case: Case | null;
}

// API Response wrapper
export interface ApiEnvelope<T> {
  event: string;
  data: T;
}
