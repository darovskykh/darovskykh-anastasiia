import type { PersonaUpdate, CaseAllData } from '@/types/case';
import type { Persona as MockPersona } from '@/data/mockCases';
import { apiToTrainingCase, mockPersonaToPersonaUpdate } from '@/utils/caseMapper';

export interface PersonaSaveClient {
  updatePersona: (personaId: string, persona: PersonaUpdate) => Promise<unknown>;
  getCaseAllData: (caseId: string) => Promise<CaseAllData>;
}

/**
 * Persist one persona and read back only the saved persona snapshot.
 *
 * The case readback deliberately returns the mapped persona instead of the
 * mapped case so unsaved case, prompt, or evaluation edits stay in the form.
 */
export async function savePersonaOnly(
  client: PersonaSaveClient,
  caseId: string,
  persona: MockPersona,
): Promise<MockPersona> {
  const update = mockPersonaToPersonaUpdate(persona);
  update.case_id = caseId;
  await client.updatePersona(persona.id, update);

  const refreshedCase = await client.getCaseAllData(caseId);
  const refreshedPersona = apiToTrainingCase(refreshedCase).persona;
  if (!refreshedPersona) {
    throw new Error('Persona save completed but the saved persona could not be read back.');
  }
  return refreshedPersona;
}

