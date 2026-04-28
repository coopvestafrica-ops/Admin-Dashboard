import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";
import { apiRequest } from "@/lib/api";

export type AdminRole = "super_admin" | "finance_admin" | "operations_admin" | "org_admin" | "staff";

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: AdminRole;
  mfaEnabled?: boolean;
  mustChangePassword?: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string, mfaCode?: string) => Promise<{ success: boolean; error?: string; requiresMfa?: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiRequest<{ user: AuthUser }>("/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false));
  }, [refreshUser]);

  const login = useCallback(async (email: string, password: string, mfaCode?: string) => {
    try {
      const data = await apiRequest<{ user?: AuthUser; requiresMfa?: boolean }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, ...(mfaCode ? { mfaCode } : {}) }),
      });
      if (data.requiresMfa) return { success: false, requiresMfa: true };
      if (data.user) {
        setUser(data.user);
        return { success: true };
      }
      return { success: false, error: "Login failed" };
    } catch (err: any) {
      return { success: false, error: err.message || "Login failed" };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } catch {}
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
