import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiRequest } from "./api";

export type BackendUser = {
  id: string;
  firebaseUid: string;
  name: string;
  email: string;
  role: "buyer" | "student_creator" | "admin";
  profileImage: string;
  bio: string;
  college: string;
  course: string;
  location: string;
  skills: string[];
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED";
  isDemo?: boolean;
};

type AuthSession = {
  uid: string;
  email: string;
  displayName: string;
  idToken: string;
  refreshToken: string;
  expiresAt: number;
};

type FirebaseResponse = {
  localId: string;
  email: string;
  displayName?: string;
  idToken: string;
  refreshToken: string;
  expiresIn: string;
};

type AuthContextValue = {
  session: AuthSession | null;
  profile: BackendUser | null;
  loading: boolean;
  profileError: string;
  authConfigured: boolean;
  getIdToken: () => Promise<string | null>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  sendPasswordReset: (email: string) => Promise<void>;
  refreshProfile: () => Promise<BackendUser | null>;
  setCreatorRole: () => Promise<void>;
  updateProfile: (patch: Partial<BackendUser>) => Promise<BackendUser>;
};

const STORAGE_KEY = "artnest-firebase-session";
const FIREBASE_API_KEY = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
const context = createContext<AuthContextValue | null>(null);

function readSession(): AuthSession | null {
  try {
    const value = sessionStorage.getItem(STORAGE_KEY);
    if (!value) return null;
    const session = JSON.parse(value) as AuthSession;
    if (!session.idToken || !session.refreshToken || session.expiresAt <= Date.now()) return session;
    return session;
  } catch {
    return null;
  }
}

function firebaseError(payload: any) {
  const code = payload?.error?.message;
  const messages: Record<string, string> = {
    EMAIL_EXISTS: "An account with this email already exists.",
    INVALID_LOGIN_CREDENTIALS: "Email or password is incorrect.",
    INVALID_PASSWORD: "Email or password is incorrect.",
    USER_DISABLED: "This account is disabled.",
    WEAK_PASSWORD: "Choose a stronger password with at least 6 characters.",
    TOO_MANY_ATTEMPTS_TRY_LATER: "Too many attempts. Wait a little, then try again.",
    INVALID_EMAIL: "Enter a valid email address.",
    USER_NOT_FOUND: "No account was found for this email.",
  };
  return messages[code] || "Firebase Authentication could not complete the request.";
}

async function firebaseRequest(action: string, payload: Record<string, unknown>) {
  if (!FIREBASE_API_KEY) {
    throw new Error("Firebase sign-in is not configured. Add the VITE_FIREBASE_API_KEY client setting.");
  }
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${action}?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...payload, returnSecureToken: true }),
    },
  );
  const result = await response.json().catch(() => null);
  if (!response.ok) throw new Error(firebaseError(result));
  return result;
}

function toSession(response: FirebaseResponse): AuthSession {
  return {
    uid: response.localId,
    email: response.email,
    displayName: response.displayName || "",
    idToken: response.idToken,
    refreshToken: response.refreshToken,
    expiresAt: Date.now() + Number(response.expiresIn || 3600) * 1000,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(() => readSession());
  const [profile, setProfile] = useState<BackendUser | null>(null);
  const [loading, setLoading] = useState(Boolean(session));
  const [profileError, setProfileError] = useState("");
  const authConfigured = Boolean(FIREBASE_API_KEY);

  useEffect(() => {
    try {
      if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      setProfileError("This browser could not save the sign-in session.");
    }
  }, [session]);

  const refreshToken = useCallback(async () => {
    if (!session?.refreshToken || !FIREBASE_API_KEY) return null;
    const response = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(FIREBASE_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token: session.refreshToken,
        }),
      },
    );
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.id_token) {
      setSession(null);
      setProfile(null);
      throw new Error("Your session expired. Please sign in again.");
    }
    const next: AuthSession = {
      uid: result.user_id,
      email: result.user_email || session.email,
      displayName: session.displayName,
      idToken: result.id_token,
      refreshToken: result.refresh_token,
      expiresAt: Date.now() + Number(result.expires_in || 3600) * 1000,
    };
    setSession(next);
    return next.idToken;
  }, [session]);

  const getIdToken = useCallback(async () => {
    if (!session) return null;
    if (session.expiresAt - Date.now() < 90_000) return refreshToken();
    return session.idToken;
  }, [refreshToken, session]);

  const refreshProfile = useCallback(async () => {
    const token = await getIdToken();
    if (!token) {
      setProfile(null);
      return null;
    }
    setProfileError("");
    try {
      const result = await apiRequest<{ user: BackendUser }>("/auth/me", {}, token);
      setProfile(result.user);
      return result.user;
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Could not load your ARTNEST profile.");
      throw error;
    }
  }, [getIdToken]);

  useEffect(() => {
    let active = true;
    if (!session) {
      setProfile(null);
      setLoading(false);
      setProfileError("");
      return;
    }
    setLoading(true);
    refreshProfile()
      .catch(() => undefined)
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [refreshProfile, session?.uid]);

  useEffect(() => {
    if (!session) return;
    const wait = Math.max(10_000, session.expiresAt - Date.now() - 90_000);
    const timer = window.setTimeout(() => {
      refreshToken().catch(() => undefined);
    }, wait);
    return () => window.clearTimeout(timer);
  }, [refreshToken, session]);

  const setAuthResponse = useCallback((response: FirebaseResponse) => {
    setSession(toSession(response));
    setProfileError("");
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    const response = await firebaseRequest("signUp", {
      email: email.trim(),
      password,
      displayName: name.trim(),
    });
    setAuthResponse(response as FirebaseResponse);
  }, [setAuthResponse]);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await firebaseRequest("signInWithPassword", {
      email: email.trim(),
      password,
    });
    setAuthResponse(response as FirebaseResponse);
  }, [setAuthResponse]);

  const signOut = useCallback(() => {
    setSession(null);
    setProfile(null);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    await firebaseRequest("sendOobCode", { requestType: "PASSWORD_RESET", email: email.trim() });
  }, []);

  const setCreatorRole = useCallback(async () => {
    const token = await getIdToken();
    if (!token) throw new Error("Sign in to create a student creator profile.");
    await apiRequest("/auth/role", { method: "PATCH", body: JSON.stringify({ role: "student_creator" }) }, token);
    await refreshProfile();
  }, [getIdToken, refreshProfile]);

  const updateProfile = useCallback(
    async (patch: Partial<BackendUser>) => {
      const token = await getIdToken();
      if (!token) throw new Error("Sign in to update your profile.");
      const result = await apiRequest<{ user: BackendUser }>(
        "/auth/me",
        { method: "PATCH", body: JSON.stringify(patch) },
        token,
      );
      setProfile(result.user);
      return result.user;
    },
    [getIdToken],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      profile,
      loading,
      profileError,
      authConfigured,
      getIdToken,
      signUp,
      signIn,
      signOut,
      sendPasswordReset,
      refreshProfile,
      setCreatorRole,
      updateProfile,
    }),
    [
      authConfigured,
      getIdToken,
      loading,
      profile,
      profileError,
      refreshProfile,
      sendPasswordReset,
      session,
      setCreatorRole,
      signIn,
      signOut,
      signUp,
      updateProfile,
    ],
  );

  return <context.Provider value={value}>{children}</context.Provider>;
}

export function useAuth() {
  const value = useContext(context);
  if (!value) throw new Error("Authentication provider is not available.");
  return value;
}
