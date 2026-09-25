import { apiClient } from './api';
import type {
  EvaluationPrompt,
  EvaluationPromptCreate,
  EvaluationPromptUpdate,
  EvaluationPromptAllData,
  FinalEvaluationPrompt,
  FinalEvaluationPromptCreate,
  ApiEnvelope
} from '@/types/evaluation';

class EvaluationPromptService {
  private readonly basePath = '/evaluation_prompt';

  /**
   * Get list of all evaluation prompts (admin only)
   */
  async listEvaluationPrompts(): Promise<EvaluationPrompt[]> {
    const response = await apiClient.get<ApiEnvelope<EvaluationPrompt[]>>(this.basePath);
    return response.data;
  }

  /**
   * Create new evaluation prompt (admin only)
   */
  async createEvaluationPrompt(promptData: EvaluationPromptCreate): Promise<EvaluationPrompt> {
    const response = await apiClient.post<ApiEnvelope<EvaluationPrompt>>(
      this.basePath,
      promptData
    );
    return response.data;
  }

  /**
   * Update evaluation prompt (admin only)
   */
  async updateEvaluationPrompt(promptId: string, promptData: EvaluationPromptUpdate): Promise<EvaluationPrompt> {
    const response = await apiClient.put<ApiEnvelope<EvaluationPrompt>>(
      `${this.basePath}/${promptId}`,
      promptData
    );
    return response.data;
  }

  /**
   * Delete evaluation prompt (admin only)
   */
  async deleteEvaluationPrompt(promptId: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/${promptId}`);
  }

  /**
   * Get evaluation prompt with all data (prompt + cases using it)
   */
  async getEvaluationPromptAllData(promptId: string): Promise<EvaluationPromptAllData> {
    console.log('getEvaluationPromptAllData called with promptId:', promptId, 'URL:', `${this.basePath}/${promptId}`);
    const response = await apiClient.get<ApiEnvelope<EvaluationPrompt>>(
      `${this.basePath}/${promptId}`
    );
    // Wrap in the expected format since backend doesn't return cases_using_prompt
    return {
      prompt: response.data,
      cases_using_prompt: []
    };
  }

  /**
   * Get all final evaluation prompts
   */
  async getFinalEvaluationPrompts(): Promise<FinalEvaluationPrompt[]> {
    const response = await apiClient.get<ApiEnvelope<FinalEvaluationPrompt[]>>(
      '/final_evaluation_prompt'
    );
    return response.data;
  }

  /**
   * Get specific final evaluation prompt
   */
  async getFinalEvaluationPrompt(promptId: string): Promise<FinalEvaluationPrompt> {
    const response = await apiClient.get<ApiEnvelope<FinalEvaluationPrompt>>(
      `/final_evaluation_prompt/${promptId}`
    );
    return response.data;
  }

  /**
   * Create new final evaluation prompt
   */
  async createFinalEvaluationPrompt(promptData: FinalEvaluationPromptCreate): Promise<FinalEvaluationPrompt> {
    const response = await apiClient.post<ApiEnvelope<FinalEvaluationPrompt>>(
      '/final_evaluation_prompt',
      promptData
    );
    return response.data;
  }

  /**
   * Update final evaluation prompt
   */
  async updateFinalEvaluationPrompt(promptId: string, promptData: FinalEvaluationPromptCreate): Promise<FinalEvaluationPrompt> {
    const response = await apiClient.put<ApiEnvelope<FinalEvaluationPrompt>>(
      `/final_evaluation_prompt/${promptId}`,
      promptData
    );
    return response.data;
  }

  /**
   * Delete final evaluation prompt
   */
  async deleteFinalEvaluationPrompt(promptId: string): Promise<void> {
    await apiClient.delete(`/final_evaluation_prompt/${promptId}`);
  }
}

export const evaluationPromptService = new EvaluationPromptService();
