import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";
import { createClient, processLock, type Session } from "@supabase/supabase-js";
import {
  bootstrapSchema,
  type BootstrapDTO,
} from "../../../packages/contracts/mobile";
import { createApi, ApiError } from "./api";
import { config, configured } from "./config";
import { storage } from "./secure-storage";
import { clearDrafts } from "./drafts";
import { stopSpeech } from "./voice";
import { t, type Language } from "./i18n";
export const supabase = createClient(
  config.supabase || "https://unconfigured.supabase.co",
  config.key || "unconfigured",
  {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      lock: processLock,
    },
  },
);
const api = createApi(config.api, supabase.auth);
type Context = {
  session: Session | null;
  boot: BootstrapDTO | null;
  loading: boolean;
  error: string;
  language: Language;
  setLanguage: (l: Language) => void;
  refresh: () => Promise<void>;
  api: typeof api;
  signOut: () => Promise<void>;
  text: (key: string) => string;
};
export const AppContext = createContext<Context | null>(null);
export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null),
    [boot, setBoot] = useState<BootstrapDTO | null>(null),
    [loading, setLoading] = useState(configured),
    [error, setError] = useState(configured ? "" : "configured"),
    [language, setLanguage] = useState<Language>("en");
  const identity = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    const expected = identity.current;
    setError("");
    try {
      const data = await api("/api/mobile", bootstrapSchema);
      if (data.userId !== identity.current) return;
      setBoot(data);
      setLanguage(data.language);
    } catch (e) {
      if (expected === identity.current)
        setError(e instanceof ApiError ? e.code : "network");
    } finally {
      if (expected === identity.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (!configured) return;
    let active = true,
      observedEvent = false;
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active && !observedEvent) {
          identity.current = data.session?.user.id ?? null;
          setSession(data.session);
          if (!data.session) setLoading(false);
          if (error) setError("auth");
        }
      })
      .catch(() => {
        if (active) {
          setError("auth");
          setLoading(false);
        }
      });
    const listener = supabase.auth.onAuthStateChange((_event, value) => {
      observedEvent = true;
      const next = value?.user.id ?? null;
      if (identity.current !== next) {
        setBoot(null);
        setLoading(!!next);
      }
      identity.current = next;
      setSession(value);
      if (!value) {
        setBoot(null);
        setLoading(false);
      }
    });
    const lifecycle = AppState.addEventListener("change", (state) => {
      if (state === "active") supabase.auth.startAutoRefresh();
      else {
        supabase.auth.stopAutoRefresh();
        void stopSpeech();
      }
    });
    supabase.auth.startAutoRefresh();
    return () => {
      active = false;
      listener.data.subscription.unsubscribe();
      lifecycle.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);
  useEffect(() => {
    if (session?.user.id) {
      const task = setTimeout(() => void refresh(), 0);
      return () => clearTimeout(task);
    }
  }, [session?.user.id, refresh]);
  const signOut = useCallback(async () => {
    await stopSpeech();
    if (session) await clearDrafts(session.user.id);
    const result = await supabase.auth.signOut({ scope: "local" });
    if (result.error) throw result.error;
    identity.current = null;
    setBoot(null);
    setSession(null);
  }, [session]);
  const value = useMemo(
    () => ({
      session,
      boot,
      loading,
      error,
      language,
      setLanguage,
      refresh,
      api,
      signOut,
      text: (key: string) => t(language, key),
    }),
    [session, boot, loading, error, language, refresh, signOut],
  );
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error("Missing app context");
  return value;
}
