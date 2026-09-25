import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  ACTION_TENDENCIES,
  GOAL_PROGRESS_VALUES,
  PERSISTENCE_VALUES,
  ROUTE_MATCH_VALUES,
  type ActionTendency,
  type ControllerEventDefinition,
  type ControllerExample,
  type ControllerPrinciple,
  type ControllerRoutingRule,
  type ControllerStateTrack,
  type StatefulControllerConfigV2,
  type StatePersistence,
  type GoalProgress,
} from '@/types/personaBehavior';

interface PersonaBehaviorConfigEditorProps {
  value: StatefulControllerConfigV2;
  onChange: (value: StatefulControllerConfigV2) => void;
  emotionNames: string[];
  phaseNames: string[];
  onJsonValidityChange?: (field: string, valid: boolean) => void;
}

const splitList = (value: string): string[] => value.split(',').map(item => item.trim()).filter(Boolean);
const joinList = (value: string[] | undefined): string => (value ?? []).join(', ');
const fieldId = (label: string): string => `persona-v2-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

const safeJson = (value: unknown): string => JSON.stringify(value ?? {}, null, 2);

const JsonEditor: React.FC<{
  label: string;
  description: string;
  field: string;
  value: unknown;
  onChange: (value: unknown) => void;
  onValidityChange?: (field: string, valid: boolean) => void;
}> = ({ label, description, field, value, onChange, onValidityChange }) => {
  const [raw, setRaw] = useState(() => safeJson(value));
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setRaw(safeJson(value));
    setError(null);
    onValidityChange?.(field, true);
  }, [value, field, onValidityChange]);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{description}</p>
      <Textarea
        value={raw}
        onChange={(event) => {
          const next = event.target.value;
          setRaw(next);
          try {
            const parsed = JSON.parse(next);
            setError(null);
            onValidityChange?.(field, true);
            onChange(parsed);
          } catch {
            setError('Use valid JSON before saving this section.');
            onValidityChange?.(field, false);
          }
        }}
        rows={8}
        className="font-mono text-xs"
        aria-label={label}
      />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
};

const CommaSeparatedInput: React.FC<{
  label: string;
  value: string[] | undefined;
  placeholder?: string;
  onChange: (value: string[]) => void;
}> = ({ label, value, placeholder, onChange }) => {
  const [raw, setRaw] = useState(() => joinList(value));
  const id = fieldId(label);

  React.useEffect(() => {
    setRaw(joinList(value));
  }, [value]);

  const commit = () => onChange(splitList(raw));

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={raw}
        placeholder={placeholder}
        onChange={event => setRaw(event.target.value)}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
      />
    </div>
  );
};

const TrackStateMapInput: React.FC<{
  value: Record<string, string> | undefined;
  onChange: (value: Record<string, string>) => void;
}> = ({ value, onChange }) => {
  const [raw, setRaw] = useState(() => Object.entries(value || {}).map(([track, state]) => `${track}=${state}`).join(', '));
  const id = 'persona-v2-required-track-states';

  React.useEffect(() => {
    setRaw(Object.entries(value || {}).map(([track, state]) => `${track}=${state}`).join(', '));
  }, [value]);

  const commit = () => {
    const next = Object.fromEntries(
      splitList(raw).map(item => {
        const [track, state] = item.split('=');
        return [track, state || ''];
      }),
    );
    onChange(next);
  };

  return (
    <div className="space-y-1">
      <Label htmlFor={id}>Required track states</Label>
      <Input
        id={id}
        value={raw}
        onChange={event => setRaw(event.target.value)}
        onBlur={commit}
        onKeyDown={event => {
          if (event.key === 'Enter') {
            event.preventDefault();
            commit();
          }
        }}
        placeholder="conversation=open"
      />
    </div>
  );
};

const ToggleList: React.FC<{
  label: string;
  values: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}> = ({ label, values, selected, onChange }) => (
  <div className="space-y-2">
    <Label>{label}</Label>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {values.map(value => {
        const checked = selected.includes(value);
        return (
          <label key={value} className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={checked}
              onChange={(event) => {
                const next = event.target.checked
                  ? [...selected, value]
                  : selected.filter(item => item !== value);
                onChange(next);
              }}
              className="h-4 w-4 accent-primary"
            />
            <span>{value}</span>
          </label>
        );
      })}
    </div>
  </div>
);

const rowButtonClass = 'h-8 w-8 p-0 text-muted-foreground hover:text-destructive';

export const PersonaBehaviorConfigEditor: React.FC<PersonaBehaviorConfigEditorProps> = ({
  value,
  onChange,
  emotionNames,
  phaseNames,
  onJsonValidityChange,
}) => {
  const features = value.features;
  const phaseOptions = phaseNames.length ? phaseNames : ['default'];
  const emotionOptions = emotionNames.length ? emotionNames : ['neutral'];
  const eventIds = useMemo(() => features.events.map(event => event.id), [features.events]);
  const trackNames = useMemo(() => Object.keys(features.state_tracks), [features.state_tracks]);

  const patchConfig = (patch: Partial<StatefulControllerConfigV2>) => onChange({ ...value, ...patch });
  const patchFeatures = (patch: Partial<typeof features>) => onChange({ ...value, features: { ...features, ...patch } });

  const updateEvents = (events: ControllerEventDefinition[]) => patchFeatures({ events });
  const updateTrack = (name: string, patch: Partial<ControllerStateTrack>) => {
    patchFeatures({
      state_tracks: {
        ...features.state_tracks,
        [name]: { ...features.state_tracks[name], ...patch },
      },
    });
  };
  const renameTrack = (oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName || features.state_tracks[trimmed]) return;
    const tracks = { ...features.state_tracks };
    tracks[trimmed] = tracks[oldName];
    delete tracks[oldName];
    const rules = features.routing_rules.map(rule => ({
      ...rule,
      required_track_states: Object.fromEntries(
        Object.entries(rule.required_track_states || {}).map(([key, state]) => [key === oldName ? trimmed : key, state]),
      ),
    }));
    patchFeatures({ state_tracks: tracks, routing_rules: rules });
  };

  const addEvent = () => {
    const base = 'event';
    let id = base;
    let suffix = 2;
    while (eventIds.includes(id)) id = `${base}_${suffix++}`;
    updateEvents([...features.events, { id, description: 'Classify the latest player turn.', when: '' }]);
  };

  const addTrack = () => {
    const base = 'track';
    let name = base;
    let suffix = 2;
    while (trackNames.includes(name)) name = `${base}_${suffix++}`;
    patchFeatures({
      state_tracks: {
        ...features.state_tracks,
        [name]: {
          scope: name,
          rule: 'Track the current conversation state.',
          allowed_states: ['open'],
          initial_state: 'open',
          transitions: [],
        },
      },
    });
  };

  const addRoute = () => {
    const base = 'route';
    let id = base;
    let suffix = 2;
    while (features.routing_rules.some(rule => rule.id === id)) id = `${base}_${suffix++}`;
    const hasDefault = features.routing_rules.some(rule => rule.is_default);
    const route: ControllerRoutingRule = {
      id,
      offer_scope: features.offer_parser.scopes[0] || 'default',
      support_text: 'Use the selected action and current state to continue the conversation.',
      event_ids: hasDefault ? eventIds.slice(0, 1) : [],
      match: 'any',
      priority: features.routing_rules.length + 1,
      phase_id: phaseOptions[0],
      response_form_id: null,
      action_tendency: value.allowed_action_tendencies[0] || 'answer',
      goal_progress: value.allowed_goal_progress[0] || 'advance',
      persistence: value.allowed_persistence[0] || 'carry_forward',
      should_end: false,
      emotion_transition_id: null,
      acceptance_rule: false,
      persona_contributions: [],
      required_track_states: {},
      is_default: !hasDefault,
    };
    patchFeatures({ routing_rules: [...features.routing_rules, route] });
  };

  const updateRoute = (id: string, patch: Partial<ControllerRoutingRule>) => {
    patchFeatures({
      routing_rules: features.routing_rules.map(rule => rule.id === id ? { ...rule, ...patch } : rule),
    });
  };

  const selectDefaultRoute = (id: string) => {
    patchFeatures({
      routing_rules: features.routing_rules.map(rule => ({
        ...rule,
        is_default: rule.id === id,
        event_ids: rule.id !== id && rule.is_default && !rule.event_ids.length
          ? eventIds.slice(0, 1)
          : rule.event_ids,
      })),
    });
  };

  const removeRoute = (index: number) => {
    const remaining = features.routing_rules.filter((_, itemIndex) => itemIndex !== index);
    if (remaining.length && !remaining.some(rule => rule.is_default)) {
      remaining[0] = {
        ...remaining[0],
        is_default: true,
        event_ids: [],
      };
    }
    patchFeatures({ routing_rules: remaining });
  };

  const updatePrinciple = (index: number, patch: Partial<ControllerPrinciple>) => {
    const principles = value.principles.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item);
    patchConfig({ principles });
  };

  const updateExample = (index: number, patch: Partial<ControllerExample>) => {
    const examples = value.examples.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item);
    patchConfig({ examples });
  };

  return (
    <div className="space-y-6" data-testid="persona-v2-editor">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Stateful controller profile</CardTitle>
          <CardDescription>
            Define the controller vocabulary and the executable events, states, and routes used during a V2 simulation. Existing fields stay intact while you edit a section.
          </CardDescription>
          <a
            href="/persona-engine-map.pdf"
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Read the one-page engine map
          </a>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ToggleList
              label="Allowed action tendencies"
              values={ACTION_TENDENCIES}
              selected={value.allowed_action_tendencies}
              onChange={(allowed_action_tendencies) => patchConfig({ allowed_action_tendencies: allowed_action_tendencies as ActionTendency[] })}
            />
            <ToggleList
              label="Allowed goal progress"
              values={GOAL_PROGRESS_VALUES}
              selected={value.allowed_goal_progress}
              onChange={(allowed_goal_progress) => patchConfig({ allowed_goal_progress: allowed_goal_progress as GoalProgress[] })}
            />
            <ToggleList
              label="Allowed persistence"
              values={PERSISTENCE_VALUES}
              selected={value.allowed_persistence}
              onChange={(allowed_persistence) => patchConfig({ allowed_persistence: allowed_persistence as StatePersistence[] })}
            />
          </div>

          <Separator />
          <section className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">Principles</h3>
                <p className="text-xs text-muted-foreground">Conditional rules that constrain the controller's chosen move.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => patchConfig({ principles: [...value.principles, { id: `principle_${value.principles.length + 1}`, when: 'Use this action when the player needs a clear next step.', required_action: value.allowed_action_tendencies[0] || 'answer' }] })}>
                <Plus className="mr-1 h-4 w-4" /> Add principle
              </Button>
            </div>
            <details className="rounded-md border px-3">
              <summary className="cursor-pointer py-3 text-sm font-medium">Edit principles ({value.principles.length})</summary>
              <div className="space-y-3 pb-3">
                {value.principles.map((principle, index) => (
                  <div key={`${principle.id}-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_1fr_auto] gap-2 items-end rounded-md border p-3">
                    <div className="space-y-1"><Label>ID</Label><Input value={principle.id} onChange={event => updatePrinciple(index, { id: event.target.value })} /></div>
                    <div className="space-y-1"><Label>When</Label><Input value={principle.when} onChange={event => updatePrinciple(index, { when: event.target.value })} /></div>
                    <div className="space-y-1"><Label>Required action</Label><Select value={principle.required_action} onValueChange={required_action => updatePrinciple(index, { required_action: required_action as ActionTendency })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ACTION_TENDENCIES.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                    <Button type="button" variant="ghost" className={rowButtonClass} aria-label="Remove principle" onClick={() => patchConfig({ principles: value.principles.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </details>
          </section>

          <section className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="font-semibold">Examples</h3><p className="text-xs text-muted-foreground">Same-persona examples used to calibrate response realization.</p></div>
              <Button type="button" size="sm" variant="outline" onClick={() => patchConfig({ examples: [...value.examples, { phase_id: phaseOptions[0], action_tendency: value.allowed_action_tendencies[0] || 'answer', player_move: 'The player asks for a clear next step.', desired_reply: 'Answer with a clear next step.' }] })}><Plus className="mr-1 h-4 w-4" /> Add example</Button>
            </div>
            <details className="rounded-md border px-3">
              <summary className="cursor-pointer py-3 text-sm font-medium">Edit examples ({value.examples.length})</summary>
              <div className="space-y-3 pb-3">
                {value.examples.map((example, index) => (
                  <div key={`${example.phase_id}-${index}`} className="grid grid-cols-1 md:grid-cols-2 gap-3 rounded-md border p-3">
                    <div className="space-y-1"><Label>Phase</Label><Input list="persona-v2-phases" value={example.phase_id} onChange={event => updateExample(index, { phase_id: event.target.value })} /></div>
                    <div className="space-y-1"><Label>Action tendency</Label><Select value={example.action_tendency} onValueChange={action_tendency => updateExample(index, { action_tendency: action_tendency as ActionTendency })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ACTION_TENDENCIES.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                    <div className="space-y-1"><Label>Player move</Label><Textarea value={example.player_move} onChange={event => updateExample(index, { player_move: event.target.value })} rows={2} /></div>
                    <div className="space-y-1"><Label>Desired reply</Label><Textarea value={example.desired_reply} onChange={event => updateExample(index, { desired_reply: event.target.value })} rows={2} /></div>
                    <Button type="button" variant="ghost" className={`${rowButtonClass} justify-self-end`} aria-label="Remove example" onClick={() => patchConfig({ examples: value.examples.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </details>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Executable features</CardTitle><CardDescription>These records are the visible runtime contract for events, state, and routing.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">Events</h3><p className="text-xs text-muted-foreground">Closed event labels the controller can classify from a player turn.</p></div><Button type="button" size="sm" variant="outline" onClick={addEvent}><Plus className="mr-1 h-4 w-4" /> Add event</Button></div>
            <details className="rounded-md border px-3">
              <summary className="cursor-pointer py-3 text-sm font-medium">Edit events ({features.events.length})</summary>
              <div className="space-y-3 pb-3">
                {features.events.map((event, index) => (
                  <div key={`${event.id}-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_2fr_2fr_auto] gap-2 items-end rounded-md border p-3">
                    <div className="space-y-1"><Label>ID</Label><Input value={event.id} onChange={e => updateEvents(features.events.map((item, itemIndex) => itemIndex === index ? { ...item, id: e.target.value } : item))} /></div>
                    <div className="space-y-1"><Label>Description</Label><Input value={event.description || ''} onChange={e => updateEvents(features.events.map((item, itemIndex) => itemIndex === index ? { ...item, description: e.target.value } : item))} /></div>
                    <div className="space-y-1"><Label>When</Label><Input value={event.when || ''} onChange={e => updateEvents(features.events.map((item, itemIndex) => itemIndex === index ? { ...item, when: e.target.value } : item))} /></div>
                    <Button type="button" variant="ghost" className={rowButtonClass} aria-label="Remove event" onClick={() => updateEvents(features.events.filter((_, itemIndex) => itemIndex !== index))}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </details>
          </section>

          <Separator />
          <section className="space-y-3">
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">State tracks</h3><p className="text-xs text-muted-foreground">Each track is a named record with allowed states and executable transitions.</p></div><Button type="button" size="sm" variant="outline" onClick={addTrack}><Plus className="mr-1 h-4 w-4" /> Add track</Button></div>
            <details className="rounded-md border px-3">
              <summary className="cursor-pointer py-3 text-sm font-medium">Edit state tracks ({trackNames.length})</summary>
              <div className="space-y-3 pb-3">
                {trackNames.map(name => {
                  const track = features.state_tracks[name];
                  return (
                    <div key={name} className="space-y-3 rounded-md border p-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-1"><Label>Track key</Label><Input value={name} onChange={e => renameTrack(name, e.target.value)} /></div>
                    <div className="space-y-1"><Label>Scope</Label><Input value={track.scope} onChange={e => updateTrack(name, { scope: e.target.value })} /></div>
                    <div className="space-y-1"><Label>Initial state</Label><Input value={track.initial_state} onChange={e => updateTrack(name, { initial_state: e.target.value })} /></div>
                  </div>
                  <div className="space-y-1"><Label>Rule</Label><Textarea value={track.rule} onChange={e => updateTrack(name, { rule: e.target.value })} rows={2} /></div>
                  <CommaSeparatedInput label="Allowed states" value={track.allowed_states} onChange={allowed_states => updateTrack(name, { allowed_states })} />
                  <JsonEditor field={`state_track:${name}:transitions`} label="State transitions" description="Transitions use from_state, to_state, event_ids, match, and a unique priority." value={track.transitions} onChange={next => updateTrack(name, { transitions: Array.isArray(next) ? next as ControllerStateTrack['transitions'] : track.transitions })} onValidityChange={onJsonValidityChange} />
                  <Button type="button" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => {
                    const nextTracks = { ...features.state_tracks };
                    delete nextTracks[name];
                    patchFeatures({ state_tracks: nextTracks });
                  }}><Trash2 className="mr-2 h-4 w-4" /> Remove track</Button>
                    </div>
                  );
                })}
              </div>
            </details>
          </section>

          <Separator />
          <section className="space-y-3">
            <div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold">Routing rules</h3><p className="text-xs text-muted-foreground">Priority ordered outcomes selected from event evidence and current track state.</p></div><Button type="button" size="sm" variant="outline" onClick={addRoute}><Plus className="mr-1 h-4 w-4" /> Add route</Button></div>
            <details className="rounded-md border px-3">
              <summary className="cursor-pointer py-3 text-sm font-medium">Edit routing rules ({features.routing_rules.length})</summary>
              <div className="space-y-3 pb-3">
                {features.routing_rules.map((rule, index) => (
                  <div key={`${rule.id}-${index}`} className="space-y-3 rounded-md border p-3">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1"><Label>ID</Label><Input value={rule.id} onChange={e => updateRoute(rule.id, { id: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Phase</Label><Input list="persona-v2-phases" value={rule.phase_id} onChange={e => updateRoute(rule.id, { phase_id: e.target.value })} /></div>
                  <div className="space-y-1"><Label>Priority</Label><Input type="number" value={rule.priority} onChange={e => updateRoute(rule.id, { priority: Number(e.target.value) })} /></div>
                  <div className="space-y-1"><Label>Offer scope</Label><Input value={rule.offer_scope} onChange={e => updateRoute(rule.id, { offer_scope: e.target.value })} /></div>
                </div>
                <div className="space-y-1"><Label>Support text</Label><Textarea value={rule.support_text} onChange={e => updateRoute(rule.id, { support_text: e.target.value })} rows={2} /></div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1"><Label>Action tendency</Label><Select value={rule.action_tendency} onValueChange={action_tendency => updateRoute(rule.id, { action_tendency: action_tendency as ActionTendency })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(value.allowed_action_tendencies.length ? value.allowed_action_tendencies : ACTION_TENDENCIES).map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label>Goal progress</Label><Select value={rule.goal_progress} onValueChange={goal_progress => updateRoute(rule.id, { goal_progress: goal_progress as GoalProgress })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(value.allowed_goal_progress.length ? value.allowed_goal_progress : GOAL_PROGRESS_VALUES).map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                  <div className="space-y-1"><Label>Persistence</Label><Select value={rule.persistence} onValueChange={persistence => updateRoute(rule.id, { persistence: persistence as StatePersistence })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(value.allowed_persistence.length ? value.allowed_persistence : PERSISTENCE_VALUES).map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <CommaSeparatedInput label="Event IDs" value={rule.event_ids} onChange={event_ids => updateRoute(rule.id, { event_ids })} placeholder="event_a, event_b" />
                  <div className="space-y-1"><Label>Match</Label><Select value={rule.match} onValueChange={match => updateRoute(rule.id, { match: match as ControllerRoutingRule['match'] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ROUTE_MATCH_VALUES.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
                  <TrackStateMapInput value={rule.required_track_states} onChange={required_track_states => updateRoute(rule.id, { required_track_states })} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rule.is_default} onChange={() => selectDefaultRoute(rule.id)} className="h-4 w-4 accent-primary" /> Default route</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rule.should_end} onChange={e => updateRoute(rule.id, { should_end: e.target.checked })} className="h-4 w-4 accent-primary" /> Ends the simulation</label>
                  <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={rule.acceptance_rule} onChange={e => updateRoute(rule.id, { acceptance_rule: e.target.checked })} className="h-4 w-4 accent-primary" /> Acceptance rule</label>
                </div>
                <Button type="button" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => removeRoute(index)}><Trash2 className="mr-2 h-4 w-4" /> Remove route</Button>
                  </div>
                ))}
              </div>
            </details>
          </section>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Memory and advanced features</CardTitle><CardDescription>Common memory settings are editable here. Advanced nested records retain their original shape and accept JSON for less frequent edits.</CardDescription></CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CommaSeparatedInput label="Fact classifications" value={features.fact_ledger.classifications} onChange={classifications => patchFeatures({ fact_ledger: { ...features.fact_ledger, classifications } })} placeholder="preference, constraint" />
            <div className="space-y-2"><Label htmlFor="persona-v2-max-facts">Maximum retained facts</Label><Input id="persona-v2-max-facts" type="number" min={1} max={50} value={features.fact_ledger.max_facts} onChange={e => patchFeatures({ fact_ledger: { ...features.fact_ledger, max_facts: Number(e.target.value) } })} /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="persona-v2-policy-revision">Agency policy revision</Label><Input id="persona-v2-policy-revision" type="number" min={1} value={features.agency_policy?.policy_revision ?? 1} onChange={e => patchFeatures({ agency_policy: { ...(features.agency_policy || {}), policy_revision: Number(e.target.value) } })} /></div>
          <details className="rounded-md border px-3">
            <summary className="cursor-pointer py-3 text-sm font-medium">Edit advanced nested records</summary>
            <div className="space-y-6 pb-3">
              <JsonEditor field="response_forms" label="Response forms" description="Legacy V2 policies use response_forms; shared agency profiles leave this list empty." value={features.response_forms} onChange={next => patchFeatures({ response_forms: Array.isArray(next) ? next as typeof features.response_forms : features.response_forms })} onValidityChange={onJsonValidityChange} />
              <JsonEditor field="emotion_transitions" label="Emotion transitions" description="Each transition points at an event set and one configured persona emotion." value={features.emotion_transitions} onChange={next => patchFeatures({ emotion_transitions: Array.isArray(next) ? next as typeof features.emotion_transitions : features.emotion_transitions })} onValidityChange={onJsonValidityChange} />
              <JsonEditor field="offer_parser" label="Offer parser" description="Configure evidence bound commercial fields and scopes." value={features.offer_parser} onChange={next => patchFeatures({ offer_parser: next as typeof features.offer_parser })} onValidityChange={onJsonValidityChange} />
              <JsonEditor field="pilot_risk_matrix" label="Pilot risk matrix" description="Required for acceptance rules. Keep supplier burdens and acceptance requirements aligned with the configured offer fields." value={features.pilot_risk_matrix} onChange={next => patchFeatures({ pilot_risk_matrix: next as typeof features.pilot_risk_matrix })} onValidityChange={onJsonValidityChange} />
            </div>
          </details>
          <p className="text-xs text-muted-foreground">Configured events: {eventIds.join(', ') || 'none'} · Tracks: {trackNames.join(', ') || 'none'} · Emotions available: {emotionOptions.join(', ')}</p>
          <datalist id="persona-v2-phases">{phaseOptions.map(phase => <option key={phase} value={phase} />)}</datalist>
        </CardContent>
      </Card>
    </div>
  );
};

export default PersonaBehaviorConfigEditor;
