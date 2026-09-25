import { apiClient } from './api';
import type { Case, CaseCreate, CaseUpdate, CaseAllData, ApiEnvelope } from '@/types/case';

class CaseService {
  private readonly basePath = '/cases';

  /**
   * Get list of all cases (for current user)
   */
  async listCases(): Promise<Case[]> {
    const response = await apiClient.get<ApiEnvelope<Case[]>>(this.basePath);
    return response.data;
  }

  /**
   * Create new case (admin only)
   */
  async createCase(caseData: CaseCreate): Promise<Case> {
    const response = await apiClient.post<ApiEnvelope<Case>>(
      this.basePath,
      caseData
    );
    return response.data;
  }

  /**
   * Update case (admin only)
   */
  async updateCase(caseId: string, caseData: CaseUpdate): Promise<Case> {
    const response = await apiClient.put<ApiEnvelope<Case>>(
      `${this.basePath}/${caseId}`,
      caseData
    );
    return response.data;
  }

  /**
   * Delete case (admin only)
   */
  async deleteCase(caseId: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/${caseId}`);
  }

  /**
   * Get case with all data (case + personas)
   */
  async getCaseAllData(caseId: string): Promise<CaseAllData> {
    const response = await apiClient.get<ApiEnvelope<CaseAllData>>(
      `${this.basePath}/${caseId}/all_data`
    );
    return response.data;
  }

  /**
   * Create draft copy of a case (admin only)
   * Returns { original_id, draft_id, entity_type }
   */
  async createDraftCopy(caseId: string): Promise<{ original_id: string; draft_id: string; entity_type: string }> {
    const response = await apiClient.post<ApiEnvelope<{ original_id: string; draft_id: string; entity_type: string }>>(
      `${this.basePath}/${caseId}/create_draft_copy`
    );
    return response.data;
  }

  /**
   * Apply draft changes to original case (admin only)
   */
  async applyDraftChanges(draftCaseId: string): Promise<{ message: string; original_case_id: string }> {
    const response = await apiClient.post<ApiEnvelope<{ message: string; original_case_id: string }>>(
      `${this.basePath}/${draftCaseId}/apply_draft`
    );
    return response.data;
  }
}

export const caseService = new CaseService();
