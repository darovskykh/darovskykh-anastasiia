/**
 * Utility functions for date and time formatting
 * Handles conversion from UTC server time to local browser time
 */

/**
 * Parse a date string ensuring it's treated as UTC
 * Server may send dates without 'Z' suffix, which causes browser to treat them as local time
 * @param date - Date string from server or Date object
 * @returns Date object
 */
function parseDate(date: string | Date): Date {
  if (date instanceof Date) return date;

  // If the string doesn't end with 'Z' and doesn't have timezone info, assume it's UTC
  // Check for timezone indicators: 'Z', '+', or '-' after position 10 (e.g., "2025-10-07T13:00:00+03:00")
  const hasTimezone = date.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(date);

  if (typeof date === 'string' && !hasTimezone) {
    // ISO format without timezone like "2025-10-07T13:00:00" - add Z to treat as UTC
    if (date.includes('T')) {
      return new Date(date + 'Z');
    }
    // Simple date format like "2025-10-07" - treat as UTC
    return new Date(date + 'T00:00:00Z');
  }

  return new Date(date);
}

/**
 * Format a date string or Date object to local date string
 * @param date - UTC date string from server or Date object
 * @param locale - Locale for formatting (default: 'uk-UA')
 * @returns Formatted date string in local timezone
 */
export function formatDate(date: string | Date, locale: string = 'uk-UA'): string {
  const dateObj = parseDate(date);

  return dateObj.toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Format a date string or Date object to local time string
 * @param date - UTC date string from server or Date object
 * @param locale - Locale for formatting (default: 'uk-UA')
 * @returns Formatted time string in local timezone
 */
export function formatTime(date: string | Date, locale: string = 'uk-UA'): string {
  const dateObj = parseDate(date);

  return dateObj.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format a date string or Date object to local date and time string
 * @param date - UTC date string from server or Date object
 * @param locale - Locale for formatting (default: 'uk-UA')
 * @returns Formatted date and time string in local timezone
 */
export function formatDateTime(date: string | Date, locale: string = 'uk-UA'): string {
  const dateObj = parseDate(date);

  return dateObj.toLocaleString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * Format a date string or Date object to short date string
 * @param date - UTC date string from server or Date object
 * @param locale - Locale for formatting (default: 'uk-UA')
 * @returns Short formatted date string in local timezone
 */
export function formatShortDate(date: string | Date, locale: string = 'uk-UA'): string {
  const dateObj = parseDate(date);

  return dateObj.toLocaleDateString(locale, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

/**
 * Format a date string or Date object to time string with seconds
 * @param date - UTC date string from server or Date object
 * @param locale - Locale for formatting (default: 'uk-UA')
 * @returns Formatted time string with seconds in local timezone
 */
export function formatTimeWithSeconds(date: string | Date, locale: string = 'uk-UA'): string {
  const dateObj = parseDate(date);

  return dateObj.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}
