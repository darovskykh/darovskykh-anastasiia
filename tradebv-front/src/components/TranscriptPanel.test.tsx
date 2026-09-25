/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TranscriptPanel from './TranscriptPanel';

describe('TranscriptPanel', () => {
  it('renders durable messages with the snapshot persona and participant labels', () => {
    render(
      <TranscriptPanel
        messages={[
          { message_type: 'human', message_text: 'Can we adjust the volume?' },
          { message_type: 'ai', message_text: 'Let us review the allocation.' },
        ]}
        personaName="Adrian"
        participantName="Evaluating user"
      />,
    );

    expect(screen.getByText('Evaluating user')).toBeInTheDocument();
    expect(screen.getByText('Adrian')).toBeInTheDocument();
    expect(screen.getByText('Can we adjust the volume?')).toBeInTheDocument();
    expect(screen.getByText('Let us review the allocation.')).toBeInTheDocument();
    expect(screen.getByText('Saved conversation messages from this session.')).toBeInTheDocument();
  });

  it('keeps both server export actions available while the transcript is visible', () => {
    const onDownload = vi.fn();
    render(
      <TranscriptPanel
        messages={[{ message_type: 'ai', message_text: 'Hello' }]}
        onDownload={onDownload}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /download text/i }));
    fireEvent.click(screen.getByRole('button', { name: /download pdf/i }));

    expect(onDownload).toHaveBeenNthCalledWith(1, 'txt');
    expect(onDownload).toHaveBeenNthCalledWith(2, 'pdf');
  });
});
