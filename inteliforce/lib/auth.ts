// lib/auth.ts
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

export interface UserProfile {
  id: string;
  nombre: string;
  cedula?: string;
  rama?: string;
  rol: 'vendedor' | 'merchandiser' | 'supervisor' | string;
  sales_rep_id: string;
  company_id: string;
  activo?: boolean;
}

interface AuthState {
  token: string | null;
  user: UserProfile | null;
  isHydrated: boolean;
  login: (token: string, user: UserProfile) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  user: null,
  isHydrated: false,

  login: async (token, user) => {
    await SecureStore.setItemAsync('auth_token', token);
    await SecureStore.setItemAsync('auth_user', JSON.stringify(user));
    set({ token, user, isHydrated: true });
  },

  logout: async () => {
    try {
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('auth_user');
    } catch {
      // Ignore secure store deletion errors on reset
    }
    set({ token: null, user: null, isHydrated: true });
  },

  hydrate: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const userStr = await SecureStore.getItemAsync('auth_user');
      if (token && userStr) {
        const user = JSON.parse(userStr) as UserProfile;
        set({ token, user, isHydrated: true });
        return;
      }
    } catch {
      // Fallback on read failure
    }
    set({ token: null, user: null, isHydrated: true });
  },
}));

export const getAuthToken = async (): Promise<string | null> => {
  const storeToken = useAuth.getState().token;
  if (storeToken) return storeToken;
  try {
    return await SecureStore.getItemAsync('auth_token');
  } catch {
    return null;
  }
};
