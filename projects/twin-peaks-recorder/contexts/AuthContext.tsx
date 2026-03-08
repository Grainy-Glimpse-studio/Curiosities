import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { signIn, signUp, signOut, loadApiKeys, saveApiKeys, ApiKeys } from '../services/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  apiKeys: ApiKeys | null;

  // Auth actions
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;

  // API keys actions
  saveKeys: (keys: ApiKeys) => Promise<void>;
  clearKeys: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKeys, setApiKeys] = useState<ApiKeys | null>(null);

  // 初始化：检查现有 session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);

      // 如果已登录，加载 API keys
      if (session?.user) {
        loadApiKeys(session.user.id)
          .then(keys => {
            if (keys) setApiKeys(keys);
          })
          .catch(err => console.error('Failed to load API keys:', err));
      }
    });

    // 监听认证状态变化
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (!session?.user) {
        // 登出时清除 API keys
        setApiKeys(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 登录
  const login = useCallback(async (email: string, password: string) => {
    const { user } = await signIn(email, password);
    if (user) {
      setUser(user);

      // 加载 API keys
      try {
        const keys = await loadApiKeys(user.id);
        if (keys) {
          setApiKeys(keys);
        }
      } catch (error) {
        console.error('Failed to load API keys:', error);
      }
    }
  }, []);

  // 注册
  const register = useCallback(async (email: string, password: string) => {
    const { user } = await signUp(email, password);
    if (user) {
      setUser(user);
    }
  }, []);

  // 登出
  const logout = useCallback(async () => {
    await signOut();
    setUser(null);
    setApiKeys(null);
  }, []);

  // 保存 API keys（不需要密码了）
  const saveKeys = useCallback(async (keys: ApiKeys) => {
    if (!user) {
      throw new Error('Must be logged in to save API keys');
    }

    await saveApiKeys(user.id, keys);
    setApiKeys(keys);
  }, [user]);

  // 清除本地 API keys
  const clearKeys = useCallback(() => {
    setApiKeys(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        apiKeys,
        login,
        register,
        logout,
        saveKeys,
        clearKeys,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
