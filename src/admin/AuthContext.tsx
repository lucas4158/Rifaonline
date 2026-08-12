import React, { createContext, useContext, useState, useEffect } from "react";
import { auth } from "../services/firebase";
import { onIdTokenChanged, signOut } from "firebase/auth";

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
    return isAuthenticated;
  };

  const logout = async () => {
    console.log("[AUTH_CONTEXT] Executing administrative logout sequence...");
    try {
      await signOut(auth);
    } catch (err) {
      console.error("[AUTH_CONTEXT] Error calling logout:", err);
    }
    setIsAuthenticated(false);
    navigate("/admin");
  };

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (user) {
        console.log("🟢 [AUTH_CONTEXT] Firebase Auth session verified. Access GRANTED.");
        try {
          const token = await user.getIdToken();
          localStorage.setItem("raffle_admin_token", token);
        } catch (e) {
          console.error("Failed to get Firebase ID token:", e);
        }
        setIsAuthenticated(true);
      } else {
        console.warn("🔴 [AUTH_CONTEXT] No active Firebase Auth session. Access DENIED.");
        localStorage.removeItem("raffle_admin_token");
        setIsAuthenticated(false);
      }
      setChecking(false);
    });

    return () => unsubscribe();
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
