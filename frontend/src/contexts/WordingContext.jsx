import React, { createContext, useContext, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { WORDING_DEFS } from "@/lib/wording";

const WordingCtx = createContext(null);

export function WordingProvider({ children }) {
  const qc = useQueryClient();

  // Overrides are fetched from an unauthenticated endpoint so the login screen
  // can use custom copy too. Failures fall back silently to built-in defaults.
  const { data: overrides = {} } = useQuery({
    queryKey: ["wording"],
    queryFn: async () => {
      try {
        return (await api.get("/settings/wording")).data || {};
      } catch {
        return {};
      }
    },
    staleTime: 5 * 60 * 1000,
  });

  const t = useCallback(
    (key) => {
      const override = overrides?.[key];
      if (typeof override === "string" && override.trim()) return override;
      return WORDING_DEFS[key]?.default ?? key;
    },
    [overrides]
  );

  const refresh = useCallback(() => qc.invalidateQueries({ queryKey: ["wording"] }), [qc]);

  return (
    <WordingCtx.Provider value={{ t, overrides, refresh }}>
      {children}
    </WordingCtx.Provider>
  );
}

export function useWording() {
  const ctx = useContext(WordingCtx);
  // Safe fallback if a component renders outside the provider (e.g. in isolation).
  if (!ctx) return { t: (k) => WORDING_DEFS[k]?.default ?? k, overrides: {}, refresh: () => {} };
  return ctx;
}
