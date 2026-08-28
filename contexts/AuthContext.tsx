"use client";

// ============================================================
// ACADIA — CONTEXTE D'AUTHENTIFICATION (P13)
//
// Couche cliente au-dessus des routes /api/auth/*. Ne stocke aucun
// mot de passe ni jeton côté client (le cookie de session est
// HttpOnly, invisible au JavaScript). Ce contexte expose uniquement
// l'utilisateur public courant et les actions login/register/logout.
// ============================================================

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { PublicUser } from "@/lib/auth/AuthTypes";

interface AuthContextValue {
  user: PublicUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  register: (input: {
    email: string;
    password: string;
    firstName: string;
    lastName?: string;
    domain?: string;
    role?: "student" | "supervisor";
    profile?: Record<string, string | undefined>;
  }) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PublicUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Synchronisation avec la session serveur au montage (requête réseau
    // asynchrone, pas un recalcul synchrone à partir de props/état) — même
    // justification que l'hydratation localStorage de ResearchContext.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      let data: { user?: PublicUser; error?: string } = {};
      try {
        data = await res.json();
      } catch {
        return { ok: false as const, error: "Réponse du serveur invalide. Réessayez." };
      }
      if (!res.ok) return { ok: false as const, error: data.error ?? "Connexion impossible." };
      setUser(data.user ?? null);
      return { ok: true as const };
    } catch {
      return { ok: false as const, error: "Impossible de contacter le serveur. Vérifiez votre connexion et réessayez." };
    }
  }, []);

  const register = useCallback(
    async (input: {
      email: string;
      password: string;
      firstName: string;
      lastName?: string;
      domain?: string;
      role?: "student" | "supervisor";
      profile?: Record<string, string | undefined>;
    }) => {
      try {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        let data: { user?: PublicUser; error?: string } = {};
        try {
          data = await res.json();
        } catch {
          return { ok: false as const, error: "Réponse du serveur invalide. Réessayez." };
        }
        if (!res.ok) return { ok: false as const, error: data.error ?? "Inscription impossible." };
        setUser(data.user ?? null);
        return { ok: true as const };
      } catch {
        return { ok: false as const, error: "Impossible de contacter le serveur. Vérifiez votre connexion et réessayez." };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, isLoading, login, register, logout, refresh }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé à l'intérieur de AuthProvider.");
  return ctx;
}
