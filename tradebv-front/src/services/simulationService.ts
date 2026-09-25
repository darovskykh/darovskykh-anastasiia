import { apiClient } from './api';

interface StartSimulationResponse {
  event?: string;
  success: boolean;
  data?: {
    id: number;
    [key: string]: any;
  };
  error?: {
    message?: string;
    [key: string]: any;
  } | string;
}

class SimulationService {
  /**
   * Start a new simulation for the given case and return chat ID.
   */
  async startSimulation(caseId: string): Promise<number> {
    const response = await apiClient.post<StartSimulationResponse>(
      `/simulation/start/${caseId}`
    );

    if (!response.success || !response.data?.id) {
      const errorMessage =
        typeof response.error === 'string'
          ? response.error
          : response.error?.message;

      throw new Error(
        errorMessage || 'Failed to start simulation. Please try again.'
      );
    }

    return response.data.id;
  }
}

export const simulationService = new SimulationService();
