import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from './api';
import { transcriptService } from './transcriptService';

vi.mock('./api', () => ({
  apiClient: {
    get: vi.fn(),
    getBlob: vi.fn(),
  },
}));

describe('transcriptService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads only the saved chat_history from the session endpoint', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        chat_history: [{ message_type: 'ai', message_text: 'Hello' }],
        persona_snapshot: { name: 'Adrian' },
        participant_name: 'Evaluating user',
      },
    });

    await expect(transcriptService.getTranscript('chat-1')).resolves.toMatchObject({
      messages: [{ message_text: 'Hello' }],
      persona_snapshot: { name: 'Adrian' },
      participant_name: 'Evaluating user',
    });
    expect(apiClient.get).toHaveBeenCalledWith('/simulation/chat-1');
  });

  it('surfaces a missing chat_history payload instead of showing an empty transcript', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: {} });

    await expect(transcriptService.getTranscript('chat-1')).rejects.toThrow('transcript is unavailable');
  });

  it('requests the authenticated server export format', async () => {
    const blob = new Blob(['hello'], { type: 'text/plain' });
    vi.mocked(apiClient.getBlob).mockResolvedValue(blob);

    await expect(transcriptService.downloadTranscript('chat-1', 'pdf')).resolves.toBe(blob);
    expect(apiClient.getBlob).toHaveBeenCalledWith('/simulation/chat-1/transcript?format=pdf');
  });
});
