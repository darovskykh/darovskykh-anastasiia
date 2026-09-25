import { apiClient } from './api';
import type { User, UserCreate, UserCreateResponse, UserUpdate, UserLimitsUpdate, UserSessionRecording, SimulationHistoryItem, PendingReportItem, RecentActivityItem, DashboardStats, AdminDashboardData, ApiEnvelope } from '@/types/user';

class UserService {
  private readonly basePath = '/users';

  /**
   * Get list of all users (admin only)
   */
  async listUsers(): Promise<User[]> {
    const response = await apiClient.get<ApiEnvelope<User[]>>(this.basePath);
    return response.data;
  }

  /**
   * Get user by ID (admin only)
   */
  async getUserById(userId: string): Promise<User> {
    const response = await apiClient.get<ApiEnvelope<User>>(`${this.basePath}/${userId}`);
    return response.data;
  }

  /**
   * Create new user (admin only)
   */
  async createUser(userData: UserCreate): Promise<UserCreateResponse> {
    const response = await apiClient.post<ApiEnvelope<UserCreateResponse>>(
      this.basePath,
      userData
    );
    return response.data;
  }

  /**
   * Update user (admin only)
   */
  async updateUser(userId: string, userData: UserUpdate): Promise<User> {
    const response = await apiClient.patch<ApiEnvelope<User>>(
      `${this.basePath}/${userId}`,
      userData
    );
    return response.data;
  }

  /**
   * Delete user (admin only)
   * Note: Cannot delete admin or superadmin users (403 Forbidden)
   */
  async deleteUser(userId: string): Promise<void> {
    await apiClient.delete<ApiEnvelope<void>>(`/admin/users/${userId}`);
  }

  /**
   * Block user (admin only)
   */
  async blockUser(userId: string): Promise<User> {
    const response = await apiClient.put<ApiEnvelope<User>>(
      `/admin/users/${userId}/block`
    );
    return response.data;
  }

  /**
   * Unblock user (admin only)
   */
  async unblockUser(userId: string): Promise<User> {
    const response = await apiClient.put<ApiEnvelope<User>>(
      `/admin/users/${userId}/unblock`
    );
    return response.data;
  }

  /**
   * Toggle user status (active <-> blocked)
   */
  async toggleUserStatus(userId: string, currentStatus: 'active' | 'blocked'): Promise<User> {
    if (currentStatus === 'active') {
      return this.blockUser(userId);
    } else {
      return this.unblockUser(userId);
    }
  }

  /**
   * Get user's session recordings (admin only)
   */
  async getUserRecordings(userId: string): Promise<UserSessionRecording[]> {
    const response = await apiClient.get<ApiEnvelope<UserSessionRecording[]>>(
      `${this.basePath}/${userId}/recordings`
    );
    return response.data;
  }

  /**
   * Get user's simulation history (admin only)
   */
  async getUserSimulationHistory(userId: string): Promise<SimulationHistoryItem[]> {
    const response = await apiClient.get<ApiEnvelope<SimulationHistoryItem[]>>(
      `${this.basePath}/${userId}/simulation-history`
    );
    return response.data;
  }

  /**
   * Get recent activity across all users (admin only)
   */
  async getRecentActivity(limit: number = 10): Promise<RecentActivityItem[]> {
    const response = await apiClient.get<ApiEnvelope<RecentActivityItem[]>>(
      `/admin/dashboard/recent-activity?limit=${limit}`
    );
    return response.data;
  }

  /**
   * Get reports awaiting admin confirmation, across all users (admin only)
   */
  async getPendingReports(limit: number = 50): Promise<PendingReportItem[]> {
    const response = await apiClient.get<ApiEnvelope<PendingReportItem[]>>(
      `/admin/dashboard/pending-reports?limit=${limit}`
    );
    return response.data;
  }

  /**
   * Get dashboard statistics (admin only)
   */
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await apiClient.get<ApiEnvelope<DashboardStats>>(
      `/admin/dashboard/stats`
    );
    return response.data;
  }

  /**
   * Get admin dashboard data (admin only)
   */
  async getAdminDashboard(): Promise<AdminDashboardData> {
    const response = await apiClient.get<ApiEnvelope<AdminDashboardData>>(
      `${this.basePath}/admin/dashboard`
    );
    return response.data;
  }

  /**
   * Assign a case to a user (admin only)
   */
  async assignCaseToUser(userId: string, caseId: string, timeLimitHours?: number): Promise<User> {
    const response = await apiClient.post<ApiEnvelope<User>>(
      `${this.basePath}/${userId}/cases/assign`,
      { case_id: caseId, time_limit_hours: timeLimitHours }
    );
    return response.data;
  }

  /**
   * Unassign a case from a user (admin only)
   */
  async unassignCaseFromUser(userId: string, caseId: string): Promise<User> {
    const response = await apiClient.post<ApiEnvelope<User>>(
      `${this.basePath}/${userId}/cases/unassign`,
      { case_id: caseId }
    );
    return response.data;
  }

  /**
   * Update user limits (admin only)
   */
  async updateUserLimits(userId: string, limits: UserLimitsUpdate): Promise<User> {
    const response = await apiClient.post<ApiEnvelope<User>>(
      `/admin/users/${userId}/limits`,
      limits
    );
    return response.data;
  }

  async changeUserPassword(userId: string, newPassword: string): Promise<void> {
    const response = await apiClient.patch(`/users/${userId}/password`, {
      password: newPassword,
    });
    return response.data;
  }
}

export const userService = new UserService();
