import React, { useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "./AuthContext";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, checking, navigate } = useAuth();

  // Reactive synchronization check: if both checking has finished and isAuthenticated is false, redirect immediately
  useEffect(() => {
    if (!checking && !isAuthenticated) {
      console.warn("🔒 [ProtectedRoute] User is unauthorized. Reactive transition triggered back to login /admin");
      navigate("/admin");
    }
  }, [isAuthenticated, checking]);

  if (checking) {
    return (
      <div
        id="protected-route-spinner-container"
        className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4"
      >
        <div
          id="protected-spinner"
          className="w-12 h-12 rounded-full border-4 border-zinc-900 border-t-violet-500 animate-spin"
        />
        <p
          id="protected-status-msg"
          className="text-zinc-500 text-xs font-black uppercase tracking-widest mt-6 animate-pulse"
        >
          Validando sessão administrativa segura...
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div
        id="protected-route-denied-container"
        className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4 text-center"
      >
        <div id="denied-icon-box" className="p-4 bg-red-500/10 border border-red-500/20 rounded-full mb-4">
          <ShieldAlert className="w-8 h-8 text-red-500" />
        </div>
        <h3 id="denied-title" className="text-xl font-black uppercase tracking-tight text-red-400">
          Acesso Não Autorizado
        </h3>
        <p id="denied-desc" className="text-zinc-500 text-sm mt-2 max-w-sm">
          Sua sessão expirou ou você não tem as credenciais necessárias. Redirecionando...
        </p>
      </div>
    );
  }

  // Session safe, rendering admin dashboard content
  return <>{children}</>;
}
