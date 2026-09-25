import React, { useEffect, useRef, useState } from 'react';
import { Flag, ImagePlus, Plus, Smile, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { FieldLabel } from '@/components/AudienceBadge';
import { PhaseTransitionMap } from '@/components/persona/PhaseTransitionMap';
import { cn } from '@/lib/utils';
import { newId, type PersonaPhase, type PersonaState } from '@/types/personaStructure';

function createPhase(name: string): PersonaPhase {
  return { id: newId('phase'), name, instruction: '', transitions: [], transitionRule: '', emotionImageUrl: null };
}

function createState(index: number): PersonaState {
  const phase = createPhase('Стартова фаза');
  return {
    id: newId('state'),
    name: `Новий стан ${index}`,
    description: '',
    drivesEmotion: false,
    startPhaseId: phase.id,
    phases: [phase],
  };
}

export function PersonaStatesEditor({
  states,
  onChange,
}: {
  states: PersonaState[];
  onChange: (states: PersonaState[]) => void;
}) {
  const [selectedStateId, setSelectedStateId] = useState<string | null>(states[0]?.id ?? null);
  const [selectedPhaseId, setSelectedPhaseId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const state = states.find(s => s.id === selectedStateId) ?? states[0] ?? null;
  const phase = state?.phases.find(p => p.id === selectedPhaseId) ?? null;

  useEffect(() => {
    if (!state) return;
    if (!selectedPhaseId || !state.phases.some(p => p.id === selectedPhaseId)) {
      setSelectedPhaseId(state.startPhaseId || state.phases[0]?.id || null);
    }
  }, [state, selectedPhaseId]);

  const updateState = (stateId: string, patch: Partial<PersonaState>) =>
    onChange(states.map(s => (s.id === stateId ? { ...s, ...patch } : s)));

  const updatePhase = (phaseId: string, patch: Partial<PersonaPhase>) => {
    if (!state) return;
    updateState(state.id, { phases: state.phases.map(p => (p.id === phaseId ? { ...p, ...patch } : p)) });
  };

  const addState = () => {
    const next = createState(states.length + 1);
    onChange([...states, next]);
    setSelectedStateId(next.id);
    setSelectedPhaseId(next.startPhaseId);
  };

  const removeState = (stateId: string) => {
    const remaining = states.filter(s => s.id !== stateId);
    onChange(remaining);
    setSelectedStateId(remaining[0]?.id ?? null);
    setSelectedPhaseId(null);
  };

  const setDrivesEmotion = (stateId: string, value: boolean) =>
    onChange(states.map(s => ({ ...s, drivesEmotion: s.id === stateId ? value : value ? false : s.drivesEmotion })));

  const addPhase = () => {
    if (!state) return;
    const next = createPhase(`Фаза ${state.phases.length + 1}`);
    updateState(state.id, { phases: [...state.phases, next] });
    setSelectedPhaseId(next.id);
  };

  const removePhase = (phaseId: string) => {
    if (!state || state.phases.length <= 1) return;
    const phases = state.phases
      .filter(p => p.id !== phaseId)
      .map(p => ({ ...p, transitions: p.transitions.filter(id => id !== phaseId) }));
    updateState(state.id, {
      phases,
      startPhaseId: state.startPhaseId === phaseId ? phases[0].id : state.startPhaseId,
    });
    setSelectedPhaseId(phases[0].id);
  };

  const toggleTransition = (targetId: string) => {
    if (!phase) return;
    const has = phase.transitions.includes(targetId);
    updatePhase(phase.id, {
      transitions: has ? phase.transitions.filter(id => id !== targetId) : [...phase.transitions, targetId],
    });
  };

  const handleEmotionImage = (file: File | undefined) => {
    if (!file || !phase) return;
    updatePhase(phase.id, { emotionImageUrl: URL.createObjectURL(file) });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">Стани персони</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">
            Кожен стан — це щось важливе, що ми трекаємо під час діалогу. Усередині стану є фази: з кожної фази
            персона може перейти лише у фази, вказані у її переходах.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addState}>
          <Plus className="mr-2 h-4 w-4" />
          Додати стан
        </Button>
      </div>

      {states.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          У персони ще немає станів.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Стани персони">
            {states.map(s => (
              <button
                key={s.id}
                type="button"
                role="tab"
                aria-selected={s.id === state?.id}
                onClick={() => {
                  setSelectedStateId(s.id);
                  setSelectedPhaseId(s.startPhaseId);
                }}
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  s.id === state?.id
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/40',
                )}
              >
                <span className="font-medium">{s.name || 'Без назви'}</span>
                <span className="text-xs text-muted-foreground">{s.phases.length} фаз</span>
                {s.drivesEmotion && <Smile className="h-4 w-4 text-amber-600" aria-label="Відповідає за емоцію" />}
              </button>
            ))}
          </div>

          {state && (
            <div className="space-y-5 rounded-xl border bg-card p-4 sm:p-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <FieldLabel audience="ai" htmlFor="state-name">Назва стану</FieldLabel>
                  <Input
                    id="state-name"
                    value={state.name}
                    onChange={e => updateState(state.id, { name: e.target.value })}
                    placeholder="Напр. Проблема поставок"
                  />
                </div>
                <div className="flex items-start justify-between gap-4 rounded-lg border bg-muted/20 p-3">
                  <div className="space-y-1">
                    <Label htmlFor="state-emotion">Відповідає за емоційну картинку</Label>
                    <p className="text-xs text-muted-foreground">
                      Картинки емоцій прив'язуються до фаз цього стану. Такий стан може бути лише один.
                    </p>
                  </div>
                  <Switch
                    id="state-emotion"
                    checked={state.drivesEmotion}
                    onCheckedChange={checked => setDrivesEmotion(state.id, checked)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <FieldLabel audience="ai" htmlFor="state-description">Що трекає цей стан</FieldLabel>
                <Textarea
                  id="state-description"
                  value={state.description}
                  onChange={e => updateState(state.id, { description: e.target.value })}
                  placeholder="Напр. Як просувається вирішення проблеми поставок, з якою прийшов Adrian."
                  rows={2}
                />
              </div>

              <div className="grid gap-5 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Фази</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={addPhase}>
                      <Plus className="mr-1 h-4 w-4" />
                      Фаза
                    </Button>
                  </div>
                  <ul className="space-y-1.5">
                    {state.phases.map(p => {
                      const isStart = p.id === state.startPhaseId;
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedPhaseId(p.id)}
                            className={cn(
                              'flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                              p.id === phase?.id ? 'border-primary bg-primary/5' : 'border-transparent hover:bg-muted/60',
                            )}
                          >
                            {state.drivesEmotion && (
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-muted">
                                {p.emotionImageUrl ? (
                                  <img src={p.emotionImageUrl} alt="" className="h-full w-full object-cover" />
                                ) : (
                                  <Smile className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                              </span>
                            )}
                            <span className="min-w-0 flex-1 truncate">{p.name || 'Без назви'}</span>
                            {isStart && (
                              <Badge variant="outline" className="shrink-0 border-success/40 text-success">
                                Старт
                              </Badge>
                            )}
                            <span className="shrink-0 text-xs text-muted-foreground">→ {p.transitions.length}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>

                {phase && (
                  <div className="space-y-4 rounded-lg border bg-background p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                      <div className="flex-1 space-y-2">
                        <FieldLabel audience="ai" htmlFor="phase-name">Назва фази</FieldLabel>
                        <Input
                          id="phase-name"
                          value={phase.name}
                          onChange={e => updatePhase(phase.id, { name: e.target.value })}
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={phase.id === state.startPhaseId ? 'secondary' : 'outline'}
                          size="sm"
                          disabled={phase.id === state.startPhaseId}
                          onClick={() => updateState(state.id, { startPhaseId: phase.id })}
                        >
                          <Flag className="mr-2 h-4 w-4" />
                          {phase.id === state.startPhaseId ? 'Стартова фаза' : 'Зробити стартовою'}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={state.phases.length <= 1}
                          onClick={() => removePhase(phase.id)}
                          aria-label="Видалити фазу"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <FieldLabel audience="ai" htmlFor="phase-instruction">1. Інструкція для персони в цій фазі</FieldLabel>
                      <Textarea
                        id="phase-instruction"
                        value={phase.instruction}
                        onChange={e => updatePhase(phase.id, { instruction: e.target.value })}
                        placeholder="Як персона поводиться, поки діалог у цій фазі."
                        rows={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <FieldLabel audience="ai">2. Куди можна перейти з цієї фази</FieldLabel>
                      <div className="flex flex-wrap gap-1.5">
                        {state.phases.map(target => {
                          const selected = phase.transitions.includes(target.id);
                          const isSelf = target.id === phase.id;
                          return (
                            <button
                              key={target.id}
                              type="button"
                              aria-pressed={selected}
                              onClick={() => toggleTransition(target.id)}
                              className={cn(
                                'rounded-full border px-3 py-1 text-xs transition-colors',
                                selected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-border bg-background text-muted-foreground hover:border-primary/50',
                              )}
                            >
                              {target.name || 'Без назви'}
                              {isSelf && ' (залишитися)'}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Перелічуємо лише фази, куди перейти можна. Якщо персона може лишитися в цій же фазі — позначте і її.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <FieldLabel audience="ai" htmlFor="phase-rule">3. Як обрати, куди перейти</FieldLabel>
                      <Textarea
                        id="phase-rule"
                        value={phase.transitionRule}
                        onChange={e => updatePhase(phase.id, { transitionRule: e.target.value })}
                        placeholder="За яким принципом AI обирає одну з доступних фаз."
                        rows={4}
                      />
                    </div>

                    {state.drivesEmotion && (
                      <div className="space-y-2">
                        <FieldLabel audience="user">Картинка емоції для цієї фази</FieldLabel>
                        <div className="flex items-center gap-3">
                          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                            {phase.emotionImageUrl ? (
                              <img src={phase.emotionImageUrl} alt={phase.name} className="h-full w-full object-cover" />
                            ) : (
                              <Smile className="h-6 w-6 text-muted-foreground" />
                            )}
                          </div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              handleEmotionImage(e.target.files?.[0]);
                              e.target.value = '';
                            }}
                          />
                          <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                            <ImagePlus className="mr-2 h-4 w-4" />
                            {phase.emotionImageUrl ? 'Замінити' : 'Завантажити'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Карта переходів</Label>
                <div className="rounded-lg border bg-muted/20 p-2">
                  <PhaseTransitionMap
                    phases={state.phases}
                    startPhaseId={state.startPhaseId}
                    selectedPhaseId={phase?.id ?? null}
                    onSelect={setSelectedPhaseId}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Зелена рамка — стартова фаза. Стрілки обраної фази підсвічені. Клік по фазі відкриває її.
                </p>
              </div>

              <div className="flex justify-end border-t pt-4">
                <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => removeState(state.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Видалити стан
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
