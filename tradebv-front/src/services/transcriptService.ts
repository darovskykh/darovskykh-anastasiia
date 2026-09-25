import { apiClient } from './api';

export interface TranscriptMessage {
  message_text: string;
  message_type: 'human' | 'ai' | 'system' | string;
  audio_file_url?: string | null;
  created_at?: string | null;
  turn_sequence?: number | null;
  turn_ordinal?: number | null;
}

export interface TranscriptData {
  id?: string | number;
  chat_id?: string | number;
  case_id?: string | number;
  messages: TranscriptMessage[];
  persona_snapshot?: { name?: string | null; [key: string]: unknown } | null;
  participant_name?: string | null;
}

interface ChatEnvelope {
  data?: {
    chat_history?: TranscriptMessage[];
    persona_snapshot?: { name?: string | null; [key: string]: unknown } | null;
    participant_name?: string | null;
  };
}

/** Read the durable FastAPI transcript independently from report generation. */
class TranscriptService {
  async getTranscript(chatId: string): Promise<TranscriptData> {
    const response = await apiClient.get<ChatEnvelope>(`/simulation/${chatId}`);
    const data = response.data;
    if (!Array.isArray(data?.chat_history)) {
      throw new Error('The session transcript is unavailable.');
    }
    return {
      id: chatId,
      chat_id: chatId,
      messages: data.chat_history,
      persona_snapshot: data.persona_snapshot,
      participant_name: data.participant_name,
    };
  }

  /** Download the server-rendered transcript attachment. */
  async downloadTranscript(chatId: string, format: 'txt' | 'pdf' = 'txt'): Promise<Blob> {
    return apiClient.getBlob(`/simulation/${chatId}/transcript?format=${format}`);
  }
}

export const transcriptService = new TranscriptService();
