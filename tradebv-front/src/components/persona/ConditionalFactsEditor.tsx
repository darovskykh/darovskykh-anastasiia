import React, { useState } from 'react';
import { ChevronDown, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { FieldLabel } from '@/components/AudienceBadge';
import { cn } from '@/lib/utils';
import { newId, type ConditionalFact } from '@/types/personaStructure';

export function ConditionalFactsEditor({
  facts,
  onChange,
  title,
  description,
}: {
  facts: ConditionalFact[];
  onChange: (facts: ConditionalFact[]) => void;
  title: string;
  description: React.ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const update = (id: string, patch: Partial<ConditionalFact>) =>
    onChange(facts.map(f => (f.id === id ? { ...f, ...patch } : f)));

  const add = () => {
    const fact: ConditionalFact = { id: newId('fact'), name: 'Новий факт', condition: '', fact: '' };
    onChange([...facts, fact]);
    setOpenId(fact.id);
    setQuery('');
  };

  const q = query.trim().toLowerCase();
  const visible = q
    ? facts.filter(f => [f.name, f.condition, f.fact].some(text => text.toLowerCase().includes(q)))
    : facts;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{title}</h3>
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="mr-2 h-4 w-4" />
          Додати факт
        </Button>
      </div>

      {facts.length > 4 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Пошук по фактах" className="pl-9" />
        </div>
      )}

      {facts.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Фактів ще немає.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {visible.map(fact => {
            const isOpen = fact.id === openId;
            return (
              <li key={fact.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(isOpen ? null : fact.id)}
                  aria-expanded={isOpen}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-muted/40"
                >
                  <ChevronDown
                    className={cn('mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform', isOpen && 'rotate-180')}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{fact.name || 'Без назви'}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      Коли: {fact.condition || '—'}
                    </span>
                  </span>
                </button>
                {isOpen && (
                  <div className="space-y-4 px-4 pb-4 pl-11">
                    <div className="space-y-2">
                      <FieldLabel audience="ai" htmlFor={`${fact.id}-name`}>Назва факту</FieldLabel>
                      <Input
                        id={`${fact.id}-name`}
                        value={fact.name}
                        onChange={e => update(fact.id, { name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel audience="ai" htmlFor={`${fact.id}-condition`}>Умова: коли факт релевантний</FieldLabel>
                      <Textarea
                        id={`${fact.id}-condition`}
                        value={fact.condition}
                        onChange={e => update(fact.id, { condition: e.target.value })}
                        placeholder="Як AI зрозуміти під час діалогу, що зараз час згадати цей факт."
                        rows={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <FieldLabel audience="ai" htmlFor={`${fact.id}-fact`}>Факт</FieldLabel>
                      <Textarea
                        id={`${fact.id}-fact`}
                        value={fact.fact}
                        onChange={e => update(fact.id, { fact: e.target.value })}
                        placeholder="Інформація або вказівка для подальшої поведінки."
                        rows={4}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => onChange(facts.filter(f => f.id !== fact.id))}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Видалити факт
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
          {visible.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">Нічого не знайдено.</li>
          )}
        </ul>
      )}
    </section>
  );
}
