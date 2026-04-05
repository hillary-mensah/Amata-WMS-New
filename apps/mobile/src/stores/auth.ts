import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  organisationId: string;
  branchId?: string;
  branchName?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  pinVerified: boolean;
  setAuth: (user: User, token: string) => Promise<void>;
  setPinVerified: (verified: boolean) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  loading: true,
  pinVerified: false,

  setAuth: async (user, token) => {
    await SecureStore.setItemAsync('accessToken', token);
    await SecureStore.setItemAsync('user', JSON.stringify(user));
    set({ user, accessToken: token, isAuthenticated: true });
  },

  setPinVerified: (verified) => set({ pinVerified: verified }),

  logout: async () => {
    await SecureStore.deleteItemAsync('accessToken');
    await SecureStore.deleteItemAsync('user');
    set({ user: null, accessToken: null, isAuthenticated: false, pinVerified: false });
  },

  checkAuth: async () => {
    try {
      const token = await SecureStore.getItemAsync('accessToken');
      const userStr = await SecureStore.getItemAsync('user');
      if (token && userStr) {
        const user = JSON.parse(userStr);
        set({ user, accessToken: token, isAuthenticated: true });
      }
    } catch (error) {
      console.error('Auth check error:', error);
    } finally {
      set({ loading: false });
    }
  },
}));