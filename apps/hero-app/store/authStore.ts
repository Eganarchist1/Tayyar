import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import type { StateStorage } from "zustand/middleware";
import { createJSONStorage, persist } from "zustand/middleware";

type AuthUser = {
  name?: string | null;
  email?: string | null;
  role?: string | null;
  phone?: string | null;
};

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  hasHydrated: boolean;
  setAuth: (token: string, refreshToken: string | null, user: AuthUser) => void;
  logout: () => void;
}

const noopStorage: StateStorage = {
  getItem: async () => null,
  setItem: async () => undefined,
  removeItem: async () => undefined,
};

function getAuthStorage(): StateStorage {
  if (typeof window === "undefined") {
    return noopStorage;
  }

  return AsyncStorage as unknown as StateStorage;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      refreshToken: null,
      user: null,
      hasHydrated: false,
      setAuth: (token, refreshToken, user) => set({ token, refreshToken, user }),
      logout: () => set({ token: null, refreshToken: null, user: null }),
    }),
    {
      name: "tayyar-hero-auth",
      storage: createJSONStorage(getAuthStorage),
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hasHydrated: true });
      },
    },
  ),
);
