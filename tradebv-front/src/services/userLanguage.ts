import { apiClient } from '@/services/api';
import type { Language } from '@/contexts/LanguageContext';

/**
 * Mirror the chosen language onto the user's profile.
 *
 * The language context only persists to localStorage, but the backend renders
 * the final report — goals, narrative — from `user.lang`. Without this the
 * participant picks Ukrainian and gets an English report.
 *
 * Throws on failure; callers decide what that means for them.
 */
export async function persistUserLanguage(lang: Language): Promise<void> {
  await apiClient.patch('/users/me/language', { lang });
}
