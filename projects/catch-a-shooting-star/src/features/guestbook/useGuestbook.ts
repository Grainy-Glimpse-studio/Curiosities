import { useState, useCallback, useRef, useEffect } from 'react';
import type { ContentItem } from '../../types';
import { submitMessage, fetchRandomMessage } from './guestbookService';

// LocalStorage key for daily message tracking
const STORAGE_KEY = 'guestbook_daily';

// Get today's date string
const getTodayKey = () => new Date().toISOString().split('T')[0];

// Get today's message count from localStorage
const getTodayMessageCount = (): number => {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return data[getTodayKey()] || 0;
  } catch {
    return 0;
  }
};

// Increment today's message count
const incrementTodayMessageCount = () => {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const today = getTodayKey();
    data[today] = (data[today] || 0) + 1;
    // Clean up old entries (keep only today)
    const cleaned = { [today]: data[today] };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
  } catch {
    // Ignore storage errors
  }
};

export interface UseGuestbookOptions {
  apiUrl?: string;
  placeholder?: string;
  maxDailyMessages?: number;
  // When to show first input (random between min and max catches)
  firstInputRange?: [number, number];
  // Range for subsequent inputs
  nextInputRange?: [number, number];
}

export function useGuestbook(options: UseGuestbookOptions = {}) {
  const {
    apiUrl = '/api/messages',
    placeholder = 'write something...',
    maxDailyMessages = 3,
    firstInputRange = [3, 7],
    nextInputRange = [5, 15],
  } = options;

  const [catchCount, setCatchCount] = useState(0);
  const [todayMessageCount, setTodayMessageCount] = useState(getTodayMessageCount);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cachedMessages, setCachedMessages] = useState<Array<{ id: string; content: string }>>([]);

  // Pre-fetch messages from API on mount
  useEffect(() => {
    const fetchMessages = async () => {
      const messages: Array<{ id: string; content: string }> = [];
      for (let i = 0; i < 5; i++) {
        const msg = await fetchRandomMessage(apiUrl);
        if (msg && !messages.some(m => m.id === msg.id)) {
          messages.push({ id: msg.id, content: msg.content });
        }
      }
      if (messages.length > 0) {
        setCachedMessages(messages);
      }
    };
    fetchMessages();
  }, [apiUrl]);

  // Calculate first input appearance
  const nextInputAtRef = useRef(
    firstInputRange[0] + Math.floor(Math.random() * (firstInputRange[1] - firstInputRange[0] + 1))
  );
  const inputShownCountRef = useRef(0);

  const canShowInput = todayMessageCount < maxDailyMessages;

  // Called before each catch - return input item, guestbook message, or null
  const onBeforeCatch = useCallback((): ContentItem | null => {
    const newCatchCount = catchCount + 1;
    setCatchCount(newCatchCount);

    // Check if we should show input (for user to leave a message)
    if (canShowInput && newCatchCount >= nextInputAtRef.current) {
      // Schedule next input
      const range = inputShownCountRef.current === 0 ? firstInputRange : nextInputRange;
      const nextInterval = range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
      nextInputAtRef.current = newCatchCount + nextInterval;
      inputShownCountRef.current += 1;

      // Return input item
      return {
        id: `input-${Date.now()}`,
        type: 'input',
        placeholder,
      };
    }

    // 30% chance to show a guestbook message (if we have cached messages)
    if (cachedMessages.length > 0 && Math.random() < 0.3) {
      const randomIndex = Math.floor(Math.random() * cachedMessages.length);
      const msg = cachedMessages[randomIndex];
      return {
        id: `guestbook-${msg.id}`,
        type: 'text',
        content: msg.content,
      };
    }

    // Return null to use default content from items array
    return null;
  }, [catchCount, canShowInput, placeholder, firstInputRange, nextInputRange, cachedMessages]);

  // Handle input submission
  const onInputSubmit = useCallback(async (content: string) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    try {
      const success = await submitMessage(content, apiUrl);
      if (success) {
        incrementTodayMessageCount();
        setTodayMessageCount(prev => prev + 1);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [apiUrl, isSubmitting]);

  return {
    onBeforeCatch,
    onInputSubmit,
    catchCount,
    todayMessageCount,
    remainingMessages: maxDailyMessages - todayMessageCount,
    isSubmitting,
  };
}

export default useGuestbook;
