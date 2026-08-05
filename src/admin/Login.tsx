import React, { useState } from "react";
import { ShieldCheck, Lock, ArrowLeft, AlertCircle } from "lucide-react";
import { useAuth } from "./AuthContext";
import { localStorage } from "../utils/storage";

export default function Login() {
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const { setIsAuthenticated, navigate } = useAuth();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setErrorMsg("A senha não pode ser vazia.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);

    console.log("🍪 [COOKIE_SENT] Intending login sequence setup. Disbursing credentials with include policies...");
    console.log("[FRONTEND_API_CALL] Attempting administrator authentication...");
    try {
      const response = await fetch("/api/admin-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "login", password }),
        credentials: "include",
      });

      const rawText = await response.clone().text();
      console.log("[RAW_RESPONSE_TEXT]", response.status, rawText);

      const data = await response.json();
      console.log("[DEBUG_LOGIN_RESPONSE]", response.status, JSON.stringify(data));

      if (!response.ok) {
        throw new Error(data.error || "Senha inválida.");
      }

      console.log("🟢 [SESSION_COOKIE_RECEIVED] Auth context validated. Session cookie parsed and registered successfully in secure browser environment.");
      console.log("[ADMIN_LOGIN_SUCCESS] Admin successfully authenticated remotely and session cookie registered.");
      
      if (data.token) {
        localStorage.setItem("admin_token", data.token);
      }
      setIsAuthenticated(true);
      navigate("/dashboard");
    } catch (err: any) {
      console.error("[ADMIN_LOGIN_ERROR] Admin login request failed:", err);
      setErrorMsg(err.message || "Erro de conexão com o servidor.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToPublic = () => {
    navigate("/");
  };

  return (
    <div
      id="admin-login-screen-wrapper"
      className="min-h-screen bg-black text-white flex flex-col justify-center items-center p-4 relative overflow-hidden"
    >
      {/* Background ambient radial glow matching the premium design language */}
      <div 
        id="login-bg-glow" 
        className="absolute w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[120px] pointer-events-none -top-40 -left-40" 
      />
      <div 
        id="login-bg-glow-right" 
        className="absolute w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none -bottom-40 -right-40" 
      />

      <div
        id="admin-login-card-container"
        className="w-full max-w-md bg-zinc-950 border border-zinc-900 rounded-[2.5rem] p-8 sm:p-10 shadow-[0_0_80px_rgba(0,0,0,0.8)] relative z-10 transition-all duration-300"
      >
        <button
          id="btn-back-to-landing"
          onClick={handleBackToPublic}
          className="group inline-flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-black uppercase tracking-wider mb-8 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar ao Início
        </button>

        <div id="login-header" className="text-center mb-8">
          <div
            id="login-icon-box"
            className="bg-zinc-900 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-zinc-800 shadow-[0_4px_20px_rgba(0,0,0,0.3)]"
          >
            <ShieldCheck className="w-10 h-10 text-violet-400" />
          </div>
          <h2
            id="login-title"
            className="text-3xl font-black mb-2 uppercase tracking-tight bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent"
          >
            Acesso Restrito
          </h2>
          <p id="login-subtitle" className="text-zinc-500 text-xs sm:text-sm font-medium tracking-wide">
            Digite a senha administrativa para gerenciar o sistema.
          </p>
        </div>

        {errorMsg && (
          <div
            id="login-error-banner"
            className="mb-6 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-semibold flex items-start gap-2.5 animate-shake"
          >
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form id="admin-login-form" onSubmit={handleLoginSubmit} className="space-y-6">
          <div id="login-input-wrapper" className="relative">
            <input
              id="admin-password-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••"
              disabled={isLoading}
              className="w-full bg-zinc-900/60 border border-zinc-800 focus:border-violet-500/80 focus:ring-4 focus:ring-violet-500/10 rounded-2xl px-6 py-4.5 text-center text-3xl tracking-[1em] outline-none transition-all font-mono text-white placeholder-zinc-800 disabled:opacity-50"
              autoFocus
            />
          </div>

          <button
            id="btn-admin-login-submit"
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:brightness-110 active:scale-[0.98] text-white font-black py-4.5 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-violet-600/10 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin" />
                ENTRANDO...
              </>
            ) : (
              <>
                <Lock className="w-3.5 h-3.5" />
                ENTRAR NO PAINEL SECURITY
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
