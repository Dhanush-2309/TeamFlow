import React, { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiClient, User } from "./api-client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  users: { id: string; name: string; email: string; initials: string; color: string; role: string }[];
  login: (email: string, password?: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  switchUser: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

import { MOCK_USERS_META } from "./users-meta";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const initAuth = async () => {
    try {
      setLoading(true);
      const token = apiClient.getToken();
      if (token) {
        const currentUser = await apiClient.me();
        setUser(currentUser);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Auth init failed, logging out:", err);
      apiClient.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    initAuth();
  }, []);

  const login = async (email: string, password = 'password') => {
    try {
      setLoading(true);
      const loggedIn = await apiClient.login(email, password);
      setUser(loggedIn);
      queryClient.clear();
    } catch (err) {
      apiClient.logout();
      setUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    try {
      setLoading(true);
      const loggedIn = await apiClient.register(name, email, password);
      setUser(loggedIn);
      queryClient.clear();
    } catch (err) {
      apiClient.logout();
      setUser(null);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    apiClient.logout();
    setUser(null);
    queryClient.clear();
    toast.success("Logged out successfully");
  };

  const switchUser = async (email: string) => {
    try {
      setLoading(true);
      const loggedIn = await apiClient.login(email);
      setUser(loggedIn);
      queryClient.clear();
      // Force reload page to ensure everything re-syncs
      window.location.reload();
    } catch (err) {
      console.error("Switch user failed:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, users: MOCK_USERS_META, login, register, logout, switchUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
