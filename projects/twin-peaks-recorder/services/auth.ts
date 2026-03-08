import { supabase } from './supabase';

// API keys 结构（明文存储）
export interface ApiKeys {
  deepgram?: string;
  dashscope?: string;  // 千问/百炼 API key
  openai?: string;
  primarySpeechApi?: 'deepgram' | 'dashscope';  // 用户选择的主要语音 API
}

/**
 * 注册新用户
 */
export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * 登录
 */
export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * 登出
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
}

/**
 * 获取当前用户
 */
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

/**
 * 监听认证状态变化
 */
export function onAuthStateChange(callback: (user: any) => void) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(session?.user ?? null);
  });
}

/**
 * 保存用户的 API keys（直接存储，靠 RLS 保护）
 */
export async function saveApiKeys(userId: string, keys: ApiKeys): Promise<void> {
  const { error } = await supabase
    .from('user_api_keys')
    .upsert({
      user_id: userId,
      encrypted_keys: keys, // 字段名保留，但实际存的是明文
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id',
    });

  if (error) {
    throw error;
  }
}

/**
 * 获取用户的 API keys
 */
export async function loadApiKeys(userId: string): Promise<ApiKeys | null> {
  const { data, error } = await supabase
    .from('user_api_keys')
    .select('encrypted_keys')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // 没有找到记录
      return null;
    }
    throw error;
  }

  return data?.encrypted_keys || null;
}

/**
 * 删除用户的 API keys
 */
export async function deleteApiKeys(userId: string): Promise<void> {
  const { error } = await supabase
    .from('user_api_keys')
    .delete()
    .eq('user_id', userId);

  if (error) {
    throw error;
  }
}
