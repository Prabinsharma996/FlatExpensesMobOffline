import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "../types";
import { offlineDb } from "../offline/OfflineDatabase";

type AuthContextValue = {
  user: User | null;
  profiles: User[];
  loading: boolean;
  createProfile: (name: string, avatar: string) => Promise<void>;
  updateProfile: (name: string, avatar?: string) => Promise<void>;
  switchProfile: (userId: number) => Promise<void>;
  refreshProfiles: () => Promise<void>;
  logout: () => Promise<void>;
  login: (name: string, avatar?: string) => Promise<void>;
  register: (name: string, avatar?: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profiles, setProfiles] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshProfiles = async () => {
    try {
      const all = await offlineDb.listProfiles();
      setProfiles(all);
    } catch (err) {
      console.error("Failed to load profiles:", err);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const currentUser = await offlineDb.getCurrentUser();
        setUser(currentUser);
        await refreshProfiles();
      } catch (err) {
        console.error("Failed to load user profile:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function createProfile(name: string, avatar: string = "🦁") {
    const u = await offlineDb.createProfile(name, avatar);
    setUser(u);
    await refreshProfiles();
  }

  async function updateProfile(name: string, avatar?: string) {
    if (!user) return;
    const updated = await offlineDb.updateUserProfile(name, avatar);
    setUser(updated);
    await refreshProfiles();
  }

  async function switchProfile(userId: number) {
    const u = await offlineDb.switchProfile(userId);
    setUser(u);
  }

  async function login(name: string, avatar: string = "🦁") {
    await createProfile(name, avatar);
  }

  async function register(name: string, avatar: string = "🦁") {
    await createProfile(name, avatar);
  }

  async function logout() {
    await offlineDb.logout();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profiles,
        loading,
        createProfile,
        updateProfile,
        switchProfile,
        refreshProfiles,
        logout,
        login,
        register,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
