// User types matching backend schema
export interface User {
  id: string;
  username: string;
  first_name: string | null;
  last_name: string | null;
  role: 'user' | 'admin' | 'superadmin';
  status: 'active' | 'blocked';
  last_login: string | null;
  created_at: string;
  allowed_cases_ids: (number | string)[];
  case_access_expiry: Record<string, string>; // case_id -> ISO datetime string
  max_simulations: number | null;
  account_expiration_date: string | null;
  simulations_count: number;
}

export interface UserCreate {
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  password?: string | null;
  role?: 'user' | 'admin' | 'superadmin';
}

export interface UserCreateResponse {
  user: User;
  generated_plain_password: string | null;
}

export interface UserUpdate {
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  role?: 'user' | 'admin' | 'superadmin';
  status?: 'active' | 'blocked';
  lang?: string;
  allowed_cases_ids?: (number | string)[];
  max_simulations?: number | null;
  account_expiration_date?: string | null;
}

export interface UserLimitsUpdate {
  allowed_cases_ids?: (number | string)[];
  max_simulations?: number | null;
  account_expiration_date?: string | null;
}

export interface UserSessionRecording {
  chat_id: string;
  chat_name: string;
  case_id: string;
  case_title: string | null;
  recording_url: string | null;
  recording_size_bytes: number | null;
  simulation_recording_url: string | null;
  simulation_recording_size_bytes: number | null;
  recording_consent: boolean;
  created_at: string;
  has_video: boolean;
  has_audio: boolean;
  has_simulation_video: boolean;
  status: 'completed' | 'incomplete';
}

export interface SimulationHistoryItem {
  chat_id: string;
  case_id: string;
  case_title: string;
  status: 'in_progress' | 'completed' | 'incomplete';
  created_at: string;
  completed_at: string | null;
  duration_seconds: number | null;
  score: number | null;
  has_recording: boolean;
  has_report: boolean;
  report_url: string | null;
  report_status?: 'generating' | 'ready' | 'failed' | 'pending_retry' | 'retry_exhausted' | null;
  report_error?: string | null;
  evaluation_confirmed?: boolean;
}

export interface PendingReportItem {
  chat_id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  case_id: string;
  case_title: string;
  completed_at: string | null;
  created_at: string;
}

export interface RecentActivityItem {
  id: string;
  user_id: string;
  user_name: string;
  action: 'started_simulation' | 'completed_simulation' | 'uploaded_recording';
  case_id: string;
  case_title: string;
  timestamp: string;
  status: string;
}

export interface DashboardStats {
  total_users: number;
  total_users_change: string;
  active_simulations: number;
  active_simulations_change: string;
  completed_simulations: number;
  completed_simulations_change: string;
  total_chats: number;
  total_chats_change: string;
}

export interface StatBlock {
  count: number;
  percentageGrowth: string;
}

export interface LastActivityItem {
  chat_id: number;
  chat_name: string;
  user_id: string;
  user_name: string;
  created_at: string;
}

export interface AdminDashboardData {
  active_simulations: StatBlock;
  completed_simulations: StatBlock;
  all_chats: StatBlock;
  last_activity: LastActivityItem[];
}

// API Response wrapper
export interface ApiEnvelope<T> {
  event: string;
  data: T;
}
