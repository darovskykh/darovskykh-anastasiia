/** @vitest-environment jsdom */

import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SimulationResults from './SimulationResults';

const { getResults } = vi.hoisted(() => ({ getResults: vi.fn() }));

vi.mock('@/services/api', () => ({
  apiClient: { get: getResults },
}));
vi.mock('@/services/transcriptService', () => ({
  transcriptService: {
    getTranscript: vi.fn().mockResolvedValue({ messages: [] }),
    downloadTranscript: vi.fn(),
  },
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'user' } }),
}));
const translate = (key: string) => {
  const translations: Record<string, string> = {
    'simulationResults.errorTitle': 'Loading Error',
    'simulationResults.errorGeneric': 'Failed to load simulation results',
    'simulationResults.errorNoReport': 'No report is available for this session.',
    'simulationResults.backToDashboard': 'Back to Dashboard',
  };
  return translations[key] ?? key;
};
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({ t: translate, tEn: translate }),
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));
vi.mock('react-router-dom', () => ({
  useParams: () => ({ chatId: 'chat-58' }),
  useNavigate: () => vi.fn(),
}));

describe('SimulationResults report status', () => {
  beforeEach(() => {
    getResults.mockReset();
    Object.defineProperty(window, 'scrollTo', { value: vi.fn(), writable: true });
  });

  it('renders the backend failure reason for a failed report', async () => {
    getResults.mockResolvedValue({
      data: {
        report_status: 'failed',
        report_error: 'GatewayCaseMappingError: unmapped case chain',
      },
    });

    render(<SimulationResults />);

    await waitFor(() =>
      expect(screen.getByText('GatewayCaseMappingError: unmapped case chain')).toBeInTheDocument(),
    );
  });

  it('keeps a legacy null status neutral about why the report is missing', async () => {
    getResults.mockResolvedValue({ data: { report_status: null } });

    render(<SimulationResults />);

    await waitFor(() =>
      expect(screen.getByText('No report is available for this session.')).toBeInTheDocument(),
    );
    expect(document.body).not.toHaveTextContent(/before the reporting system existed/i);
  });
});
