import React, { useState } from 'react';
import { ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type Agent = 'talker' | 'controller';

interface Block {
  title: string;
  detail: string;
  source: string;
}

interface Section {
  label: string;
  blocks: Block[];
}

const SCHEMES: Record<Agent, Section[]> = {
  talker: [
    {
      label: 'Вступ',
      blocks: [
        { title: 'Базовий промпт AI-співрозмовника', detail: 'Як по-людськи спілкуватися з юзером.', source: 'Базовий промпт' },
        { title: 'Універсальні факти', detail: 'Лише ті, що AI-ведучий визнав релевантними на цьому кроці.', source: 'Базовий промпт → Універсальні факти' },
        { title: 'Стале пояснення кейсу', detail: 'Хто ти, що за ситуація, загальні правила поведінки.', source: 'Кейс → Основні: Флоу розмови, Правила поведінки сценарію' },
        { title: 'Персона', detail: 'Ім\'я та роль персони.', source: 'Кейс → Персона' },
        { title: 'Поточні фази станів', detail: 'Для кожного стану — інструкція фази, у якій зараз діалог.', source: 'Кейс → Персона → Стани' },
        { title: 'Релевантні факти персони', detail: 'Лише факти, умови яких спрацювали.', source: 'Кейс → Персона → Факти' },
      ],
    },
    {
      label: 'Розмова',
      blocks: [
        { title: 'Історія діалогу', detail: 'Повідомлення юзера і персони по черзі.', source: 'Симуляція' },
        { title: 'Виконані дії юзера', detail: 'Текст дії в чаті та інструкція дії для AI.', source: 'Кейс → Основні → Дії користувача' },
      ],
    },
    {
      label: 'Фінал',
      blocks: [
        { title: 'Інструкція на відповідь', detail: 'Дай наступну репліку від імені персони.', source: 'Системний текст' },
      ],
    },
  ],
  controller: [
    {
      label: 'Вступ',
      blocks: [
        { title: 'Базовий промпт AI, що веде діалог', detail: 'Як розуміти рух діалогу й ухвалювати рішення.', source: 'Базовий промпт' },
        { title: 'Умови фактів', detail: 'Назви та умови універсальних фактів і фактів персони, щоб обрати релевантні.', source: 'Базовий промпт + Кейс → Персона → Факти' },
        { title: 'Стани та фази', detail: 'Для кожного стану — поточна фаза, куди можна перейти і як обрати перехід.', source: 'Кейс → Персона → Стани' },
      ],
    },
    {
      label: 'Розмова',
      blocks: [
        { title: 'Історія діалогу', detail: 'Весь діалог як він є, разом із виконаними діями юзера.', source: 'Симуляція' },
      ],
    },
    {
      label: 'Фінал',
      blocks: [
        { title: 'Інструкція на рішення', detail: 'Обери наступну фазу кожного стану і релевантні факти.', source: 'Системний текст' },
      ],
    },
  ],
};

export function PromptAssemblyScheme() {
  const [agent, setAgent] = useState<Agent>('talker');
  let counter = 0;

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg border bg-muted/40 p-1" role="tablist" aria-label="Для якого AI">
        {([
          ['talker', 'AI-співрозмовник'],
          ['controller', 'AI, що веде діалог'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={agent === value}
            onClick={() => setAgent(value)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm transition-colors',
              agent === value ? 'bg-background font-medium shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {SCHEMES[agent].map((section, sectionIndex) => (
          <React.Fragment key={section.label}>
            {sectionIndex > 0 && (
              <div className="flex justify-center py-1 text-muted-foreground">
                <ArrowDown className="h-4 w-4" aria-hidden />
              </div>
            )}
            <div className="grid gap-3 rounded-xl border bg-card p-3 sm:grid-cols-[96px_minmax(0,1fr)] sm:p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:pt-2">{section.label}</div>
              <ol className="space-y-2">
                {section.blocks.map(block => {
                  counter += 1;
                  return (
                    <li key={block.title} className="flex gap-3 rounded-lg border bg-background px-3 py-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-50 text-xs font-semibold text-sky-800">
                        {counter}
                      </span>
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium">{block.title}</p>
                        <p className="text-xs text-muted-foreground">{block.detail}</p>
                        <p className="text-xs text-sky-800">Звідки: {block.source}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
