import React from 'react';
import { Bot, User, Users } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { Audience } from '@/types/personaStructure';

const AUDIENCE_META: Record<Audience, { label: string; hint: string; className: string; Icon: typeof Bot }> = {
  ai: {
    label: 'Для AI',
    hint: 'Цей текст іде в інструкцію для AI. Юзер його не бачить.',
    className: 'border-sky-200 bg-sky-50 text-sky-800',
    Icon: Bot,
  },
  user: {
    label: 'Для юзера',
    hint: 'Цей текст бачить юзер в інтерфейсі. AI його не отримує.',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    Icon: User,
  },
  both: {
    label: 'Для обох',
    hint: 'Цей текст бачить юзер, і він також потрапляє до AI.',
    className: 'border-amber-200 bg-amber-50 text-amber-800',
    Icon: Users,
  },
};

export function AudienceBadge({ audience, className }: { audience: Audience; className?: string }) {
  const { label, hint, className: tone, Icon } = AUDIENCE_META[audience];
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              'inline-flex shrink-0 cursor-default items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium leading-4',
              tone,
              className,
            )}
          >
            <Icon className="h-3 w-3" aria-hidden />
            {label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {hint}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function FieldLabel({
  audience,
  htmlFor,
  children,
}: {
  audience: Audience;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor={htmlFor}>{children}</Label>
      <AudienceBadge audience={audience} />
    </div>
  );
}
