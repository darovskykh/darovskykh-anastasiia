/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import PersonaBehaviorConfigEditor from './PersonaBehaviorConfigEditor';
import { createDefaultPersonaBehaviorConfig, type StatefulControllerConfigV2 } from '@/types/personaBehavior';

describe('PersonaBehaviorConfigEditor', () => {
  afterEach(() => cleanup());

  it('keeps a trailing comma while a list is being typed and commits it on blur', () => {
    let current = createDefaultPersonaBehaviorConfig('discovery');
    const rerenderConfig = (next: StatefulControllerConfigV2) => {
      current = next;
      view.rerender(
        <PersonaBehaviorConfigEditor
          value={current}
          onChange={rerenderConfig}
          emotionNames={['neutral']}
          phaseNames={['discovery']}
        />,
      );
    };
    const view = render(
      <PersonaBehaviorConfigEditor
        value={current}
        onChange={rerenderConfig}
        emotionNames={['neutral']}
        phaseNames={['discovery']}
      />,
    );

    fireEvent.click(screen.getByText('Edit state tracks (1)'));
    const allowedStates = screen.getByLabelText('Allowed states') as HTMLInputElement;
    fireEvent.change(allowedStates, { target: { value: 'open,' } });
    expect(allowedStates).toHaveValue('open,');
    fireEvent.blur(allowedStates);

    expect(current.features.state_tracks.conversation.allowed_states).toEqual(['open']);
  });

  it('shows a visible validation error for invalid advanced JSON', () => {
    const config = createDefaultPersonaBehaviorConfig('discovery');
    render(
      <PersonaBehaviorConfigEditor
        value={config}
        onChange={() => undefined}
        emotionNames={['neutral']}
        phaseNames={['discovery']}
      />,
    );

    fireEvent.click(screen.getByText('Edit advanced nested records'));
    fireEvent.change(screen.getByLabelText('Offer parser'), { target: { value: '{invalid' } });

    expect(screen.getByText('Use valid JSON before saving this section.')).toBeInTheDocument();
  });
});
