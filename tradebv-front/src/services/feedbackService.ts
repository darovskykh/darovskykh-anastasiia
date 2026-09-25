import { apiClient } from './api';
import type { Feedback, FeedbackCreate, ApiEnvelope } from '@/types/feedback';

export const feedbackService = {
  /**
   * List all feedback (admin only)
   */
  listFeedback: async (): Promise<Feedback[]> => {
    const response = await apiClient.get<ApiEnvelope<Feedback[]>>('/feedback');
    return response.data;
  },

  /**
   * Submit new feedback (authenticated users)
   */
  createFeedback: async (data: FeedbackCreate): Promise<Feedback> => {
    const response = await apiClient.post<ApiEnvelope<Feedback>>('/feedback', data);
    return response.data;
  },

  /**
   * Update feedback status and admin notes (admin only)
   */
  updateFeedback: async (
    feedbackId: string,
    status: string,
    adminNotes: string | null
  ): Promise<Feedback> => {
    const response = await apiClient.patch<ApiEnvelope<Feedback>>(
      `/feedback/${feedbackId}`,
      {
        status,
        admin_notes: adminNotes,
      }
    );
    return response.data;
  },
};
