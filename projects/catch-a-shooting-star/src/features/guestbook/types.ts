export interface GuestMessage {
  id: string;
  content: string;
  createdAt: number;
  location?: string; // Fuzzy location (timezone-based)
}

export interface GuestbookConfig {
  // API endpoint for saving/fetching messages
  apiUrl: string;
  // Max messages to keep (older ones get deleted)
  maxMessages?: number;
  // Whether to show the input form
  allowSubmit?: boolean;
}
