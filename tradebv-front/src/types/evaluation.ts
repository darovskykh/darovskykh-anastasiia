// Evaluation Prompt types matching backend schema

export interface EvaluationPrompt {
  id: string;
  name: string;
  main_prompt: string;
  categories_prompts: Record<string, string>; // {"вежливость": "ты должен оценить..."}
  is_draft: boolean;
}

export interface EvaluationPromptCreate {
  name: string;
  main_prompt: string;
  categories_prompts: Record<string, string>;
  is_draft?: boolean;
}

export interface EvaluationPromptUpdate {
  name?: string;
  main_prompt?: string;
  categories_prompts?: Record<string, string>;
  is_draft?: boolean;
}

export interface EvaluationPromptAllData {
  prompt: EvaluationPrompt;
  cases: any[]; // Can import Case type if needed to avoid circular dependency
}

// Final Evaluation Prompt types

export interface FinalEvaluationPrompt {
  id: string;
  name: string;
  prompt: string;
  is_draft: boolean;
}

export interface FinalEvaluationPromptCreate {
  name: string;
  prompt: string;
  is_draft?: boolean;
}

export interface FinalEvaluationPromptUpdate {
  name?: string;
  prompt?: string;
  is_draft?: boolean;
}

// API Response wrapper
export interface ApiEnvelope<T> {
  event: string;
  data: T;
}
