/**
 * Memo Cloud Sync Service
 *
 * Syncs memos to Supabase for logged-in users.
 * - Save is manual (user chooses which memos to sync)
 * - Delete is automatic (deleted memos are removed from cloud)
 *
 * Supabase table required:
 * CREATE TABLE user_memos (
 *   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *   user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
 *   memo_id TEXT NOT NULL,
 *   transcription TEXT,
 *   tags TEXT[],
 *   created_at BIGINT,
 *   duration INTEGER,
 *   is_permanent BOOLEAN DEFAULT false,
 *   highlighted_words TEXT[],
 *   audio_base64 TEXT,
 *   synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   UNIQUE(user_id, memo_id)
 * );
 *
 * -- Enable RLS
 * ALTER TABLE user_memos ENABLE ROW LEVEL SECURITY;
 *
 * -- Users can only access their own memos
 * CREATE POLICY "Users can manage their own memos" ON user_memos
 *   FOR ALL USING (auth.uid() = user_id);
 */

import { supabase } from './supabase';
import { Memo } from '../types';

// Convert Blob to base64
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

// Convert base64 to Blob
const base64ToBlob = (base64: string): Blob => {
  const parts = base64.split(',');
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'audio/webm';
  const bstr = atob(parts[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
};

export interface CloudMemo {
  id: string;
  user_id: string;
  memo_id: string;
  transcription: string;
  tags: string[];
  created_at: number;
  duration: number;
  is_permanent: boolean;
  highlighted_words: string[] | null;
  audio_base64: string | null;
  synced_at: string;
}

/**
 * Save a memo to the cloud
 */
export async function saveMemoToCloud(userId: string, memo: Memo): Promise<void> {
  // Convert blob to base64 if exists (skip static files)
  let audioBase64: string | null = null;
  if (memo.blob) {
    audioBase64 = await blobToBase64(memo.blob);
  }

  const { error } = await supabase
    .from('user_memos')
    .upsert({
      user_id: userId,
      memo_id: memo.id,
      transcription: memo.transcription,
      tags: memo.tags,
      created_at: memo.createdAt,
      duration: memo.duration,
      is_permanent: memo.isPermanent,
      highlighted_words: memo.highlightedWords || null,
      audio_base64: audioBase64,
      synced_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,memo_id',
    });

  if (error) {
    console.error('Failed to save memo to cloud:', error);
    throw error;
  }
}

/**
 * Delete a memo from the cloud
 */
export async function deleteMemoFromCloud(userId: string, memoId: string): Promise<void> {
  const { error } = await supabase
    .from('user_memos')
    .delete()
    .eq('user_id', userId)
    .eq('memo_id', memoId);

  if (error) {
    console.error('Failed to delete memo from cloud:', error);
    throw error;
  }
}

/**
 * Load all memos from the cloud
 */
export async function loadMemosFromCloud(userId: string): Promise<Memo[]> {
  const { data, error } = await supabase
    .from('user_memos')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to load memos from cloud:', error);
    throw error;
  }

  if (!data) return [];

  return data.map((item: CloudMemo) => {
    // Convert base64 back to blob and create URL
    let audioUrl = '';
    let blob: Blob | undefined;

    if (item.audio_base64) {
      blob = base64ToBlob(item.audio_base64);
      audioUrl = URL.createObjectURL(blob);
    }

    return {
      id: item.memo_id,
      audioUrl,
      blob,
      transcription: item.transcription,
      tags: item.tags || [],
      createdAt: item.created_at,
      isPermanent: item.is_permanent,
      duration: item.duration,
      highlightedWords: item.highlighted_words || undefined,
    } as Memo;
  });
}

/**
 * Check if a memo exists in the cloud
 */
export async function isMemoSynced(userId: string, memoId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_memos')
    .select('memo_id')
    .eq('user_id', userId)
    .eq('memo_id', memoId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return false; // Not found
    }
    throw error;
  }

  return !!data;
}

/**
 * Get list of synced memo IDs
 */
export async function getSyncedMemoIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('user_memos')
    .select('memo_id')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to get synced memo IDs:', error);
    return new Set();
  }

  return new Set(data?.map(item => item.memo_id) || []);
}
