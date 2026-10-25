"use client";

import { readJson } from "@/lib/http-json";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { API_AVAILABLE, apiUrl } from "@/lib/api-base";

/**
 * Owner-editable store details (phone, WhatsApp, email, UPI ID, announcement).
 *
 * Source: admin settings (Postgres/JSON) + owner ki Google Sheet — server
 * `/api/settings` par merge karke deta hai. Client har 30s me, tab focus par
 * turant refresh karta hai — sheet me badla number site par bina reload dikhta hai.
 *
 * API na ho (GitHub Pages static preview) to niche wale defaults dikhte hain —
 * layout tootta nahi, koi error toast nahi.
 */
export type PublicSettings = {
  announcement: string;
  upiId: string;
  upiName: string;
  supportPhone: string;
  /** @deprecated site par kahin dikhta nahi (owner rule) — sirf internal record */
  supportEmail?: string;
  whatsapp: string;
  freeShipping: boolean;
  updatedAt?: string;
};

export const DEFAULT_PUBLIC_SETTINGS: PublicSettings = {
  announcement: "",
  upiId: "dhakadgourav@fam",
  upiName: "Designer Clothing",
  supportPhone: "8005900581",
  whatsapp: "8005900581",
  freeShipping: true,
};

type ContextValue = {
  settings: PublicSettings;
  refresh: () => Promise<void>;
  /** pehli fetch ho chuki (defaults vs live farq batane ke liye) */
  ready: boolean;
};

const StoreSettingsContext = createContext<ContextValue>({
  settings: DEFAULT_PUBLIC_SETTINGS,
  refresh: async () => undefined,
  ready: false,
});

export function StoreSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (!API_AVAILABLE) {
      setReady(true);
      return;
    }
    try {
      const response = await fetch(apiUrl("/api/settings"), { cache: "no-store" });
      if (!response.ok) return;
      const parsed = await readJson<{ data?: Partial<PublicSettings> }>(response);
      const data = parsed.data?.data;
      if (!data) return;
      setSettings((current) => ({
        ...current,
        ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== "")),
      }) as PublicSettings);
    } catch {
      // offline / API down — defaults hi rehne do
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (!API_AVAILABLE) return;
    // sheet change → site: tab wapas focus par turant, warna 30s me
    const onFocus = () => void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(onVisible, 30_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(timer);
    };
  }, [refresh]);

  return (
    <StoreSettingsContext.Provider value={{ settings, refresh, ready }}>{children}</StoreSettingsContext.Provider>
  );
}

export function useStoreSettings(): PublicSettings {
  return useContext(StoreSettingsContext).settings;
}

export function useStoreSettingsState(): ContextValue {
  return useContext(StoreSettingsContext);
}
