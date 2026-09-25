import type { Case, Persona, CaseAllData, CaseCreate, CaseUpdate, PersonaCreate, PersonaUpdate } from '@/types/case';
import type { TrainingCase, Persona as MockPersona, PersonaEmotion, PersonaAction, PersonaReaction, Scenario, EvaluationCategory } from '@/data/mockCases';
import { DEFAULT_STYLE_AND_LANGUAGE, DEFAULT_BEHAVIOR_CONSTRAINTS, DEFAULT_INTERNAL_REASONING } from '@/constants/persona';
import { AI_MODELS } from '@/constants/aiModels';
import {
  clonePersonaBehaviorConfig,
  type PersonaBehaviorMode,
} from '@/types/personaBehavior';

/**
 * Convert API Case + Persona data to TrainingCase format used in UI
 */
export function apiToTrainingCase(caseAllData: CaseAllData): TrainingCase {
  const apiCase = caseAllData.case;
  const apiPersona = caseAllData.persona || null; // Handle cases with no persona

  // Parse scenarios from prompt if available
  const scenarios: Scenario[] = [];

  // Get evaluation categories from case
  const evaluationCategories: EvaluationCategory[] = (apiCase.evaluation_categories || []).map((cat, index) => ({
    id: `eval-cat-${index}`,
    name: cat.name,
    description: cat.description
  }));

  const trainingCase: TrainingCase = {
    id: apiCase.id,
    title: apiCase.title,
    userDescription: apiCase.intro_text,
    aiDescription: apiCase.prompt,
    status: apiCase.is_draft ? 'Draft' : 'Active',
    enrolledUsers: 0, // Not available from API
    completedUsers: 0, // Not available from API
    averageScore: 0, // Not available from API
    createdAt: apiCase.created_at,
    lastModified: apiCase.created_at,
    // ДОБАВЬТЕ ЭТИ ДВЕ СТРОКИ:
    scenario_behavior_rules_coarse: apiCase.scenario_behavior_rules_coarse || '',
    scenario_behavior_rules_full: apiCase.scenario_behavior_rules_full || '',
    persona: apiPersona ? apiPersonaToMockPersona(apiPersona) : {
      id: '',
      name: '',
      description: '',
      emotions: [],
      actions: [],
      voice_enabled: true,
      behavior_mode: 'legacy_router_talker',
      behavior_config: null,
    },
    scenarios,
    evaluationCategories,
    evaluationPromptId: apiCase.evaluation_prompt_id ? String(apiCase.evaluation_prompt_id) : null,
    evaluationPromptModelName: apiCase.evaluation_prompt_model_name,
    finalEvaluationPromptId: apiCase.final_evaluation_prompt_id ? String(apiCase.final_evaluation_prompt_id) : null,
    finalEvaluationPromptModelName: apiCase.final_evaluation_prompt_model_name,
    finalSummaryRule: apiCase.final_summary_rule || '',
    simulation_navigation: apiCase.simulation_navigation || '',
    llm1ModelName: apiCase.llm_1_model_name,
    llm2ModelName: apiCase.llm_2_model_name,
    roleInSimulation: apiCase.role_in_simulation || null,
    personaDescription: apiCase.persona_description || null,
    caseOverview: apiCase.case_overview || null,
    briefItems: (apiCase.brief_items || []).map(b => ({ label: b.label, value: b.value })),
    phases: (apiCase.phases || []).map(p => ({
      id: p.id,
      name: p.name,
      reactionIds: p.reaction_ids ?? []
    }))
  };

  return trainingCase;
}

/**
 * Convert API Persona to Mock Persona format
 */
function apiPersonaToMockPersona(apiPersona: Persona): MockPersona {

  // Handle emotions - API returns dictionary format, UI expects array format
  let emotionsArray = [];
  if (Array.isArray(apiPersona.emotions)) {
    // Legacy: if it's already an array
    emotionsArray = apiPersona.emotions;
  } else if (apiPersona.emotions && typeof apiPersona.emotions === 'object') {
    // New format: convert dictionary to array
    emotionsArray = Object.entries(apiPersona.emotions).map(([key, emotion]: [string, any]) => ({
      id: `emotion-${key}`,
      name: emotion.name || key,
      description: emotion.description || '',
      imageUrl: emotion.image_url || undefined
    }));
  }
  // If emotions is null, undefined, or empty object, keep emotionsArray as []
  
  // emotions is already in the correct format from the dictionary conversion above
  const emotions: PersonaEmotion[] = emotionsArray;

  // Handle actions - ensure it's an object and has entries
  const actionsObject = apiPersona.actions && typeof apiPersona.actions === 'object'
    ? apiPersona.actions
    : {};
  const actionDescriptionsObject = apiPersona.action_descriptions && typeof apiPersona.action_descriptions === 'object'
    ? apiPersona.action_descriptions
    : {};
  const actionChatMessagesObject = apiPersona.action_chat_messages && typeof apiPersona.action_chat_messages === 'object'
    ? apiPersona.action_chat_messages
    : {};
  const actionPopupTextsObject = apiPersona.action_popup_texts && typeof apiPersona.action_popup_texts === 'object'
    ? apiPersona.action_popup_texts
    : {};
  const actionLabelsObject = apiPersona.action_labels && typeof apiPersona.action_labels === 'object'
    ? apiPersona.action_labels
    : {};
  const actions: PersonaAction[] = Object.entries(actionsObject).map(([actionName, description], index) => ({
    id: `action-${index}`,
    name: actionName,
    description: String(description), // full guidance (prompt-injection)
    label: actionLabelsObject[actionName] ?? '', // optional display label
    shortDescription: actionDescriptionsObject[actionName] ?? '', // short UI subtitle
    chatMessage: actionChatMessagesObject[actionName] ?? '', // text posted to chat on confirm
    popupText: actionPopupTextsObject[actionName] ?? '' // confirmation popup body
  }));

  // Handle reactions - ensure it's an array
  const reactionsArray = Array.isArray(apiPersona.reactions) 
    ? apiPersona.reactions 
    : (apiPersona.reactions ? [apiPersona.reactions] : []);
  const reactions: PersonaReaction[] = reactionsArray.map((reaction, index) => ({
    id: `reaction-${index}`,
    name: reaction.name,
    description: reaction.description,
    prompt: reaction.prompt,
    selectionLogic: reaction.selection_logic || '',
    goals: reaction.goals || ''
  }));

  return {
    id: apiPersona.id,
    name: apiPersona.name,
    role: apiPersona.role,
    voice: apiPersona.voice,
    description: apiPersona.persona_description,
    goalDescription: apiPersona.goal_description,
    emotions,
    actions,
    reactions,
    style_and_language: apiPersona.style_and_language,
    behavior_constraints: apiPersona.behavior_constraints,
    internal_reasoning: apiPersona.internal_reasoning,
    // Historical personas have no selector/flag.  Keep those records on the
    // legacy text path and preserve voice as enabled for backwards behavior.
    voice_enabled: apiPersona.voice_enabled !== false,
    router_temperature: apiPersona.router_temperature ?? null,
    talker_temperature: apiPersona.talker_temperature ?? null,
    behavior_mode: apiPersona.behavior_mode ?? 'legacy_router_talker',
    behavior_config: clonePersonaBehaviorConfig(apiPersona.behavior_config),
  };
}

/**
 * Convert TrainingCase from UI to API CaseCreate format
 */
export function trainingCaseToCaseCreate(trainingCase: Partial<TrainingCase>): CaseCreate {
  return {
    title: trainingCase.title || '',
    prompt: trainingCase.aiDescription || '',
    intro_text: trainingCase.userDescription || '',
    evaluation_prompt_id: trainingCase.evaluationPromptId || null,
    evaluation_prompt_model_name: trainingCase.evaluationPromptModelName || AI_MODELS.DEFAULT,
    final_evaluation_prompt_id: trainingCase.finalEvaluationPromptId || null,
    final_evaluation_prompt_model_name: trainingCase.finalEvaluationPromptModelName || AI_MODELS.DEFAULT,
    is_draft: trainingCase.status === 'Draft',
    evaluation_categories: (trainingCase.evaluationCategories || []).map(cat => ({
      name: cat.name,
      description: cat.description
    })),
    final_summary_rule: trainingCase.finalSummaryRule || null,
    simulation_navigation: trainingCase.simulation_navigation || null,
    scenario_behavior_rules_coarse: trainingCase.scenario_behavior_rules_coarse || null,
    scenario_behavior_rules_full: trainingCase.scenario_behavior_rules_full || null,
    llm_1_model_name: trainingCase.llm1ModelName || AI_MODELS.DEFAULT,
    llm_2_model_name: trainingCase.llm2ModelName || AI_MODELS.DEFAULT,
    role_in_simulation: trainingCase.roleInSimulation || null,
    persona_description: trainingCase.personaDescription || null,
    case_overview: trainingCase.caseOverview || null,
    brief_items: (trainingCase.briefItems || []).map(b => ({ label: b.label, value: b.value })),
    phases: (trainingCase.phases || []).map(p => ({
      id: p.id,
      name: p.name,
      reaction_ids: p.reactionIds ?? []
    }))
  };
}

/**
 * Convert TrainingCase from UI to API CaseUpdate format
 */
export function trainingCaseToCaseUpdate(trainingCase: Partial<TrainingCase>): CaseUpdate {
  const update: CaseUpdate = {};

  if (trainingCase.title !== undefined) {
    update.title = trainingCase.title;
  }
  if (trainingCase.aiDescription !== undefined) {
    update.prompt = trainingCase.aiDescription;
  }
  if (trainingCase.userDescription !== undefined) {
    update.intro_text = trainingCase.userDescription;
  }
  // Note: is_draft should not be modified through regular case updates
  // It's only set during draft creation workflow
  if (trainingCase.evaluationPromptId !== undefined) {
    update.evaluation_prompt_id = trainingCase.evaluationPromptId;
  }
  if (trainingCase.evaluationPromptModelName !== undefined) {
    update.evaluation_prompt_model_name = trainingCase.evaluationPromptModelName;
  }
  if (trainingCase.finalEvaluationPromptId !== undefined) {
    update.final_evaluation_prompt_id = trainingCase.finalEvaluationPromptId;
  }
  if (trainingCase.finalEvaluationPromptModelName !== undefined) {
    update.final_evaluation_prompt_model_name = trainingCase.finalEvaluationPromptModelName;
  }
  if (trainingCase.evaluationCategories !== undefined) {
    update.evaluation_categories = trainingCase.evaluationCategories.map(cat => ({
      name: cat.name,
      description: cat.description
    }));
  }
  if (trainingCase.finalSummaryRule !== undefined) {
    update.final_summary_rule = trainingCase.finalSummaryRule;
  }
  if (trainingCase.simulation_navigation !== undefined) {
    update.simulation_navigation = trainingCase.simulation_navigation;
  }
  if (trainingCase.scenario_behavior_rules_coarse !== undefined) {
    update.scenario_behavior_rules_coarse = trainingCase.scenario_behavior_rules_coarse;
  }
  if (trainingCase.scenario_behavior_rules_full !== undefined) {
    update.scenario_behavior_rules_full = trainingCase.scenario_behavior_rules_full;
  }
  if (trainingCase.llm1ModelName !== undefined) {
    update.llm_1_model_name = trainingCase.llm1ModelName;
  }
  if (trainingCase.llm2ModelName !== undefined) {
    update.llm_2_model_name = trainingCase.llm2ModelName;
  }
  if (trainingCase.roleInSimulation !== undefined) {
    update.role_in_simulation = trainingCase.roleInSimulation;
  }
  if (trainingCase.personaDescription !== undefined) {
    update.persona_description = trainingCase.personaDescription;
  }
  if (trainingCase.caseOverview !== undefined) {
    update.case_overview = trainingCase.caseOverview;
  }
  if (trainingCase.briefItems !== undefined) {
    update.brief_items = trainingCase.briefItems.map(b => ({ label: b.label, value: b.value }));
  }
  if (trainingCase.phases !== undefined) {
    update.phases = trainingCase.phases.map(p => ({
      id: p.id,
      name: p.name,
      reaction_ids: p.reactionIds ?? []
    }));
  }

  return update;
}

/**
 * Convert Mock Persona to API PersonaCreate format
 */
export function mockPersonaToPersonaCreate(mockPersona: MockPersona, caseId: string): PersonaCreate {
  // Convert emotions to dictionary format expected by backend
  const emotionsDict: Record<string, any> = {};
  mockPersona.emotions.forEach((e, index) => {
    // Use imagePath if available (stored during upload), otherwise imageUrl
    // imagePath is in format "bucket:object_name", imageUrl might be a temporary URL
    const imageValue = (e as any).imagePath || e.imageUrl;

    emotionsDict[e.name || `emotion_${index}`] = {
      name: e.name,
      description: e.description || '',
      image_url: imageValue || null
    };
  });

  const actions: Record<string, string> = {};
  const action_descriptions: Record<string, string> = {};
  const action_chat_messages: Record<string, string> = {};
  const action_popup_texts: Record<string, string> = {};
  const action_labels: Record<string, string> = {};
  mockPersona.actions.forEach(action => {
    actions[action.name] = action.description;
    if (action.label) action_labels[action.name] = action.label;
    if (action.shortDescription) action_descriptions[action.name] = action.shortDescription;
    if (action.chatMessage) action_chat_messages[action.name] = action.chatMessage;
    if (action.popupText) action_popup_texts[action.name] = action.popupText;
  });

  const reactions = (mockPersona.reactions || []).map(r => ({
    name: r.name,
    description: r.description,
    prompt: r.prompt,
    selection_logic: r.selectionLogic || '',
    goals: r.goals || ''
  }));

  const behaviorMode: PersonaBehaviorMode = mockPersona.behavior_mode || 'legacy_router_talker';
  if (behaviorMode === 'stateful_controller' && !mockPersona.behavior_config) {
    throw new Error('Stateful controller mode requires a V2 behavior profile before saving.');
  }
  const behaviorConfig = clonePersonaBehaviorConfig(mockPersona.behavior_config);

  return {
    case_id: caseId,
    name: mockPersona.name,
    role: mockPersona.role || '',
    voice: mockPersona.voice || 'openai_alloy',
    avatar_base_url:
      (mockPersona.emotions[0] as any)?.imagePath ||
      mockPersona.emotions[0]?.imageUrl ||
      null,
    is_draft: false,
    persona_description: mockPersona.description,
    goal_description: mockPersona.goalDescription || '',
    emotions: emotionsDict,
    actions,
    action_labels,
    action_descriptions,
    action_chat_messages,
    action_popup_texts,
    reactions,
    style_and_language: mockPersona.style_and_language ?? DEFAULT_STYLE_AND_LANGUAGE,
    behavior_constraints: mockPersona.behavior_constraints ?? DEFAULT_BEHAVIOR_CONSTRAINTS,
    internal_reasoning: mockPersona.internal_reasoning ?? DEFAULT_INTERNAL_REASONING,
    voice_enabled: mockPersona.voice_enabled !== false,
    router_temperature: mockPersona.router_temperature ?? null,
    talker_temperature: mockPersona.talker_temperature ?? null,
    behavior_mode: behaviorMode,
    behavior_config: behaviorConfig,
  };
}

/**
 * Convert Mock Persona to API PersonaUpdate format
 */
export function mockPersonaToPersonaUpdate(mockPersona: Partial<MockPersona>): PersonaUpdate {
  const update: PersonaUpdate = {};

  const behaviorMode: PersonaBehaviorMode = mockPersona.behavior_mode || 'legacy_router_talker';
  if (behaviorMode === 'stateful_controller' && !mockPersona.behavior_config) {
    throw new Error('Stateful controller mode requires a V2 behavior profile before saving.');
  }

  if (mockPersona.name !== undefined) {
    update.name = mockPersona.name;
  }

  if (mockPersona.role !== undefined) {
    update.role = mockPersona.role;
  }

  if (mockPersona.voice !== undefined) {
    update.voice = mockPersona.voice;
  }

  if (mockPersona.description !== undefined) {
    update.persona_description = mockPersona.description;
  }

  if (mockPersona.goalDescription !== undefined) {
    update.goal_description = mockPersona.goalDescription;
  }

  if (mockPersona.emotions !== undefined) {
    // Convert emotions to dictionary format expected by backend
    const emotionsDict: Record<string, any> = {};
    mockPersona.emotions.forEach((e, index) => {
      // Use imagePath if available (stored during upload), otherwise imageUrl
      // imagePath is in format "bucket:object_name", imageUrl might be a temporary URL
      const imageValue = (e as any).imagePath || e.imageUrl;

      emotionsDict[e.name || `emotion_${index}`] = {
        name: e.name,
        description: e.description || '',
        image_url: imageValue || null
      };
    });
    update.emotions = emotionsDict;

    // Use first emotion's image as avatar
    if (mockPersona.emotions.length > 0) {
      const primaryEmotion = mockPersona.emotions[0] as any;
      update.avatar_base_url =
        primaryEmotion?.imagePath || primaryEmotion?.imageUrl || null;
    }
  }

  if (mockPersona.actions !== undefined) {
    const actions: Record<string, string> = {};
    const action_descriptions: Record<string, string> = {};
    const action_chat_messages: Record<string, string> = {};
    const action_popup_texts: Record<string, string> = {};
    const action_labels: Record<string, string> = {};
    mockPersona.actions.forEach(action => {
      actions[action.name] = action.description;
      if (action.label) action_labels[action.name] = action.label;
      if (action.shortDescription) action_descriptions[action.name] = action.shortDescription;
      if (action.chatMessage) action_chat_messages[action.name] = action.chatMessage;
      if (action.popupText) action_popup_texts[action.name] = action.popupText;
    });
    update.actions = actions;
    update.action_descriptions = action_descriptions;
    update.action_chat_messages = action_chat_messages;
    update.action_popup_texts = action_popup_texts;
    update.action_labels = action_labels;
  }

  if (mockPersona.reactions !== undefined) {
    update.reactions = mockPersona.reactions.map(r => ({
      name: r.name,
      description: r.description,
      prompt: r.prompt,
      selection_logic: r.selectionLogic || '',
      goals: r.goals || ''
    }));
  }

  if (mockPersona.style_and_language !== undefined) {
    update.style_and_language = mockPersona.style_and_language;
  }

  if (mockPersona.behavior_constraints !== undefined) {
    update.behavior_constraints = mockPersona.behavior_constraints;
  }

  if (mockPersona.internal_reasoning !== undefined) {
    update.internal_reasoning = mockPersona.internal_reasoning;
  }

  if (mockPersona.voice_enabled !== undefined) {
    update.voice_enabled = mockPersona.voice_enabled;
  }

  if (mockPersona.router_temperature !== undefined) {
    update.router_temperature = mockPersona.router_temperature;
  }

  if (mockPersona.talker_temperature !== undefined) {
    update.talker_temperature = mockPersona.talker_temperature;
  }

  if (mockPersona.behavior_mode !== undefined) {
    update.behavior_mode = behaviorMode;
  }

  if (mockPersona.behavior_config !== undefined) {
    update.behavior_config = clonePersonaBehaviorConfig(mockPersona.behavior_config);
  }

  return update;
}
