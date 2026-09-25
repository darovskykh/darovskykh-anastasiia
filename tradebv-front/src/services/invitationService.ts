import { apiClient } from './api';

export interface InvitationPublic {
  id: string;
  token: string;
  user_id: string;
  case_id: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  created_at: string;
  expires_at: string;
  first_used_at?: string | null;
  use_count: number;
  link: string;
  // Plain password we just generated for this invite; surfaced once in the
  // admin dialog so the operator can confirm what was mailed.
  generated_password?: string | null;
}

export interface InvitationRedeemResult {
  token: string;
  case_id: string;
  access_token: string;
  user_id: string;
  user_email: string;
  user_first_name?: string | null;
  user_last_name?: string | null;
}

interface Envelope<T> {
  event: string;
  data: T;
}

class InvitationService {
  async assignCase(
    caseId: string,
    payload: {
      first_name: string;
      last_name: string;
      email: string;
      custom_html?: string;
      lang?: 'en' | 'uk' | 'ar' | 'es' | 'pt' | 'ru';
    }
  ): Promise<InvitationPublic> {
    const response = await apiClient.post<Envelope<InvitationPublic>>(
      `/invitations/cases/${caseId}`,
      payload
    );
    return response.data;
  }

  async redeem(token: string): Promise<InvitationRedeemResult> {
    const response = await apiClient.post<Envelope<InvitationRedeemResult>>(
      `/invitations/${token}/redeem`
    );
    return response.data;
  }
}

export const invitationService = new InvitationService();
