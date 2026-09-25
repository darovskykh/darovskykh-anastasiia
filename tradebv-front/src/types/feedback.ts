export interface Feedback {
  id: string;
  user_id: string;
  user_username: string | null;
  user_email: string | null;
  user_role: string | null;
  page: string;
  has_accepted_grade: boolean;
  case_id: number | null;
  case_title: string | null;
  case_description: string | null;
  persona_id: number | null;
  chat_id: number | null;
  text: string;
  screenshot_url?: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  source?: string | null;
}

export interface FeedbackCreate {
  page: string;
  has_accepted_grade: boolean;
  case_id?: number | null;
  persona_id?: number | null;
  chat_id?: number | null;
  text: string;
  screenshot_data?: string | null;
  source?: string;
}

export interface ApiEnvelope<T> {
  event: string;
  data: T;
}
