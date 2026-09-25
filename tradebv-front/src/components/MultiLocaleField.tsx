import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, Minus } from 'lucide-react';
import { RichTextEditor } from '@/components/RichTextEditor';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  SUPPORTED_LOCALES,
  LOCALE_LABELS,
  splitAllLocales,
  combineAllLocales,
  type LocaleCode,
} from '@/utils/localizedContent';

type FieldKind = 'rich' | 'input' | 'textarea';

interface MultiLocaleFieldProps {
  kind: FieldKind;
  combined: string;
  onChangeCombined: (next: string) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
}

/**
 * Single-field localised editor: shows ONE input/textarea/rich-text for the
 * currently-picked locale, with a dropdown to switch locale. The combined
 * string preserves `<!-- en --> ... <!-- uk --> ...` markers so the runtime
 * `extractLocalizedContent` keeps working unchanged.
 *
 * Filled / empty status per locale is shown as a small check / dash icon
 * inside the dropdown — admins can see at a glance which translations are
 * missing without switching through each one.
 */
export const MultiLocaleField: React.FC<MultiLocaleFieldProps> = ({
  kind,
  combined,
  onChangeCombined,
  placeholder,
  rows,
  id,
}) => {
  const { language } = useLanguage();
  const initial: LocaleCode = (SUPPORTED_LOCALES as readonly string[]).includes(language)
    ? (language as LocaleCode)
    : 'en';
  const [active, setActive] = useState<LocaleCode>(initial);

  const parts = splitAllLocales(combined);
  // Legacy records often contain one unmarked string. Keep that value visible
  // in every locale selector until the editor explicitly creates translations;
  // this prevents an English editor from showing a blank title and then
  // round-tripping an unchanged case as an empty field.
  const hasLocaleMarkers = /<!--\s*(?:en|uk|ar|es|pt|ru)\s*-->/i.test(combined);
  const currentValue = hasLocaleMarkers ? parts[active] ?? '' : combined;

  const setValue = (next: string) => {
    const editableParts = hasLocaleMarkers
      ? parts
      : SUPPORTED_LOCALES.reduce((acc, locale) => {
          acc[locale] = '';
          return acc;
        }, {} as Record<LocaleCode, string>);
    onChangeCombined(combineAllLocales({ ...editableParts, [active]: next }));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end">
        <Select value={active} onValueChange={(v) => setActive(v as LocaleCode)}>
          <SelectTrigger className="h-8 w-[200px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SUPPORTED_LOCALES.map((loc) => {
              const filled = (parts[loc] || '').trim().length > 0;
              const meta = LOCALE_LABELS[loc];
              return (
                <SelectItem key={loc} value={loc}>
                  <span className="inline-flex items-center gap-2">
                    {filled ? (
                      <Check className="h-3 w-3 text-emerald-600" />
                    ) : (
                      <Minus className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="font-semibold">{meta.code}</span>
                    <span className="text-muted-foreground">— {meta.native}</span>
                  </span>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {kind === 'rich' && (
        <RichTextEditor
          id={id}
          value={currentValue}
          onChange={setValue}
          placeholder={placeholder}
        />
      )}

      {kind === 'input' && (
        <Input
          id={id}
          value={currentValue}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
        />
      )}

      {kind === 'textarea' && (
        <Textarea
          id={id}
          value={currentValue}
          onChange={(e) => setValue(e.target.value)}
          placeholder={placeholder}
          rows={rows ?? 4}
        />
      )}
    </div>
  );
};
