import React from 'react';
import { cn } from '@/lib/utils';

interface RichTextContentProps {
  /** HTML string from Quill editor (e.g. role_in_simulation, persona_description, case_overview) */
  html: string;
  className?: string;
  /** When true, h1/h2/h3 render as normal body text (for intro steps, persona modal) */
  plainHeadings?: boolean;
}

/**
 * Renders HTML from Quill editor as formatted content (lists, bold, italic, etc.).
 * Use for displaying case intro steps and step modals.
 */
export const RichTextContent: React.FC<RichTextContentProps> = ({ html, className, plainHeadings }) => {
  if (!html || typeof html !== 'string') {
    return null;
  }
  return (
    <div
      className={cn(
        'rich-text-content text-foreground leading-relaxed',
        plainHeadings && 'rich-text-content-plain-headings',
        className
      )}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
