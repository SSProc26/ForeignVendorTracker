import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, formatApiError } from "@/lib/api";
import { TOKEN_KEY } from "@/lib/constants";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);         // null = unknown/loading, false = logged out
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setUser(false);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { bootstrap(); }, [bootstrap]);

  async function login(user_id, passcode) {
    try {
      const { data } = await api.post("/auth/login", { user_id, passcode });
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      return { ok: true, user: data.user };
    } catch (e) {
      return { ok: false, error: formatApiError(e.response?.data?.detail) || e.message };
    }
  }

  async function logout() {
    try { await api.post("/auth/logout"); } catch { /* ignore */ }
    localStorage.removeItem(TOKEN_KEY);
    setUser(false);
  }

  function refreshUser(next) { setUser(next); }

  return (
    <AuthCtx.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
