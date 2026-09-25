import { apiClient } from './api';
import type { ApiEnvelope } from '@/types/case';
import type { BasePromptConfig, PersonaStructure } from '@/types/personaStructure';

class PersonaStructureService {
  async getPersonaStructure(personaId: string): Promise<PersonaStructure> {
    const response = await apiClient.get<ApiEnvelope<PersonaStructure>>(`/personas/${personaId}/structure`);
    return response.data;
  }

  async savePersonaStructure(personaId: string, structure: PersonaStructure): Promise<PersonaStructure> {
    const response = await apiClient.put<ApiEnvelope<PersonaStructure>>(`/personas/${personaId}/structure`, structure);
    return response.data;
  }

  async getBasePrompt(): Promise<BasePromptConfig> {
    const response = await apiClient.get<ApiEnvelope<BasePromptConfig>>('/base-prompt');
    return response.data;
  }

  async saveBasePrompt(config: BasePromptConfig): Promise<BasePromptConfig> {
    const response = await apiClient.put<ApiEnvelope<BasePromptConfig>>('/base-prompt', config);
    return response.data;
  }
}

export const personaStructureService = new PersonaStructureService();
