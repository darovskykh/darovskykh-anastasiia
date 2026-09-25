/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { createDefaultPersonaBehaviorConfig } from '@/types/personaBehavior';
import { caseService } from '@/services/caseService';
import { evaluationPromptService } from '@/services/evaluationPromptService';
import { personaService } from '@/services/personaService';
import { savePersonaOnly } from '@/utils/personaSave';
import type { CaseAllData } from '@/types/case';
import type { Persona as MockPersona } from '@/data/mockCases';
import CaseEditor from './CaseEditor';

vi.mock('@/utils/personaSave', () => ({
  savePersonaOnly: vi.fn(),
}));

const apiCaseAllData: CaseAllData = {
  case: {
    id: 'case-1',
    title: 'Saved case',
    prompt: 'Prompt',
    intro_text: 'Intro',
    evaluation_prompt_id: null,
    evaluation_prompt_model_name: 'gpt-4o-mini',
    final_evaluation_prompt_id: null,
    final_evaluation_prompt_model_name: 'gpt-4o-mini',
    is_draft: false,
    original_case_id: null,
    evaluation_categories: [],
    final_summary_rule: null,
    created_at: '2026-01-01T00:00:00Z',
    scenario_behavior_rules_coarse: null,
    scenario_behavior_rules_full: null,
    llm_1_model_name: 'gpt-4o-mini',
    llm_2_model_name: 'gpt-4o-mini',
  },
  persona: {
    id: 'persona-1',
    case_id: 'case-1',
    name: 'Adrian',
    role: 'Commercial lead',
    voice: 'openai_alloy',
    avatar_base_url: null,
    is_draft: false,
    persona_description: 'Commercial counterpart',
    goal_description: 'Find a workable agreement.',
    emotions: [],
    actions: {},
    reactions: [],
    scenarios: [],
    created_at: '2026-01-01T00:00:00Z',
    style_and_language: 'Keep the tone direct.',
    behavior_constraints: 'Never invent a commitment.',
    internal_reasoning: 'Check the offer ledger.',
    voice_enabled: false,
    behavior_mode: 'stateful_controller',
    behavior_config: createDefaultPersonaBehaviorConfig('default'),
  },
};

const savedPersona: MockPersona = {
  id: 'persona-1',
  name: 'Adrian',
  description: 'Commercial counterpart',
  emotions: [],
  actions: [],
  reactions: [],
  voice_enabled: false,
  behavior_mode: 'stateful_controller',
  behavior_config: createDefaultPersonaBehaviorConfig('default'),
};

describe('CaseEditor persona-only save', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(savePersonaOnly).mockResolvedValue(savedPersona);
    vi.spyOn(caseService, 'getCaseAllData').mockResolvedValue(apiCaseAllData);
    vi.spyOn(personaService, 'listPersonas').mockResolvedValue([]);
    vi.spyOn(personaService, 'updatePersona').mockResolvedValue(apiCaseAllData.persona);
    vi.spyOn(evaluationPromptService, 'listEvaluationPrompts').mockResolvedValue([]);
    vi.spyOn(evaluationPromptService, 'getFinalEvaluationPrompts').mockResolvedValue([]);
  });

  it('routes the persona button through the persona-only save utility', async () => {
    render(
      <LanguageProvider>
        <MemoryRouter initialEntries={['/admin-dashboard/case-management/edit/case-1']}>
          <Routes>
            <Route path="/admin-dashboard/case-management/edit/:caseId" element={<CaseEditor />} />
          </Routes>
        </MemoryRouter>
      </LanguageProvider>,
    );

    await waitFor(() => expect(screen.getByRole('tab', { name: /persona/i })).toBeInTheDocument());
    const personaTab = screen.getByRole('tab', { name: /persona/i });
    fireEvent.mouseDown(personaTab, { button: 0, ctrlKey: false });
    await waitFor(() => expect(personaTab).toHaveAttribute('aria-selected', 'true'));

    const saveButton = await screen.findByRole('button', { name: /save persona only/i });
    await waitFor(() => expect(saveButton).toBeEnabled());
    fireEvent.click(saveButton);

    await waitFor(() => expect(savePersonaOnly).toHaveBeenCalledTimes(1));
    expect(savePersonaOnly).toHaveBeenCalledWith(
      expect.objectContaining({
        updatePersona: expect.any(Function),
        getCaseAllData: expect.any(Function),
      }),
      'case-1',
      expect.objectContaining({ id: 'persona-1', name: 'Adrian' }),
    );
    expect(personaService.updatePersona).not.toHaveBeenCalled();
  });
});
