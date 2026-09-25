/**
 * The structured persona profile consumed by the stateful controller.
 *
 * These types intentionally mirror the FastAPI schema.  The editor updates
 * individual fields while retaining the rest of the object, which keeps
 * newer backend fields intact when an older frontend opens and saves a
 * persona.
 */

export type PersonaBehaviorMode = 'legacy_router_talker' | 'stateful_controller';

export type ActionTendency =
  | 'answer'
  | 'probe'
  | 'withhold_and_probe'
  | 'challenge'
  | 'concede_conditionally'
  | 'reassure'
  | 'refuse'
  | 'close';

export type GoalProgress =
  | 'advance'
  | 'protect'
  | 'test'
  | 'delay'
  | 'accept'
  | 'abandon';

export type StatePersistence = 'transient' | 'carry_forward' | 'decay_next_turn';
export type RouteMatch = 'any' | 'all';

export type ReplySegmentKind =
  | 'social'
  | 'answer'
  | 'observation'
  | 'boundary'
  | 'condition'
  | 'question'
  | 'confirmation'
  | 'goodbye';

export type OfferField =
  | 'product'
  | 'volume'
  | 'timing'
  | 'allocation'
  | 'price_discount_rebate'
  | 'owner'
  | 'support'
  | 'reliability'
  | 'review_exit_rule';

export interface ControllerPrinciple {
  id: string;
  when: string;
  required_action: ActionTendency;
  [key: string]: unknown;
}

export interface ControllerExample {
  phase_id: string;
  action_tendency: ActionTendency;
  player_move: string;
  desired_reply: string;
  [key: string]: unknown;
}

export interface ControllerEventDefinition {
  id: string;
  description?: string;
  when?: string | null;
  [key: string]: unknown;
}

export interface ControllerStateTransition {
  from_state: string;
  to_state: string;
  event_ids: string[];
  match: RouteMatch;
  priority: number;
  [key: string]: unknown;
}

export interface ControllerStateTrack {
  scope: string;
  rule: string;
  allowed_states: string[];
  initial_state: string;
  transitions: ControllerStateTransition[];
  [key: string]: unknown;
}

export interface ControllerFactLedger {
  classifications: string[];
  max_facts: number;
  [key: string]: unknown;
}

export interface ControllerResponseForm {
  id: string;
  use: string;
  required_segments: ReplySegmentKind[];
  optional_segments: ReplySegmentKind[];
  max_segments: number;
  terminal: boolean;
  [key: string]: unknown;
}

export interface ControllerEmotionTransition {
  id: string;
  event_ids: string[];
  match: RouteMatch;
  priority: number;
  emotion: string;
  persistence: StatePersistence;
  intensity: number;
  decay_to_emotion?: string | null;
  decay_factor?: number | null;
  [key: string]: unknown;
}

export interface ControllerOfferParser {
  fields: OfferField[];
  scopes: string[];
  [key: string]: unknown;
}

export interface ControllerPilotRequirement {
  id: string;
  required_offer_fields: OfferField[];
  [key: string]: unknown;
}

export interface ControllerPilotRiskMatrix {
  supplier_burdens: ControllerPilotRequirement[];
  allowed_persona_contributions: string[];
  max_persona_contributions: number;
  acceptance_requirements: ControllerPilotRequirement[];
  [key: string]: unknown;
}

export interface ControllerRoutingRule {
  id: string;
  offer_scope: string;
  support_text: string;
  event_ids: string[];
  match: RouteMatch;
  priority: number;
  phase_id: string;
  response_form_id?: string | null;
  action_tendency: ActionTendency;
  goal_progress: GoalProgress;
  persistence: StatePersistence;
  should_end: boolean;
  emotion_transition_id?: string | null;
  acceptance_rule: boolean;
  persona_contributions: string[];
  required_track_states: Record<string, string>;
  is_default: boolean;
  [key: string]: unknown;
}

export interface StatefulControllerFeaturesV2 {
  events: ControllerEventDefinition[];
  response_forms: ControllerResponseForm[];
  agency_policy?: { policy_revision: number; [key: string]: unknown } | null;
  state_tracks: Record<string, ControllerStateTrack>;
  fact_ledger: ControllerFactLedger;
  emotion_transitions: ControllerEmotionTransition[];
  offer_parser: ControllerOfferParser;
  pilot_risk_matrix?: ControllerPilotRiskMatrix | null;
  routing_rules: ControllerRoutingRule[];
  offer_expiry_revisions?: number | null;
  [key: string]: unknown;
}

export interface StatefulControllerConfigV2 {
  schema_version: 2;
  allowed_action_tendencies: ActionTendency[];
  allowed_goal_progress: GoalProgress[];
  allowed_persistence: StatePersistence[];
  principles: ControllerPrinciple[];
  examples: ControllerExample[];
  features: StatefulControllerFeaturesV2;
  [key: string]: unknown;
}

export const ACTION_TENDENCIES: ActionTendency[] = [
  'answer',
  'probe',
  'withhold_and_probe',
  'challenge',
  'concede_conditionally',
  'reassure',
  'refuse',
  'close',
];

export const GOAL_PROGRESS_VALUES: GoalProgress[] = [
  'advance',
  'protect',
  'test',
  'delay',
  'accept',
  'abandon',
];

export const PERSISTENCE_VALUES: StatePersistence[] = [
  'transient',
  'carry_forward',
  'decay_next_turn',
];

export const ROUTE_MATCH_VALUES: RouteMatch[] = ['any', 'all'];

export const REPLY_SEGMENTS: ReplySegmentKind[] = [
  'social',
  'answer',
  'observation',
  'boundary',
  'condition',
  'question',
  'confirmation',
  'goodbye',
];

export const OFFER_FIELDS: OfferField[] = [
  'product',
  'volume',
  'timing',
  'allocation',
  'price_discount_rebate',
  'owner',
  'support',
  'reliability',
  'review_exit_rule',
];

export const clonePersonaBehaviorConfig = (
  config: StatefulControllerConfigV2 | null | undefined,
): StatefulControllerConfigV2 | null => {
  if (!config) return null;
  return JSON.parse(JSON.stringify(config)) as StatefulControllerConfigV2;
};

/** Small valid starting profile used only after an editor explicitly selects V2. */
export const createDefaultPersonaBehaviorConfig = (
  phaseId = 'default',
): StatefulControllerConfigV2 => ({
  schema_version: 2,
  allowed_action_tendencies: ['answer', 'probe'],
  allowed_goal_progress: ['advance', 'protect'],
  allowed_persistence: ['carry_forward'],
  principles: [],
  examples: [],
  features: {
    events: [{ id: 'default', description: 'The player gives a relevant response.' }],
    response_forms: [],
    agency_policy: { policy_revision: 1 },
    state_tracks: {
      conversation: {
        scope: 'conversation',
        rule: 'Track the current conversation phase.',
        allowed_states: ['open'],
        initial_state: 'open',
        transitions: [],
      },
    },
    fact_ledger: { classifications: ['preference'], max_facts: 20 },
    emotion_transitions: [],
    offer_parser: { fields: [], scopes: ['default'] },
    pilot_risk_matrix: null,
    routing_rules: [
      {
        id: 'default',
        offer_scope: 'default',
        support_text: 'Use the persona goals and the current phase to respond.',
        event_ids: [],
        match: 'any',
        priority: 100,
        phase_id: phaseId,
        response_form_id: null,
        action_tendency: 'answer',
        goal_progress: 'advance',
        persistence: 'carry_forward',
        should_end: false,
        emotion_transition_id: null,
        acceptance_rule: false,
        persona_contributions: [],
        required_track_states: {},
        is_default: true,
      },
    ],
  },
});
