import { apiClient } from './api';
import type { Persona, PersonaCreate, PersonaUpdate, PersonaAllData, ApiEnvelope } from '@/types/case';

class PersonaService {
  private readonly basePath = '/personas';

  /**
   * Get list of all personas (admin only)
   */
  async listPersonas(): Promise<Persona[]> {
    const response = await apiClient.get<ApiEnvelope<Persona[]>>(this.basePath);
    return response.data;
  }

  /**
   * Create new persona (admin only)
   */
  async createPersona(personaData: PersonaCreate): Promise<Persona> {
    const response = await apiClient.post<ApiEnvelope<Persona>>(
      this.basePath,
      personaData
    );
    return response.data;
  }

  /**
   * Update persona (admin only)
   */
  async updatePersona(personaId: string, personaData: PersonaUpdate): Promise<Persona> {
    const response = await apiClient.put<ApiEnvelope<Persona>>(
      `${this.basePath}/${personaId}`,
      personaData
    );
    return response.data;
  }

  /**
   * Delete persona (admin only)
   */
  async deletePersona(personaId: string): Promise<void> {
    await apiClient.delete(`${this.basePath}/${personaId}`);
  }

  /**
   * Get persona with all data (persona + case)
   */
  async getPersonaAllData(personaId: string): Promise<PersonaAllData> {
    const response = await apiClient.get<ApiEnvelope<PersonaAllData>>(
      `${this.basePath}/${personaId}/all_data`
    );
    return response.data;
  }
}

export const personaService = new PersonaService();
