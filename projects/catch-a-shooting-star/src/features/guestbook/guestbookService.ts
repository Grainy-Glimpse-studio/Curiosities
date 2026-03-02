import type { GuestMessage } from './types';

const DEFAULT_API_URL = '/api/messages';

/**
 * Fetch a random message from the guestbook
 */
export async function fetchRandomMessage(apiUrl: string = DEFAULT_API_URL): Promise<GuestMessage | null> {
  try {
    const response = await fetch(apiUrl);
    if (!response.ok) return null;

    const data = await response.json();
    if (!data.message) return null;

    // Parse if it's a string (from Redis)
    return typeof data.message === 'string' ? JSON.parse(data.message) : data.message;
  } catch (error) {
    console.error('Error fetching message:', error);
    return null;
  }
}

/**
 * Get fuzzy location from timezone
 */
export function getFuzzyLocation(): string {
  try {
    // Use timezone as a privacy-friendly location indicator
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Extract just the city/region part (e.g., "America/New_York" -> "New York")
    const parts = timezone.split('/');
    const location = parts[parts.length - 1].replace(/_/g, ' ');
    return location;
  } catch {
    return '';
  }
}

/**
 * Submit a new message to the guestbook
 */
export async function submitMessage(
  content: string,
  apiUrl: string = DEFAULT_API_URL,
  includeLocation: boolean = true
): Promise<boolean> {
  try {
    const body: { content: string; location?: string } = { content };

    if (includeLocation) {
      const location = getFuzzyLocation();
      if (location) {
        body.location = location;
      }
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const data = await response.json();
      console.error('Submit error:', data.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error submitting message:', error);
    return false;
  }
}
