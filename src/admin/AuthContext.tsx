import React, { createContext, useContext, useState, useEffect } from "react";
import { localStorage } from "../utils/storage";

interface AuthContextType {
  isAuthenticated: boolean;
  setIsAuthenticated: (val: boolean) => void;
  checking: boolean;
  setChecking: (val: boolean) => void;
  checkSession: () => Promise<boolean>;
  logout: () => Promise<void>;
  navigate: (path: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);

  // Custom client-side router function to propagate SPA routing transitions
  const navigate = (path: string) => {
    console.log(`[AUTH_CONTEXT] Navigating to: ${path}`);
    window.history.pushState(null, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  const checkSession = async (): Promise<boolean> => {
    const localToken = typeof window !== "undefined" ? localStorage.getItem("admin_token") || "" : "";
    console.log("🍪 [COOKIE_SENT] Admin session check starting. Transmitting cookie and local token...");
    console.log("📡 [SESSION_FETCH_INCLUDE_CREDENTIALS] Fetching session state with credentials inclusion rule...");
    console.log("[AUTH_CONTEXT] Checking administrative session from '/api/admin-session'...");
    try {
      const activeHeaders: Record<string, string> = {};
      const trimmedToken = (localToken || "").trim();
      if (trimmedToken && /^[A-Za-z0-9\-_./+=]+$/.test(trimmedToken)) {
        activeHeaders["Authorization"] = `Bearer ${trimmedToken}`;
      }

      const response = await fetch("/api/admin-session", { 
        method: "GET", 
        cache: "no-store",
        headers: activeHeaders,
        credentials: "include"
      });
      const data = await response.json().catch(() => ({}));

      if (response.ok && data.authenticated) {
        console.log("🟢 [SESSION_COOKIE_RECEIVED] Auth context validated. Session cookie or local token parsed successfully in the client layer.");
        console.log("🟢 [ADMIN_SESSION_VALID] Admin session token parsed and validated successfully in React state structure.");
        console.log("🟢 [AUTH_CONTEXT_VALID] Administrative credentials and session verified. Access GRANTED.");
        setIsAuthenticated(true);
        return true;
      } else {
        console.warn("🔴 [ADMIN_SESSION_INVALID] Session token is invalid, expired, or missing in AuthContext verify loop.");
        console.warn("🔴 [AUTH_CONTEXT_INVALID] Invalid administrative credentials/session. Access DENIED.");
        if (typeof window !== "undefined") {
          localStorage.removeItem("admin_token");
        }
        setIsAuthenticated(false);
        return false;
      }
    } catch (err) {
      console.error("🔴 [ADMIN_SESSION_INVALID] Session verification request failed: Error checking admin session:", err);
      console.warn("🔴 [AUTH_CONTEXT_INVALID] Session check threw an error. Access DENIED.");
      setIsAuthenticated(false);
      return false;
    } finally {
      setChecking(false);
    }
  };

  const logout = async () => {
    console.log("[AUTH_CONTEXT] Executing administrative logout sequence...");
    if (typeof window !== "undefined") {
      localStorage.removeItem("admin_token");
    }
    try {
      await fetch("/api/admin-logout", { 
        method: "POST",
        credentials: "include"
      });
    } catch (err) {
      console.error("[AUTH_CONTEXT] Error calling server-side logout:", err);
    }
    setIsAuthenticated(false);
    navigate("/admin");
  };

  useEffect(() => {
    checkSession();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        setIsAuthenticated,
        checking,
        setChecking,
        checkSession,
        logout,
        navigate,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
