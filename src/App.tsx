// Comentário: Componente principal da aplicação
import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  useRef,
  type FormEvent,
} from "react";
import {
  Smartphone,
  CheckCircle2,
  Clock,
  Users,
  Search,
  Filter,
  Copy,
  User,
  MessageCircle,
  ShieldCheck,
  TrendingUp,
  X,
  CreditCard,
  QrCode,
  Trophy,
  Star,
  PartyPopper,
  Trash2,
  RefreshCw,
  Unlock,
  AlertTriangle,
  Zap,
  ShieldAlert,
  Compass,
  Menu,
  Tent,
  Flame,
  Anchor,
  Waves,
  Award,
  Sparkles,
  Calendar,
  ArrowRight,
  ArrowLeft,
  Ticket,
  Play,
  ChevronLeft,
  ChevronRight,
  Share2,
  ExternalLink,
  Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { doc, collection, setDoc, updateDoc, deleteDoc, getDocs, getDoc, writeBatch, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import { signInAnonymously } from "firebase/auth";

import { db, auth } from "./services/firebase";
import { OperationType, Status, NumberItem, RaffleConfig } from "./types";
import { localStorage } from "./utils/storage";
import { promiseWithTimeout, compressImage, handleFirestoreError, safeCopyToClipboard, updateAppMetadata } from "./utils/helpers";
import { performRobustImageUpload } from "./services/uploadService";
import { adminService } from "./services/adminService";
import { pixService } from "./services/pixService";
import { realtimeService } from "./realtime/realtimeService";
import { storeService } from "./services/storeService";
import { slugify } from "./utils/slug";
import { NumberCell } from "./components/NumberCell";
import React from "react";
import { AuthProvider, useAuth } from "./admin/AuthContext";
import { RaffleConfigProvider, useRaffleConfig } from "./admin/RaffleConfigContext";

import MinhasCotas from "./components/MinhasCotas";
import WinnerHistory from "./components/WinnerHistory";
import { PreLaunchCard } from "./components/PreLaunchCard";

function lazyWithRetry<T extends React.ComponentType<any>>(
  componentImport: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    try {
      return await componentImport();
    } catch (error: any) {
      console.error("[DYNAMIC_IMPORT_FAILURE] Failed to load dynamically imported module:", error);
      console.warn("[MODULE_LOAD_ERROR] Encountered chunk/module import failure. Forcing page refresh for cache-busting.");
      
      const lastReload = typeof window !== "undefined" ? window.localStorage.getItem("last-dynamic-reload") : null;
      const now = Date.now();
      
      if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
        if (typeof window !== "undefined") {
          window.localStorage.setItem("last-dynamic-reload", String(now));
          window.location.reload();
        }
      }
      throw error;
    }
  });
}

const StorePage = lazyWithRetry(() =>
  import("./components/StorePage").then((m) => ({ default: m.StorePage }))
);

const Login = lazyWithRetry(() => import("./admin/Login"));
const Dashboard = lazyWithRetry(() => import("./admin/Dashboard"));
const ProtectedRoute = lazyWithRetry(() => import("./admin/ProtectedRoute"));
const RaffleAuditView = lazyWithRetry(() => import("./components/RaffleAuditView"));

function RifaOnlineApp() {
  const [currentPath, setCurrentPath] = useState(
    typeof window !== "undefined" ? window.location.pathname : "/"
  );
  const { isAuthenticated, checking, navigate } = useAuth();

  // Protect against global unhandled dynamic chunk loading errors
  useEffect(() => {
    const handleError = (e: ErrorEvent) => {
      const isChunkError = 
        /Loading chunk/i.test(e.message || "") || 
        /Failed to fetch dynamically imported module/i.test(e.message || "") ||
        /error loading dynamically imported module/i.test(e.message || "");
      if (isChunkError) {
        console.error("[DYNAMIC_IMPORT_FAILURE] Global chunk error intercepted:", e.message);
        console.warn("[MODULE_LOAD_ERROR] Global error matching chunk loading failure. Refreshing window for cache-busting...");
        const now = Date.now();
        const lastReload = window.localStorage.getItem("global-dynamic-reload");
        if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
          window.localStorage.setItem("global-dynamic-reload", String(now));
          window.location.reload();
        }
      }
    };

    const handleRejection = (e: PromiseRejectionEvent) => {
      const reasonStr = String(e.reason || "");
      const isChunkError = 
        /Loading chunk/i.test(reasonStr) || 
        /Failed to fetch dynamically imported module/i.test(reasonStr) ||
        /error loading dynamically imported module/i.test(reasonStr);
      if (isChunkError) {
        console.error("[DYNAMIC_IMPORT_FAILURE] Unhandled rejection matching chunk loading failure:", reasonStr);
        console.warn("[MODULE_LOAD_ERROR] Global promise rejection matching chunk loading failure. Refreshing window for cache-busting...");
        const now = Date.now();
        const lastReload = window.localStorage.getItem("global-dynamic-reload");
        if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
          window.localStorage.setItem("global-dynamic-reload", String(now));
          window.location.reload();
        }
      }
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    updateAppMetadata(currentPath);
  }, [currentPath]);

  const [isStoreEnabled, setIsStoreEnabled] = useState<boolean>(() => {
    return storeService.getLocalStoreConfig().isEnabled;
  });

  useEffect(() => {
    const unsub = storeService.subscribeStoreConfig((cfg) => {
      setIsStoreEnabled(Boolean(cfg.isEnabled));
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  // Redirect to Home if store is disabled and user is on /loja
  useEffect(() => {
    if (currentPath === "/loja" && !isStoreEnabled) {
      window.history.replaceState({}, "", "/");
      setCurrentPath("/");
    }
  }, [currentPath, isStoreEnabled]);

  // Automatic Admin Redirect
  useEffect(() => {
    if (!checking && isAuthenticated) {
      if (currentPath === "/" || currentPath === "/admin") {
        console.log("[AUTO_ADMIN_REDIRECT] Authenticated admin detected. Directing directly to admin panel.");
        setCurrentPath("/dashboard");
        navigate("/dashboard");
      }
    }
  }, [isAuthenticated, checking, currentPath, navigate]);

  return currentPath === "/admin" ? (
    <React.Suspense fallback={
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full border-4 border-zinc-900 border-t-orange-500 animate-spin" />
        <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mt-6 animate-pulse">Carregando Tela de Login...</p>
      </div>
    }>
      <Login />
    </React.Suspense>
  ) : (currentPath === "/dashboard" || currentPath === "/dashboard/planejamento" || currentPath === "/dashboard/ganhadores") ? (
    <React.Suspense fallback={
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-full border-4 border-zinc-900 border-t-orange-500 animate-spin" />
        <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mt-6 animate-pulse">Carregando Painel Administrativo...</p>
      </div>
    }>
      <ProtectedRoute>
        <Dashboard currentPath={currentPath} setCurrentPath={setCurrentPath} />
      </ProtectedRoute>
    </React.Suspense>
  ) : (
    <LayoutWithHeader currentPath={currentPath} setCurrentPath={setCurrentPath}>
      {currentPath === "/minhas-cotas" || currentPath === "/minha-conta" || currentPath === "/minhas-compras" || currentPath === "/meus-numeros" ? (
        <MinhasCotas currentPath={currentPath} setCurrentPath={setCurrentPath} />
      ) : currentPath === "/ganhadores" ? (
        <WinnerHistory currentPath={currentPath} setCurrentPath={setCurrentPath} />
      ) : currentPath === "/auditoria" ? (
        <React.Suspense fallback={
          <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4">
            <div className="w-12 h-12 rounded-full border-4 border-zinc-900 border-t-orange-500 animate-spin" />
            <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mt-6 animate-pulse">Carregando Área de Auditoria...</p>
          </div>
        }>
          <RaffleAuditView currentPath={currentPath} setCurrentPath={setCurrentPath} />
        </React.Suspense>
      ) : currentPath === "/loja" ? (
        isStoreEnabled ? (
          <React.Suspense
            fallback={
              <div className="min-h-screen bg-[#050508] text-white flex flex-col items-center justify-center py-20">
                <div className="w-8 h-8 border-2 border-[#FF8A00] border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs text-zinc-500 font-black uppercase tracking-widest">Carregando Loja Premium...</p>
              </div>
            }
          >
            <StorePage currentPath={currentPath} setCurrentPath={setCurrentPath} />
          </React.Suspense>
        ) : (
          <RifaOnlineMain setCurrentPath={setCurrentPath} />
        )
      ) : (
        <RifaOnlineMain setCurrentPath={setCurrentPath} />
      )}
    </LayoutWithHeader>
  );
}

export default function RifaOnlineDemo() {
  return (
    <RaffleConfigProvider>
      <AuthProvider>
        <RifaOnlineApp />
      </AuthProvider>
    </RaffleConfigProvider>
  );
}

function LayoutWithHeader({
  children,
  currentPath,
  setCurrentPath,
}: {
  children: React.ReactNode;
  currentPath: string;
  setCurrentPath: (path: string) => void;
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { isAuthenticated } = useAuth();
  const { raffleConfig } = useRaffleConfig();
  const [isAdminLocally, setIsAdminLocally] = useState(false);
  const [isStoreEnabled, setIsStoreEnabled] = useState<boolean>(() => {
    return storeService.getLocalStoreConfig().isEnabled;
  });

  useEffect(() => {
    const unsub = storeService.subscribeStoreConfig((cfg) => {
      setIsStoreEnabled(Boolean(cfg.isEnabled));
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem("raffle_admin_token");
    if (savedToken) {
      adminService.verifySession(savedToken).then(setIsAdminLocally).catch(() => setIsAdminLocally(false));
    }
  }, []);

  const hasAdminAccess = isAuthenticated || isAdminLocally;

  return (
    <div className="min-h-screen bg-[#050505] text-white flex flex-col">
      {/* HEADER */}
      <header className="border-b border-[#121212] bg-[#0A0A0A]/95 backdrop-blur-xl sticky top-0 z-[100] shadow-[0_4px_30px_rgba(0,0,0,0.6)]">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:py-4 flex items-center justify-between">
          <div 
            onClick={() => {
              window.history.pushState({}, "", "/");
              setCurrentPath("/");
            }}
            className="flex items-center gap-2.5 sm:gap-3 cursor-pointer group active:scale-98 transition-all"
            id="global-brand-logo-btn"
          >
            {/* Custom 3D Logo SVG matching the user's reference exactly */}
            <div className="relative shrink-0 flex items-center justify-center group-hover:brightness-110 transition-all ml-1 bg-transparent">
              <svg className="w-10 h-10 sm:w-[46px] sm:h-[46px] drop-shadow-[0_2px_10px_rgba(255,138,0,0.25)]" viewBox="0 0 110 110" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  {/* Ultra-premium 3D Metallic Golden Gradient */}
                  <linearGradient id="brandHookGoldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#FFEEB3" />    {/* Reflection Highlight */}
                    <stop offset="30%" stopColor="#FFAA00" />   {/* Bright Gold */}
                    <stop offset="70%" stopColor="#FF6200" />   {/* Sunset Orange */}
                    <stop offset="100%" stopColor="#C42A00" />  {/* Metallic Amber Shadow */}
                  </linearGradient>

                  {/* Highlights Bevel Gradient */}
                  <linearGradient id="brandHookHighlight" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.8" />
                    <stop offset="50%" stopColor="#FFD27F" stopOpacity="0.4" />
                    <stop offset="100%" stopColor="#000000" stopOpacity="0.5" />
                  </linearGradient>

                  <filter id="premiumGlow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="1.5" dy="2.5" stdDeviation="1.8" floodOpacity="0.5" floodColor="#000000" />
                  </filter>
                </defs>

                <g filter="url(#premiumGlow)">
                  {/* Outer sweeping circular swoosh rings (dynamic, stylized circle frame) */}
                  <path 
                    d="M 76 16 C 56 10, 32 16, 24 35 M 20 48 C 20 78, 44 102, 74 102 C 86 102, 94 94, 98 86 C 102 78, 100 69, 100 69" 
                    stroke="url(#brandHookGoldGrad)" 
                    strokeWidth="4.5" 
                    strokeLinecap="round" 
                    fill="none"
                  />
                  {/* Subtle light reflections on the circular ring to simulate shiny metal */}
                  <path 
                    d="M 76 16 C 56 10, 32 16, 24 35" 
                    stroke="url(#brandHookHighlight)" 
                    strokeWidth="1.5" 
                    strokeLinecap="round" 
                    fill="none"
                  />

                  {/* Anchor fluke (left hook accent) */}
                  <path 
                    d="M 23 35 Q 31 43, 38 35 L 29 51 C 23 63, 23 78, 41 85 L 31 85 C 13 78, 15 58, 19 49 Z" 
                    fill="url(#brandHookGoldGrad)"
                  />
                  <path 
                    d="M 23 35 Q 31 43, 38 35 L 29 51 C 23 63, 23 78, 41 85 L 31 85 C 13 78, 15 58, 19 49 Z" 
                    fill="url(#brandHookHighlight)"
                    opacity="0.25"
                  />

                  {/* Fishing hook eyelet (Top right ring) */}
                  <circle 
                    cx="77" 
                    cy="27" 
                    r="6" 
                    stroke="url(#brandHookGoldGrad)" 
                    strokeWidth="5" 
                    fill="none" 
                  />
                  <circle 
                    cx="77" 
                    cy="27" 
                    r="6" 
                    stroke="url(#brandHookHighlight)" 
                    strokeWidth="1.2" 
                    fill="none" 
                    opacity="0.5"
                  />

                  {/* Main hook shank and curve */}
                  <path 
                    d="M 73 31 L 43 67 C 37 77, 47 90, 59 88 C 72 86, 79 74, 79 74" 
                    stroke="url(#brandHookGoldGrad)" 
                    strokeWidth="8.5" 
                    strokeLinecap="round" 
                    fill="none"
                  />
                  <path 
                    d="M 73 31 L 43 67 C 37 77, 47 90, 59 88 C 72 86, 79 74, 79 74" 
                    stroke="url(#brandHookHighlight)" 
                    strokeWidth="2.5" 
                    strokeLinecap="round" 
                    fill="none"
                    opacity="0.3"
                  />

                  {/* Hook barb (sharp upward point and angle) */}
                  <path 
                    d="M 79 74 L 83 54 L 69 62 Q 75 70, 79 74 Z" 
                    fill="url(#brandHookGoldGrad)" 
                  />
                  <path 
                    d="M 79 74 L 83 54 L 69 62 Q 75 70, 79 74 Z" 
                    fill="url(#brandHookHighlight)" 
                    opacity="0.3"
                  />
                </g>
              </svg>
            </div>
            
            <div className="flex flex-col justify-center translate-y-0.5" style={{ width: 'max-content' }}>
              <h1 className="text-[22px] sm:text-[28px] md:text-[32px] text-white leading-none font-bold tracking-tight mb-1 text-left">
                Rifa<span className="text-amber-500 font-black">Master</span>
              </h1>
              <div className="text-[6.5px] sm:text-[8px] md:text-[9px] text-amber-400 uppercase leading-none font-extrabold font-montserrat tracking-widest opacity-90" style={{ letterSpacing: '0.8px' }}>
                PESCA • CAMPING • AVENTURA
              </div>
            </div>
          </div>

          {/* DESKTOP NAVIGATION MENU */}
          <nav className="hidden xl:flex items-center gap-7">
            <button
              onClick={() => {
                window.history.pushState({}, "", "/");
                setCurrentPath("/");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className="text-zinc-400 hover:text-amber-400 text-[11px] font-extrabold tracking-widest uppercase transition-colors cursor-pointer"
            >
              Início
            </button>
            <button
              onClick={() => {
                window.history.pushState({}, "", "/");
                setCurrentPath("/");
                setTimeout(() => {
                  document.getElementById("como-funciona-section")?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              className="text-zinc-400 hover:text-amber-400 text-[11px] font-extrabold tracking-widest uppercase transition-colors cursor-pointer"
            >
              Como Funciona
            </button>
            <button
              onClick={() => {
                window.history.pushState({}, "", "/");
                setCurrentPath("/");
                setTimeout(() => {
                  document.getElementById("rifas-section")?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              className="text-zinc-400 hover:text-amber-400 text-[11px] font-extrabold tracking-widest uppercase transition-colors cursor-pointer"
            >
              Sorteios
            </button>
            <button
              onClick={() => {
                window.history.pushState({}, "", "/ganhadores");
                setCurrentPath("/ganhadores");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`text-[11px] font-extrabold tracking-widest uppercase transition-colors cursor-pointer ${
                currentPath === "/ganhadores" ? "text-amber-400" : "text-zinc-400 hover:text-amber-400"
              }`}
            >
              Resultados
            </button>
            {isStoreEnabled && (
              <button
                onClick={() => {
                  window.history.pushState({}, "", "/loja");
                  setCurrentPath("/loja");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className={`text-[11px] font-extrabold tracking-widest uppercase transition-colors cursor-pointer ${
                  currentPath === "/loja" ? "text-amber-400" : "text-zinc-400 hover:text-amber-400"
                }`}
              >
                Loja
              </button>
            )}
            <button
              onClick={() => {
                window.history.pushState({}, "", "/auditoria");
                setCurrentPath("/auditoria");
                window.scrollTo({ top: 0, behavior: "smooth" });
              }}
              className={`text-[11px] font-extrabold tracking-widest uppercase transition-colors cursor-pointer ${
                currentPath === "/auditoria" ? "text-amber-400" : "text-zinc-400 hover:text-amber-400"
              }`}
            >
              Auditoria
            </button>
          </nav>

          <div className="flex items-center gap-3">
            {/* DESKTOP ENTRAR / CADASTRAR */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="hidden md:flex items-center gap-2 bg-zinc-900/30 hover:bg-zinc-900/60 border border-zinc-800/60 text-zinc-300 hover:text-white px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
            >
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span>Entrar / Cadastrar</span>
            </button>

            {/* DESKTOP CTA */}
            <button
              onClick={() => {
                window.history.pushState({}, "", "/");
                setCurrentPath("/");
                setTimeout(() => {
                  document.getElementById("rifas-section")?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              className="hidden md:inline-flex bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-wider px-5 py-2.5 rounded-xl transition-all shadow-lg shadow-amber-500/15 active:scale-95 cursor-pointer"
            >
              Ver Rifas
            </button>

            {/* MOBILE QUICK CTA */}
            <button
              onClick={() => {
                window.history.pushState({}, "", "/");
                setCurrentPath("/");
                setTimeout(() => {
                  document.getElementById("como-funciona-section")?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              className="hidden xs:inline-flex md:hidden bg-zinc-900/40 hover:bg-zinc-900/60 border border-zinc-800/80 text-zinc-300 text-[10px] font-black uppercase tracking-wider px-2.5 sm:px-3 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer"
            >
              Como Funciona
            </button>

            <button
              onClick={() => {
                window.history.pushState({}, "", "/");
                setCurrentPath("/");
                setTimeout(() => {
                  document.getElementById("rifas-section")?.scrollIntoView({ behavior: "smooth" });
                }, 100);
              }}
              className="inline-flex md:hidden bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase tracking-wider px-2.5 sm:px-3 py-1.5 rounded-lg transition-all active:scale-95 cursor-pointer shrink-0"
            >
              Ver Rifas
            </button>

            <div className="relative">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="flex items-center justify-center bg-zinc-950 hover:bg-zinc-900 border border-zinc-800/80 text-zinc-300 p-2.5 rounded-xl transition-all active:scale-95 cursor-pointer relative z-[102] hover:border-amber-500/40"
                aria-label="Menu"
              >
                <Menu className="w-5 h-5 text-amber-400" />
              </button>

            {isMenuOpen && (
              <>
                {/* Clicking outside closes the menu */}
                <div 
                  className="fixed inset-0 z-[100]" 
                  onClick={() => setIsMenuOpen(false)}
                />
                <div className="absolute right-0 mt-3.5 w-64 max-w-[calc(100vw-24px)] rounded-[20px] border border-zinc-800/90 bg-zinc-950/98 p-2 shadow-2xl backdrop-blur-2xl z-[101] overflow-hidden divide-y divide-zinc-900/80">
                  <div className="space-y-1 pb-1">
                    {/* Minha Conta */}
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        window.history.pushState(null, "", "/minha-conta");
                        window.dispatchEvent(new PopStateEvent("popstate"));
                      }}
                      className={`flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left text-xs font-bold transition-all cursor-pointer ${
                        currentPath === "/minha-conta" ? "text-amber-400 bg-zinc-900/50" : "text-zinc-300 hover:bg-zinc-900/80 hover:text-white"
                      }`}
                    >
                      <User className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span>Minha Conta</span>
                    </button>

                    {/* Como Funciona (Atalho Celular) */}
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        window.history.pushState(null, "", "/");
                        setCurrentPath("/");
                        setTimeout(() => {
                          document.getElementById("como-funciona-section")?.scrollIntoView({ behavior: "smooth" });
                        }, 100);
                      }}
                      className="flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left text-xs font-bold text-zinc-300 hover:bg-zinc-900/80 hover:text-white transition-all cursor-pointer"
                    >
                      <Play className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Como Funciona</span>
                    </button>

                    {/* Loja Premium (Condicional) */}
                    {isStoreEnabled && (
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          window.history.pushState(null, "", "/loja");
                          window.dispatchEvent(new PopStateEvent("popstate"));
                        }}
                        className={`flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left text-xs font-bold transition-all cursor-pointer ${
                          currentPath === "/loja" ? "text-amber-400 bg-zinc-900/50" : "text-zinc-300 hover:bg-zinc-900/80 hover:text-white"
                        }`}
                      >
                        <Zap className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                        <span>Loja Premium</span>
                      </button>
                    )}



                    {/* Resultados */}
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        window.history.pushState(null, "", "/ganhadores");
                        window.dispatchEvent(new PopStateEvent("popstate"));
                      }}
                      className={`flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left text-xs font-bold transition-all cursor-pointer ${
                        currentPath === "/ganhadores" ? "text-amber-400 bg-zinc-900/50" : "text-zinc-300 hover:bg-zinc-900/80 hover:text-white"
                      }`}
                    >
                      <Trophy className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span>Resultados</span>
                    </button>

                    {/* Auditoria Pública */}
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        window.history.pushState(null, "", "/auditoria");
                        window.dispatchEvent(new PopStateEvent("popstate"));
                      }}
                      className={`flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left text-xs font-bold transition-all cursor-pointer ${
                        currentPath === "/auditoria" ? "text-amber-400 bg-zinc-900/50" : "text-zinc-300 hover:bg-zinc-900/80 hover:text-white"
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span>Auditoria Pública</span>
                    </button>

                    {/* Dúvidas Frequentes */}
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        const cleanPhone = String(raffleConfig.pixPhone || raffleConfig.pixKey || "5563999659203").replace(/\D/g, "");
                        const waLink = `https://wa.me/55${cleanPhone}?text=Ol%C3%A1%2C%20tenho%20d%C3%BAvidas%20sobre%20as%20rifas!`;
                        window.open(waLink, "_blank");
                      }}
                      className="flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left text-xs font-bold text-zinc-300 hover:bg-zinc-900/80 hover:text-white transition-all cursor-pointer"
                    >
                      <MessageCircle className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span>Dúvidas Frequentes</span>
                    </button>

                    {/* Compartilhar */}
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        const shareUrl = window.location.origin;
                        safeCopyToClipboard(shareUrl);
                        alert("🔗 Link do site copiado para compartilhamento!");
                      }}
                      className="flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left text-xs font-bold text-zinc-300 hover:bg-zinc-900/80 hover:text-white transition-all cursor-pointer"
                    >
                      <Copy className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span>Compartilhar</span>
                    </button>
                  </div>

                  <div className="pt-1.5 space-y-1">
                    {/* Admin */}
                    <button
                      onClick={() => {
                        setIsMenuOpen(false);
                        window.history.pushState(null, "", "/admin");
                        window.dispatchEvent(new PopStateEvent("popstate"));
                      }}
                      className="flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left text-xs font-black uppercase tracking-wider bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/25 transition-all cursor-pointer active:scale-98"
                    >
                      <ShieldCheck className="w-4 h-4 text-black shrink-0" />
                      <span>Admin</span>
                    </button>

                    {/* Sair (Exit option) */}
                    {hasAdminAccess && (
                      <button
                        onClick={() => {
                          setIsMenuOpen(false);
                          localStorage.removeItem("raffle_admin_token");
                          alert("Sessão encerrada!");
                          window.location.href = "/";
                        }}
                        className="flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-left text-xs font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all cursor-pointer"
                      >
                        <X className="w-4 h-4 text-red-400 shrink-0" />
                        <span>Sair</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1">
        {children}
      </div>
    </div>
  );
}

function RifaOnlineMain({ setCurrentPath }: { setCurrentPath: (path: string) => void }) {
  // Admin & Auth State
  const [showAdmin, setShowAdmin] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isAdminLoggingIn, setIsAdminLoggingIn] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [isClearing, setIsClearing] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawCountdown, setDrawCountdown] = useState(0);
  const [drawScrambled, setDrawScrambled] = useState("000");
  const [pendingDrawId, setPendingDrawId] = useState<string | null>(null);

  const handlePublishDraw = async () => {
    if (!pendingDrawId || !editedConfig.winnerNumber) return;
    try {
      const adminToken = localStorage.getItem("raffle_admin_token") || "";
      await adminService.publishDraw(adminToken, pendingDrawId, editedConfig);
      alert("Sorteio publicado com sucesso para todos os usuários!");
      setPendingDrawId(null);
    } catch (e) {
      console.error(e);
      alert("Erro ao publicar.");
    }
  };
  const [globalToast, setGlobalToast] = useState<{ message: string, type: "error" | "success" | "info" } | null>(null);
  const [infoModalContent, setInfoModalContent] = useState<{ title: string; text: string } | null>(null);

  useEffect(() => {
    if (globalToast) {
      const timer = setTimeout(() => setGlobalToast(null), 8000);
      return () => clearTimeout(timer);
    }
  }, [globalToast]);

  const [isTogglingActive, setIsTogglingActive] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadProgress, setImageUploadProgress] = useState<number | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  useEffect(() => {
    const savedToken = localStorage.getItem("raffle_admin_token");
    if (savedToken) {
      adminService.verifySession(savedToken).then((isValid) => {
        if (isValid) {
          setIsAdminAuthenticated(true);
        } else {
          localStorage.removeItem("raffle_admin_token");
        }
      }).catch((err) => {
        console.error("verifySession error:", err);
      });
    }
  }, []);

  // Consume shared raffleConfig state and loading toggle from RaffleConfigProvider
  const { raffleConfig, setRaffleConfig, isConfigLoaded, setSelectedRaffleId } = useRaffleConfig();

  // Multi-Raffle Customer Gallery State
  const [activeRaffles, setActiveRaffles] = useState<RaffleConfig[]>([]);
  const [activeRafflesStats, setActiveRafflesStats] = useState<Record<string, { soldCount: number; percentSold: number; remainingCount: number }>>({});
  const [loadingRaffles, setLoadingRaffles] = useState<boolean>(true);
  const [selectedCustomerRaffleId, setSelectedCustomerRaffleId] = useState<string | null>(() => {
    try {
      return localStorage.getItem("selected_customer_raffle_id") || null;
    } catch {
      return null;
    }
  });

  // Featured raffle helper for Hero banner & highlights
  const featuredRaffle = useMemo(() => {
    if (activeRaffles && activeRaffles.length > 0) {
      const highlighted = activeRaffles.find(r => r.isDestaque || r.isFeatured);
      return highlighted || activeRaffles[0];
    }
    return raffleConfig;
  }, [activeRaffles, raffleConfig]);

  // Carousel slider refs & states for premium active raffle gallery selection
  const customerCarouselRef = useRef<HTMLDivElement>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Winners history state & carousel controls for public home page
  const [homeWinners, setHomeWinners] = useState<any[]>([]);
  const [selectedWinnerModal, setSelectedWinnerModal] = useState<any | null>(null);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState<boolean>(false);

  const winnersCarouselRef = useRef<HTMLDivElement>(null);
  const [canScrollWinnersLeft, setCanScrollWinnersLeft] = useState(false);
  const [canScrollWinnersRight, setCanScrollWinnersRight] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db, "winners_history"),
      limit(10)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const historyList: any[] = [];
        snap.forEach((docSnap) => {
          historyList.push({ id: docSnap.id, ...docSnap.data() });
        });

        historyList.sort((a, b) => {
          const timeA = new Date(a.createdAt || a.drawTimestamp || 0).getTime();
          const timeB = new Date(b.createdAt || b.drawTimestamp || 0).getTime();
          return timeB - timeA;
        });

        setHomeWinners(historyList);
      },
      (err) => {
        console.error("Erro no listener de winners_history para home:", err);
      }
    );

    return () => unsub();
  }, []);

  const handleWinnersCarouselScroll = useCallback(() => {
    if (!winnersCarouselRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = winnersCarouselRef.current;
    setCanScrollWinnersLeft(scrollLeft > 10);
    setCanScrollWinnersRight(scrollLeft + clientWidth < scrollWidth - 10);
  }, []);

  const scrollWinnersLeft = useCallback(() => {
    if (!winnersCarouselRef.current) return;
    const firstChild = winnersCarouselRef.current.firstElementChild;
    if (firstChild) {
      const cardWidth = firstChild.clientWidth + 24;
      winnersCarouselRef.current.scrollBy({ left: -cardWidth, behavior: "smooth" });
    }
  }, []);

  const scrollWinnersRight = useCallback(() => {
    if (!winnersCarouselRef.current) return;
    const firstChild = winnersCarouselRef.current.firstElementChild;
    if (firstChild) {
      const cardWidth = firstChild.clientWidth + 24;
      winnersCarouselRef.current.scrollBy({ left: cardWidth, behavior: "smooth" });
    }
  }, []);

  const sampleWinnersList = useMemo(() => [
    {
      id: "sample-w1",
      prizeTitle: "Molinete de Alta Performance Premium",
      prizeImageUrl: "https://images.unsplash.com/photo-1515263487990-61b07816b324?q=80&w=800&auto=format&fit=crop",
      prizeDescription: "Conjunto japonês de altíssima performance para pesca oceânica e rios.",
      prizeValue: "11.800,00",
      winnerName: "Carlos Eduardo Silva",
      winnerImageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop",
      winnerNumber: "042",
      drawDate: "02/08/2026",
      drawTime: "19:30",
      city: "Manaus",
      state: "AM",
      status: "Destaque"
    },
    {
      id: "sample-w2",
      prizeTitle: "Barraca Técnica 4 Estações + Kit Camping Pro",
      prizeImageUrl: "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?q=80&w=800&auto=format&fit=crop",
      prizeDescription: "Equipamento ultra leve e impermeável para expedições selvagens e montanhismo.",
      prizeValue: "4.500,00",
      winnerName: "Roberto Mendes Neto",
      winnerImageUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=200&auto=format&fit=crop",
      winnerNumber: "189",
      drawDate: "28/07/2026",
      drawTime: "20:00",
      city: "Curitiba",
      state: "PR"
    },
    {
      id: "sample-w3",
      prizeTitle: "Mochila Cargueira Deuter 70L + Kit Aventura EDC",
      prizeImageUrl: "https://images.unsplash.com/photo-1537225228614-56cc3556d7ed?q=80&w=800&auto=format&fit=crop",
      prizeDescription: "Estrutura ergonômica ajustável para longas travessias.",
      prizeValue: "3.200,00",
      winnerName: "Fernanda Lima de Souza",
      winnerImageUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=200&auto=format&fit=crop",
      winnerNumber: "712",
      drawDate: "15/07/2026",
      drawTime: "18:00",
      city: "Goiânia",
      state: "GO"
    }
  ], []);

  const displayWinners = homeWinners.length > 0 ? homeWinners : sampleWinnersList;

  const handleCarouselScroll = useCallback(() => {
    if (!customerCarouselRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = customerCarouselRef.current;
    
    // Determine current index dynamically
    const firstChild = customerCarouselRef.current.firstElementChild;
    if (firstChild) {
      const cardWidth = firstChild.clientWidth + 24; // Width + gap-6
      const newIndex = Math.round(scrollLeft / cardWidth);
      if (newIndex >= 0 && newIndex < activeRaffles.length && newIndex !== activeSlideIndex) {
        setActiveSlideIndex(newIndex);
      }
    }
    
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 10);
  }, [activeRaffles.length, activeSlideIndex]);

  const scrollCarouselLeft = useCallback(() => {
    if (!customerCarouselRef.current) return;
    const firstChild = customerCarouselRef.current.firstElementChild;
    if (firstChild) {
      const cardWidth = firstChild.clientWidth + 24;
      customerCarouselRef.current.scrollBy({ left: -cardWidth, behavior: "smooth" });
    }
  }, []);

  const scrollCarouselRight = useCallback(() => {
    if (!customerCarouselRef.current) return;
    const firstChild = customerCarouselRef.current.firstElementChild;
    if (firstChild) {
      const cardWidth = firstChild.clientWidth + 24;
      customerCarouselRef.current.scrollBy({ left: cardWidth, behavior: "smooth" });
    }
  }, []);

  const scrollCarouselToSlide = useCallback((index: number) => {
    if (!customerCarouselRef.current) return;
    const firstChild = customerCarouselRef.current.firstElementChild;
    if (firstChild) {
      const cardWidth = firstChild.clientWidth + 24;
      customerCarouselRef.current.scrollTo({ left: cardWidth * index, behavior: "smooth" });
      setActiveSlideIndex(index);
    }
  }, []);

  const checkIsActiveRaffle = (data: any): boolean => {
    if (!data) return false;
    const statusLower = String(data.status || "").toLowerCase().trim();

    // Explicitly inactive statuses
    if (
      statusLower === "encerrada" ||
      statusLower === "pausada" ||
      statusLower === "arquivada" ||
      statusLower === "sorteada" ||
      statusLower === "inativa" ||
      statusLower === "inactive" ||
      statusLower === "disabled"
    ) {
      return false;
    }

    // Explicitly active status
    if (statusLower === "ativa" || statusLower === "active") {
      return true;
    }

    // Check boolean flags if status is not explicitly set to "ativa"
    if (data.isActive === false || data.isRaffleActive === false) {
      return false;
    }

    // Default to active for new or untagged documents
    return true;
  };

  useEffect(() => {
    setLoadingRaffles(true);
    console.log("⚡ [REALTIME_MULTI_RIFA] Subscribing onSnapshot to 'raffles' collection for client area...");

    const colRef = collection(db, "raffles");
    const unsubscribe = onSnapshot(
      colRef,
      async (snapshot) => {
        const list: RaffleConfig[] = [];
        console.log(`🔍 [DIAGNOSTICO_FIRESTORE] Total de documentos na coleção 'raffles': ${snapshot.size}`);

        snapshot.forEach((docSnap) => {
          if (docSnap.id === "global_pix") return;
          const data = docSnap.data() as RaffleConfig;
          const isActive = checkIsActiveRaffle(data);
          console.log(
            `📄 [DIAGNOSTICO_DOC] ID: "${docSnap.id}" | Título: "${data.title || "Sem título"}" | status: "${data.status}" | isActive: ${data.isActive} | isRaffleActive: ${data.isRaffleActive} => ATIVA? ${isActive ? "SIM ✅" : "NÃO ❌"}`
          );

          if (isActive) {
            list.push({
              id: docSnap.id,
              slug: data.slug || slugify(data.title || ""),
              title: data.title || "Rifa Sem Título",
              description: data.description || "",
              price: Number(data.price) || 10,
              totalNumbers: Number(data.totalNumbers) || 100,
              imageUrl: data.imageUrl || "",
              status: "ativa",
              isActive: true,
              isRaffleActive: true,
              pixKey: data.pixKey || "",
              pixReceiver: data.pixReceiver || "",
              pixBank: data.pixBank || "",
              pixPhone: data.pixPhone || "",
              winnerNumber: data.winnerNumber || "",
              winnerName: data.winnerName || "",
              promotionEnabled: data.promotionEnabled || false,
              promotionBuy: Number(data.promotionBuy) || 5,
              promotionBonus: Number(data.promotionBonus) || 1,
              drawDate: data.drawDate || "",
              drawTime: data.drawTime || "",
              whatsappGroupUrl: data.whatsappGroupUrl || "",
            });
          }
        });

        console.log(`📊 [DIAGNOSTICO_RESUMO] Total de rifas ativas encontradas: ${list.length}`);
        if (list.length === 0) {
          console.warn("⚠️ [DIAGNOSTICO] Nenhuma rifa ativa encontrada. O sistema exibirá a página de PRÉ-LANÇAMENTO.");
        } else {
          console.log(`✅ [DIAGNOSTICO] ${list.length} rifa(s) ativa(s) encontrada(s). Exibindo os cards das rifas ativas.`);
        }

        // Sort active raffles list so Destaque raffles appear first
        list.sort((a, b) => {
          const destA = (a.isDestaque || a.isFeatured) ? 1 : 0;
          const destB = (b.isDestaque || b.isFeatured) ? 1 : 0;
          return destB - destA;
        });

        // Update active raffles list
        setActiveRaffles(list);
        setLoadingRaffles(false);

        // Rule: If selected customer raffle is not in active list, or list is empty, reset to null
        setSelectedCustomerRaffleId((prevId) => {
          if (prevId && list.some((r) => r.id === prevId)) {
            return prevId;
          }
          try {
            localStorage.removeItem("selected_customer_raffle_id");
          } catch (e) {}
          return null;
        });

        // Fetch summary stats for each active raffle card
        const statsMap: Record<string, { soldCount: number; percentSold: number; remainingCount: number }> = {};
        await Promise.all(
          list.map(async (rf) => {
            try {
              let paidCount = Number(rf.soldCount || 0);

              // Subcollection check if soldCount is 0 or unpopulated to prevent 0% before participating
              try {
                const numbersColRef = collection(db, "raffles", rf.id, "numbers");
                const qPaid = query(numbersColRef, where("status", "==", "paid"));
                const paidSnap = await getDocs(qPaid);
                paidCount = Math.max(paidCount, paidSnap.size);
              } catch (subErr) {
                // Keep paidCount from rf.soldCount if subcollection query fails
              }

              const total = Number(rf.totalNumbers || 100);
              // Progress reflects only paid cotas
              const percent = Math.min(100, (paidCount / total) * 100);
              const remaining = Math.max(0, total - paidCount);
              statsMap[rf.id] = { soldCount: paidCount, percentSold: percent, remainingCount: remaining };
            } catch (e) {
              const total = Number(rf.totalNumbers || 100);
              statsMap[rf.id] = { soldCount: 0, percentSold: 0, remainingCount: total };
            }
          })
        );
        setActiveRafflesStats(statsMap);
      },
      (error) => {
        console.error("🔴 [REALTIME_MULTI_RIFA_ERROR] Error in raffles listener:", error);
        setLoadingRaffles(false);
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedCustomerRaffleId) {
      try {
        localStorage.setItem("selected_customer_raffle_id", selectedCustomerRaffleId);
      } catch (e) {}
      setSelectedRaffleId(selectedCustomerRaffleId);
    } else {
      try {
        localStorage.removeItem("selected_customer_raffle_id");
      } catch (e) {}
    }
  }, [selectedCustomerRaffleId, setSelectedRaffleId]);

  // URL Slug & Route Matcher Effect for Direct Links (e.g. /nome-da-rifa)
  useEffect(() => {
    if (!isConfigLoaded || loadingRaffles || activeRaffles.length === 0) return;

    const pathname = window.location.pathname;
    const rawSegment = decodeURIComponent(pathname.replace(/^\/+/, "")).trim();

    // Reserved system routes
    const systemRoutes = ["admin", "dashboard", "loja", "minhas-cotas", "ganhadores", "minha-conta", "minhas-compras", "meus-numeros"];
    if (systemRoutes.includes(rawSegment.toLowerCase())) {
      return;
    }

    if (!rawSegment) {
      // Root "/" route: show homepage list for selecting a raffle
      return;
    }

    // Match raffle by id, slug, or title slug
    const matched = activeRaffles.find(
      (r) =>
        r.id === rawSegment ||
        r.slug === rawSegment ||
        slugify(r.title) === rawSegment ||
        slugify(r.title) === slugify(rawSegment)
    );

    if (matched) {
      if (selectedCustomerRaffleId !== matched.id) {
        setSelectedCustomerRaffleId(matched.id);
        setSelectedRaffleId(matched.id);
      }
    }
  }, [isConfigLoaded, loadingRaffles, activeRaffles]);

  // Fetch past draws for stats and history list when raffle is offline
  const [offlinePastDraws, setOfflinePastDraws] = useState<any[]>([]);
  const [loadingOfflineDraws, setLoadingOfflineDraws] = useState(false);

  useEffect(() => {
    if (isConfigLoaded && (!raffleConfig.isActive || raffleConfig.isRaffleActive === false)) {
      async function loadOfflineDraws() {
        setLoadingOfflineDraws(true);
        console.log("🌲 [RifaOnlineMain] Loading past draws for preparation landing page...");
        try {
          const snap = await getDocs(collection(db, "winners_history"));
          const list: any[] = [];
          snap.forEach((docSnap) => {
            const data = docSnap.data();
            list.push({ id: docSnap.id, ...data });
          });
          list.sort((a, b: any) => {
            const timeA = new Date(a.createdAt || a.drawTimestamp || a.timestamp || 0).getTime();
            const timeB = new Date(b.createdAt || b.drawTimestamp || b.timestamp || 0).getTime();
            return timeB - timeA;
          });
          setOfflinePastDraws(list);
          console.log(`🌲 [RifaOnlineMain] Loaded ${list.length} completed draws.`);
        } catch (err) {
          console.error("Erro ao carregar sorteios anteriores no estado de preparação:", err);
        } finally {
          setLoadingOfflineDraws(false);
        }
      }
      loadOfflineDraws();
    }
  }, [isConfigLoaded, raffleConfig.isActive, raffleConfig.isRaffleActive]);

  // Admin Config Editing State
  const [dbNumbers, setDbNumbers] = useState<Record<string, { id: string; status: string; orderId?: string; name?: string; expiresAt?: number; updatedAt?: string }>>({});
  const [locks, setLocks] = useState<{
    [numberId: string]: { sessionId: string; expiresAt: number };
  }>({});
  const [editedConfig, setEditedConfig] = useState(raffleConfig);

  // Keep references to the latest configuration values to avoid stale closures in background callbacks
  const editedConfigRef = useRef(editedConfig);
  useEffect(() => {
    editedConfigRef.current = editedConfig;
  }, [editedConfig]);

  const raffleConfigRef = useRef(raffleConfig);
  useEffect(() => {
    raffleConfigRef.current = raffleConfig;
  }, [raffleConfig]);

  // Throttled buffers to batch rapid Firestore-Websocket updates under extreme concurrency
  const dbNumbersBufferRef = useRef<any>({});
  const dbNumbersTimeoutRef = useRef<any>(null);

  const setDbNumbersThrottled = useCallback((newNumbers: any) => {
    dbNumbersBufferRef.current = newNumbers;
    if (!dbNumbersTimeoutRef.current) {
      dbNumbersTimeoutRef.current = setTimeout(() => {
        setDbNumbers({ ...dbNumbersBufferRef.current });
        dbNumbersTimeoutRef.current = null;
      }, 100); // 100ms batching window
    }
  }, []);

  const locksBufferRef = useRef<any>({});
  const locksTimeoutRef = useRef<any>(null);

  const setLocksThrottled = useCallback((newLocks: any) => {
    locksBufferRef.current = newLocks;
    if (!locksTimeoutRef.current) {
      locksTimeoutRef.current = setTimeout(() => {
        setLocks({ ...locksBufferRef.current });
        locksTimeoutRef.current = null;
      }, 100); // 100ms batching window
    }
  }, []);

  useEffect(() => {
    return () => {
      if (dbNumbersTimeoutRef.current) clearTimeout(dbNumbersTimeoutRef.current);
      if (locksTimeoutRef.current) clearTimeout(locksTimeoutRef.current);
    };
  }, []);

  // Backups / Snapshots State Machine
  const [isExportingBackup, setIsExportingBackup] = useState(false);
  const [isImportingBackup, setIsImportingBackup] = useState(false);

  const handleExportBackup = useCallback(async () => {
    try {
      setIsExportingBackup(true);
      console.log("📥 [Backup Action] Iniciando exportação de snapshot do banco de dados...");
      
      const ordersColsRef = collection(db, "orders");
      const reservationsColsRef = collection(db, "reservations");
      const paymentsColsRef = collection(db, "payments");
      const drawsColsRef = collection(db, "draws");
      const numbersColRef = collection(db, "raffles", "current", "numbers");

      const [ordersSnap, reservationsSnap, paymentsSnap, drawsSnap, numbersSnap] = await Promise.all([
        getDocs(ordersColsRef),
        getDocs(reservationsColsRef),
        getDocs(paymentsColsRef),
        getDocs(drawsColsRef),
        getDocs(numbersColRef)
      ]);

      const backupData = {
        version: "RifaMaster_Backup_v1",
        timestamp: new Date().toISOString(),
        config: raffleConfig,
        orders: ordersSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        reservations: reservationsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        payments: paymentsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        draws: drawsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        numbers: numbersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      
      const link = document.createElement("a");
      link.href = url;
      link.download = `RifaMaster_Backup_${new Date().toISOString().split("T")[0]}_${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log(`✅ [Backup Action] Snapshot exportado com sucesso com ${backupData.orders.length} pedidos e ${backupData.numbers.length} alocações!`);
      alert("Backup exportado com sucesso contendo todas as configurações, pedidos, reservas, pagamentos e sorteios!");
    } catch (err: any) {
      console.error("❌ [Backup Error] Falha ao exportar:", err);
      alert("Erro ao exportar backup: " + err.message);
    } finally {
      setIsExportingBackup(false);
    }
  }, [raffleConfig]);

  const handleImportBackup = useCallback(async (file: File) => {
    if (!window.confirm("Aviso de Segurança: Importar um backup irá SUBSTITUIR configurações atuais e adicionar registros compatíveis. Deseja prosseguir com a restauração de dados?")) {
      return;
    }

    try {
      setIsImportingBackup(true);
      console.log("📥 [Backup Action] Lendo arquivo de backup para restauração...", file.name);

      const text = await file.text();
      const backup = JSON.parse(text);

      if (backup.version !== "RifaMaster_Backup_v1") {
        throw new Error("Formato de backup inválido ou incompatível.");
      }

      const adminToken = localStorage.getItem("raffle_admin_token") || "";
      console.log("[FRONTEND_API_CALL] Requesting mass backup import on backend API...");
      await adminService.importBackup(adminToken, backup);

      console.log("✅ [Backup Action] Snapshot de backup restaurado com sucesso via backend API!");
      alert("O backup de dados foi importado e restaurado com absoluto sucesso e sincronizado em tempo real!");
      
      // Force reload to let local structures bind fully
      window.location.reload();
    } catch (err: any) {
      console.error("❌ [Backup Error] Falha na restauração do backup via API:", err);
      alert("Erro ao importar backup: " + err.message);
    } finally {
      setIsImportingBackup(false);
    }
  }, []);

  // Orders State (Empty initially)
  const [orders, setOrders] = useState<
    {
      id: string;
      name: string;
      phone: string;
      nums: string[];
      val: number;
      status: "Aguardando" | "Pago" | "Cancelado" | "Reembolsado" | "expired";
    }[]
  >(() => {
    try {
      const saved = localStorage.getItem("raffle_orders_v1");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // REALTIME_RENDER_TRIGGERED log on every reactive cycle of the main system
  console.log(`📡 [REALTIME_RENDER_TRIGGERED] [${new Date().toISOString()}] isRaffleActive: ${raffleConfig?.isRaffleActive !== false}, Title: "${raffleConfig?.title || ""}"`);

  // Monitor mobile performance and capability metrics
  useEffect(() => {
    try {
      const ua = navigator.userAgent;
      const cores = navigator.hardwareConcurrency || "unknown";
      const mem = (navigator as any).deviceMemory || "unknown";
      const connection = (navigator as any).connection;
      const netType = connection ? connection.effectiveType || "unknown" : "unknown";
      
      console.log(`[MOBILE_PERFORMANCE] Device capability audit initiated.`);
      console.log(`[MOBILE_PERFORMANCE] UserAgent: ${ua}`);
      console.log(`[MOBILE_PERFORMANCE] CPU Cores: ${cores}, MemoryEstimate: ${mem}GB, Network: ${netType}`);
      
      if (window.performance) {
        const paintEntries = performance.getEntriesByType?.("paint");
        paintEntries?.forEach((entry) => {
          console.log(`[MOBILE_PERFORMANCE] Paint entry - ${entry.name}: ${entry.startTime.toFixed(1)}ms`);
        });
      }
    } catch (e) {
      console.error("[MOBILE_PERFORMANCE] Failed to perform initial device performance audit:", e);
    }
  }, []);

  // Monitor mobile storage/memory limit warnings periodically
  useEffect(() => {
    const checkMemoryAndStorage = () => {
      try {
        const perf = window.performance as any;
        if (perf && perf.memory) {
          const used = perf.memory.usedJSHeapSize;
          const limit = perf.memory.jsHeapSizeLimit;
          if (used && limit) {
            const ratio = used / limit;
            console.log(`[MOBILE_PERFORMANCE] Memory check - Used: ${Math.round(used / 1024 / 1024)}MB, Limit: ${Math.round(limit / 1024 / 1024)}MB (${(ratio * 100).toFixed(1)}%)`);
            if (ratio > 0.8) {
              console.warn(`[MOBILE_MEMORY_WARNING] Low hardware memory headroom! Heap utilized ratio is ${ratio.toFixed(2)}`);
            }
          }
        }
      } catch (e) {
        console.error("Memory sensor check error:", e);
      }
    };

    checkMemoryAndStorage();
    const interval = setInterval(checkMemoryAndStorage, 20000); // Audit every 20 seconds
    return () => clearInterval(interval);
  }, []);

  // Keep editedConfig in sync with incoming database raffleConfig changes
  useEffect(() => {
    setEditedConfig(raffleConfig);
  }, [raffleConfig]);

  // Real-time Firestore Sync for Taken Numbers
  useEffect(() => {
    if (!selectedCustomerRaffleId) {
      setDbNumbers({});
      return;
    }
    return realtimeService.subscribeNumbers(
      db,
      (activeNumbers) => setDbNumbersThrottled(activeNumbers),
      selectedCustomerRaffleId
    );
  }, [selectedCustomerRaffleId, setDbNumbersThrottled]);

  // Real-time Firestore Sync for Orders (STRICTLY Admin view only, limited to 50 recent orders)
  useEffect(() => {
    return realtimeService.subscribeOrders(
      db,
      isAdminAuthenticated,
      (ordersList) => setOrders(ordersList),
      undefined,
      { limitCount: 50 }
    );
  }, [isAdminAuthenticated]);

  // Persist LocalStorage Fallbacks
  useEffect(() => {
    try {
      localStorage.setItem("raffle_config_v1", JSON.stringify(raffleConfig));
    } catch (e) {
      console.error("Failed to save raffle config:", e);
    }
  }, [raffleConfig]);

  useEffect(() => {
    try {
      localStorage.setItem("raffle_orders_v1", JSON.stringify(orders));
    } catch (e) {
      console.error("Failed to save orders:", e);
    }
  }, [orders]);

  // Session ID for locking numbers temporarily
  const sessionId = useMemo(() => {
    let id = localStorage.getItem("raffle_session_id_v2");
    if (!id) {
      id = "sess_" + Math.random().toString(36).substr(2, 9);
      localStorage.setItem("raffle_session_id_v2", id);
    }
    return id;
  }, []);

  const [now, setNow] = useState(Date.now());
  const [slowNow, setSlowNow] = useState(Date.now());
  const cancelingOrdersRef = useRef<Set<string>>(new Set());
  const deletingLocksRef = useRef<Set<string>>(new Set());
  const pendingLocksRef = useRef<Set<string>>(new Set());
  const [visibleLimit, setVisibleLimit] = useState(200);

  // Dynamic continuous clock to evaluate lock expirations in real-time
  useEffect(() => {
    let tick = 0;
    const timer = setInterval(() => {
      setNow(Date.now());
      tick++;
      if (tick % 5 === 0) setSlowNow(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Real-time Firestore Sync for Locks (Filtered per raffle to avoid cross-raffle reads)
  useEffect(() => {
    return realtimeService.subscribeLocks(
      db,
      (activeLocks) => setLocksThrottled(activeLocks),
      selectedCustomerRaffleId
    );
  }, [selectedCustomerRaffleId, setLocksThrottled]);

  const [userData, setUserData] = useState<{ name: string; phone: string }>(() => {
    try {
      const saved = localStorage.getItem("raffle_user_data_v1");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === "object") {
          return {
            name: parsed.name || "",
            phone: parsed.phone || "",
          };
        }
      }
    } catch (e) {
      console.error("Failed to rehydrate user data:", e);
    }
    return { name: "", phone: "" };
  });

  useEffect(() => {
    try {
      localStorage.setItem("raffle_user_data_v1", JSON.stringify(userData));
    } catch (err) {
      console.error("Failed to save user data to localStorage:", err);
    }
  }, [userData]);

  const [selectedNumbers, setSelectedNumbers] = useState<string[]>(() => {
    try {
      const savedSelected = localStorage.getItem("raffle_selected_numbers_v1");
      if (savedSelected) {
        return JSON.parse(savedSelected);
      }
      const savedSubmitted = localStorage.getItem("raffle_submitted_numbers_v1");
      const savedStep = localStorage.getItem("raffle_payment_step_v1");
      if (savedSubmitted && (savedStep === "pix" || savedStep === "finished")) {
        return JSON.parse(savedSubmitted);
      }
    } catch (e) {}
    return [];
  });
  const selectedNumbersSet = useMemo(() => new Set(selectedNumbers), [selectedNumbers]);
  const recentlyToggledRef = useRef<Record<string, number>>({});

  const clearMyLocks = async (numsToClear?: string[]) => {
    // 1. If there's an active unpaid order, check if it was recently approved on Firestore
    if (paymentStep !== "finished" && mpPaymentInfo?.orderId) {
      try {
        const orderSnap = await getDoc(doc(db, "orders", mpPaymentInfo.orderId));
        if (orderSnap.exists()) {
          const s = (orderSnap.data()?.status || "").toLowerCase();
          if (s === "pago" || s === "paid" || s === "confirmed") {
            console.log("🛑 [clearMyLocks] Order is already paid. Aborting lock release to protect paid quotas.");
            setPaymentStep("finished");
            return;
          }
        }
      } catch (e) {
        console.error("Error verifying order status in clearMyLocks:", e);
      }
    }

    const sessionNumsFromDb = Object.keys(dbNumbers).filter(
      (num) => dbNumbers[num]?.sessionId === sessionId && dbNumbers[num]?.status !== "paid" && dbNumbers[num]?.status !== "Pago"
    );
    const sessionNumsFromLocks = Object.keys(locks).filter(
      (num) => locks[num]?.sessionId === sessionId
    );

    const targets = numsToClear || Array.from(new Set([
      ...selectedNumbers,
      ...submittedNumbers,
      ...sessionNumsFromDb,
      ...sessionNumsFromLocks
    ]));

    if (targets.length === 0) return;
    try {
      await pixService.lockCota({
        numbers: targets,
        sessionId,
        action: "unlock",
        raffleId: selectedCustomerRaffleId || raffleConfig.id || "current"
      });
    } catch (err) {
      console.error("Error clearing locks in batch:", err);
    }
  };
  // Removed global auto-cleanup of expired locks to prevent 600 concurrent users from spamming the backend/Firestore.
  // The system natively treats expired locks as "available" based on the `expiresAt <= now` rule dynamically.


  // Clean stale keys from deletingLocksRef when they are finally removed from locks state
  useEffect(() => {
    deletingLocksRef.current.forEach((numId) => {
      if (!locks[numId]) {
        deletingLocksRef.current.delete(numId);
      }
    });
  }, [locks]);

  // Removed global auto-cleanup of expired orders.
  // The UI and components natively display these as available when `expiresAt <= now`.

  // Clean up order IDs that are no longer pending/Aguardando from cancelingOrdersRef
  useEffect(() => {
    orders.forEach((order) => {
      if (order.status !== "pending_payment" && order.status !== "Aguardando") {
        cancelingOrdersRef.current.delete(order.id);
      }
    });
  }, [orders]);

  const [searchTerm, setSearchTerm] = useState("");
  const [randomCount, setRandomCount] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminStatusFilter, setAdminStatusFilter] = useState("Todos");
  const [openReleaseOrderId, setOpenReleaseOrderId] = useState<string | null>(
    null,
  );
  const [filter, setFilter] = useState("Todos");
  
  // Custom exit confirmation state
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  const [paymentStep, setPaymentStep] = useState<"data" | "pix" | "finished">(
    () => {
      try {
        const savedStep = localStorage.getItem("raffle_payment_step_v1");
        if (savedStep === "pix" || savedStep === "finished") {
          return savedStep as "pix" | "finished";
        }
      } catch (e) {}
      return "data";
    },
  );

  const [selectionExpiresAt, setSelectionExpiresAt] = useState<number | null>(() => {
    try {
      const saved = localStorage.getItem("raffle_selection_expires_at_v1");
      if (saved) return Number(saved);
    } catch (e) {}
    return null;
  });

  useEffect(() => {
    try {
      if (selectionExpiresAt !== null) {
        localStorage.setItem("raffle_selection_expires_at_v1", String(selectionExpiresAt));
      } else {
        localStorage.removeItem("raffle_selection_expires_at_v1");
      }
    } catch (e) {}
  }, [selectionExpiresAt]);

  // Keep selectionExpiresAt aligned with selection changes
  useEffect(() => {
    if (selectedNumbers.length === 0) {
      setSelectionExpiresAt(null);
    } else if (selectionExpiresAt === null && paymentStep === "data") {
      // Set a 3-minute selection timer starting now if we have numbers but no active timer
      setSelectionExpiresAt(Date.now() + 180 * 1000);
    }
  }, [selectedNumbers, paymentStep, selectionExpiresAt]);

  // Handle local selection expiration
  useEffect(() => {
    if (
      paymentStep === "data" &&
      selectedNumbers.length > 0 &&
      selectionExpiresAt &&
      now >= selectionExpiresAt
    ) {
      console.log("⏰ Selection timer expired! Releasing locks & clearing selection.");
      clearMyLocks();
      setSelectedNumbers([]);
      setSelectionExpiresAt(null);
    }
  }, [now, selectedNumbers, selectionExpiresAt, paymentStep]);
  const [submittedNumbers, setSubmittedNumbers] = useState<string[]>(() => {
    try {
      const savedSubmitted = localStorage.getItem("raffle_submitted_numbers_v1");
      if (savedSubmitted) {
        return JSON.parse(savedSubmitted);
      }
    } catch (e) {}
    return [];
  });
  const [isCopied, setIsCopied] = useState(false);
  const [successTimer, setSuccessTimer] = useState(10);

  // Reservation States
  const isGeneratingPaymentRef = useRef(false);
  const ignoreCancellationForOrderIdRef = useRef<string | null>(null);
  const [isGeneratingPayment, setIsGeneratingPaymentState] = useState(false);
  const setIsGeneratingPayment = (val: boolean) => {
    isGeneratingPaymentRef.current = val;
    setIsGeneratingPaymentState(val);
  };

  const [mpPaymentInfo, setMpPaymentInfo] = useState<{
    orderId: string;
    paymentId: string;
    qrCode: string;
    qrCodeBase64: string;
    isSimulated: boolean;
    bonusNums?: string[];
  } | null>(() => {
    try {
      const savedInfo = localStorage.getItem("raffle_mp_payment_info_v1");
      if (savedInfo) {
        return JSON.parse(savedInfo);
      }
    } catch (e) {}
    return null;
  });
  const mpPaymentInfoRef = useRef(mpPaymentInfo);
  useEffect(() => {
    mpPaymentInfoRef.current = mpPaymentInfo;
  }, [mpPaymentInfo]);

  // Real-time cleanup: release locks on tab close / navigation away
  useEffect(() => {
    const handleBeforeUnload = () => {
      // If they have numbers selected but no active order, release them
      if (selectedNumbersRef.current.length > 0 && paymentStepRef.current !== "finished") {
        const rid = selectedCustomerRaffleId || raffleConfig.id || "current";
        // We use a beacon-like fire and forget for the backend
        fetch("/api/lock-cota", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            numbers: selectedNumbersRef.current,
            sessionId,
            action: "unlock",
            raffleId: rid
          }),
          keepalive: true
        }).catch(() => {});
      }
      
      // If they have an active pending order, cancel it
      if (mpPaymentInfo?.orderId && paymentStepRef.current === "pix") {
        fetch("/api/cancel-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: mpPaymentInfo.orderId }),
          keepalive: true
        }).catch(() => {});
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [sessionId, selectedCustomerRaffleId, raffleConfig.id, mpPaymentInfo?.orderId]);

  const [lastBonusNums, setLastBonusNums] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("raffle_last_bonus_nums_v1");
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {}
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem("raffle_last_bonus_nums_v1", JSON.stringify(lastBonusNums));
    } catch (e) {}
  }, [lastBonusNums]);

  useEffect(() => {
    if (mpPaymentInfo?.bonusNums && mpPaymentInfo.bonusNums.length > 0) {
      setLastBonusNums(mpPaymentInfo.bonusNums);
    }
  }, [mpPaymentInfo]);

  const [mpError, setMpError] = useState<string | null>(null);

  const [paymentExpiresAt, setPaymentExpiresAt] = useState<number | null>(() => {
    try {
      const savedExpires = localStorage.getItem("raffle_payment_expires_at_v1");
      if (savedExpires) {
        return Number(savedExpires);
      }
    } catch (e) {}
    return null;
  });

  // Persist payment states to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("raffle_payment_step_v1", paymentStep);
    } catch (e) {}
  }, [paymentStep]);

  useEffect(() => {
    try {
      localStorage.setItem("raffle_submitted_numbers_v1", JSON.stringify(submittedNumbers));
    } catch (e) {}
  }, [submittedNumbers]);

  useEffect(() => {
    try {
      if (mpPaymentInfo) {
        localStorage.setItem("raffle_mp_payment_info_v1", JSON.stringify(mpPaymentInfo));
      } else {
        localStorage.removeItem("raffle_mp_payment_info_v1");
      }
    } catch (e) {}
  }, [mpPaymentInfo]);

  useEffect(() => {
    try {
      if (paymentExpiresAt !== null) {
        localStorage.setItem("raffle_payment_expires_at_v1", String(paymentExpiresAt));
      } else {
        localStorage.removeItem("raffle_payment_expires_at_v1");
      }
    } catch (e) {}
  }, [paymentExpiresAt]);

  // Auto-close success modal after 10 seconds of payment confirmation
  useEffect(() => {
    if (paymentStep === "finished") {
      setSuccessTimer(10);
      const interval = setInterval(() => {
        setSuccessTimer((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            // Reset selection structures safely
            setSubmittedNumbers([]);
            setSelectedNumbers([]);
            recentlyToggledRef.current = {};
            setPaymentStep("data");
            setMpPaymentInfo(null);
            setPaymentExpiresAt(null);
            const el = document.getElementById("top-section") || document.documentElement;
            el?.scrollIntoView({ behavior: "smooth" });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [paymentStep]);

  // Active frontend status check via secure /api/check-payment
  useEffect(() => {
    if (paymentStep === "pix" && mpPaymentInfo?.paymentId) {
      const paymentId = mpPaymentInfo.paymentId;
      if (String(paymentId).startsWith("SIM_")) return; // Do not poll for simulated tests
      
      console.log(`🔄 [Frontend Poller] Initiating status check for payment ID ${paymentId}`);
      const pollInterval = setInterval(() => {
        pixService.checkPayment({
          paymentId: String(paymentId),
          orderId: mpPaymentInfo.orderId,
          raffleId: selectedCustomerRaffleId || raffleConfig.id || "current",
        }).then((res) => {
          if (res.approved || res.orderStatus === "Pago" || res.orderStatus === "paid") {
            console.log(`✅ [Frontend Poller] Payment ${paymentId} approved!`);
            setPaymentStep("finished");
            if (res.bonusNums && res.bonusNums.length > 0) {
              setMpPaymentInfo((prev) => prev ? { ...prev, bonusNums: res.bonusNums } : prev);
            }
            if (res.nums && res.nums.length > 0) {
              setSubmittedNumbers(res.nums);
            }
          }
        }).catch((err) => {
          console.debug("🔄 [Frontend Poller] Background check error:", err);
        });
      }, 8000);

      return () => clearInterval(pollInterval);
    }
  }, [paymentStep, mpPaymentInfo?.paymentId, selectedCustomerRaffleId, raffleConfig.id]);

  // Instant direct document listener for the active order to confirm payment < 1s
  useEffect(() => {
    if (paymentStep === "pix" && mpPaymentInfo?.orderId) {
      console.log(`📡 [Instant Order Sync] Listening to changes for current order: ${mpPaymentInfo.orderId}`);
      const orderRef = doc(db, "orders", mpPaymentInfo.orderId);
      const unsub = onSnapshot(orderRef, (docSnap) => {
        // Enforce that we only process updates for the order we launched the listener for, preventing old order late events
        if (mpPaymentInfoRef.current?.orderId !== mpPaymentInfo?.orderId) {
          console.log(`📡 [Instant Order Sync] Ignoring stale order snapshot event`);
          return;
        }
        if (docSnap.exists()) {
          const data = docSnap.data();

          // Strict Security Checklist on Snapshot Trigger
          const currentRaffleId = selectedCustomerRaffleId || raffleConfig.id || "current";
          const userPhoneNorm = String(userData.phone || "").replace(/\D/g, "");
          const orderPhoneNorm = String(data?.phone || "").replace(/\D/g, "");
          
          const isRaffleMatch = !data?.raffleId || data?.raffleId === currentRaffleId;
          const isPaymentIdMatch = !data?.paymentId || String(data?.paymentId) === String(mpPaymentInfo?.paymentId);
          const isOwnerBySession = sessionId && data?.sessionId === sessionId;
          const isOwnerByPhone = userPhoneNorm && orderPhoneNorm && (userPhoneNorm === orderPhoneNorm);
          const isOwnerByOrder = mpPaymentInfo?.orderId && (data?.id === mpPaymentInfo.orderId || docSnap.id === mpPaymentInfo.orderId);
          const hasOwnership = isOwnerBySession || isOwnerByPhone || isOwnerByOrder;

          if (!isRaffleMatch || !isPaymentIdMatch || !hasOwnership) {
            console.error("[Instant Order Sync] SECURITY VIOLATION / MISMATCH DETECTED!", {
              isRaffleMatch,
              isPaymentIdMatch,
              hasOwnership,
              orderRaffleId: data?.raffleId,
              expectedRaffleId: currentRaffleId,
              orderPaymentId: data?.paymentId,
              expectedPaymentId: mpPaymentInfo?.paymentId
            });
            setGlobalToast({
              message: "⚠️ Erro de concorrência ou dados inválidos detectados na reserva.",
              type: "error"
            });
            // Abort and force back to selection
            setMpPaymentInfo(null);
            setPaymentExpiresAt(null);
            setSubmittedNumbers([]);
            setSelectedNumbers([]);
            setPaymentStep("data");
            return;
          }

          const s = (data?.status || "").toLowerCase();
          if (s === "pago" || s === "paid" || s === "confirmed") {
            console.log("💰 [Instant Order Sync] Payment approved! Advancing to finished step.");
            if (data?.bonusNums) {
              setMpPaymentInfo((prev) => prev ? { ...prev, bonusNums: data.bonusNums } : prev);
            }
            if (data?.nums) {
              setSubmittedNumbers(data.nums);
            }
            setPaymentStep("finished");
          } else if (s === "expired" || s === "canceled" || s === "cancelado") {
            if (
              isGeneratingPaymentRef.current ||
              (ignoreCancellationForOrderIdRef.current && ignoreCancellationForOrderIdRef.current === mpPaymentInfo?.orderId)
            ) {
              console.log("🔄 [Instant Order Sync] Ignorando status cancelado pois estamos no fluxo de transição ou cancelamento esperado.");
              return;
            }
            console.log("⏰ [Instant Order Sync] Order expired or canceled! Closing payment modal and clearing active Pix data.");
            setMpPaymentInfo(null);
            setPaymentExpiresAt(null);
            setSubmittedNumbers([]);
            setSelectedNumbers([]);
            setPaymentStep("data");
            setGlobalToast({
              message: "⏰ Sua reserva expirou. O pagamento foi invalidado e o QR Code removido.",
              type: "error"
            });
          }
        }
      }, (err) => {
        console.error("Erro no listener de instant order sync:", err);
      });
      return () => unsub();
    }
  }, [paymentStep, mpPaymentInfo?.orderId, db, selectedCustomerRaffleId, raffleConfig.id, userData.phone, sessionId]);

  // Handle local checkout expiration (10-minute timer)
  useEffect(() => {
    if (
      paymentStep === "pix" &&
      paymentExpiresAt &&
      now >= paymentExpiresAt
    ) {
      console.log("⏰ [v2.4] Checkout timer expired! Updating status to expired in database and returning to selection stage.");
      
      // Update Firestore status to "expired" for order and reservation documents
      if (mpPaymentInfo?.orderId) {
        pixService.cancelOrder(mpPaymentInfo.orderId).catch(err => {
          console.error("Error setting order expired status via backend:", err);
        });

        // Backend async release of reserved numbers
        try {
          const numsToUnlock = submittedNumbers.length > 0 ? submittedNumbers : selectedNumbers;
          numsToUnlock.forEach((num) => {
            pixService.lockCota({ 
              numberId: num, 
              sessionId, 
              action: "unlock",
              raffleId: selectedCustomerRaffleId || raffleConfig.id || "current"
            }).catch(() => {});
          });
        } catch (e) {
          console.error("Error invoking unlock endpoints on expiration:", e);
        }
      }

      // Soft release: clean selected numbers and payment information
      setSelectedNumbers([]);
      setSubmittedNumbers([]);
      setMpPaymentInfo(null);
      setPaymentExpiresAt(null);
      setPaymentStep("data");
      setGlobalToast({
        message: "⏰ Pagamento expirado. Suas cotas foram liberadas.",
        type: "error"
      });
    }
  }, [now, paymentStep, paymentExpiresAt, mpPaymentInfo, db]);

  // Keep selectedNumbers persistent in localStorage during session
  useEffect(() => {
    try {
      localStorage.setItem("raffle_selected_numbers_v1", JSON.stringify(selectedNumbers));
    } catch (e) {}
  }, [selectedNumbers]);

  // Auto-regenerate Pix payment if user changes their selection on the active Pix payment stage
  useEffect(() => {
    if (paymentStep !== "pix" || isGeneratingPayment) return;
    if (selectedNumbers.length === 0) return;

    const selectedSorted = [...selectedNumbers].sort().join(",");
    const submittedSorted = [...submittedNumbers].sort().join(",");

    if (selectedSorted !== submittedSorted) {
      const timer = setTimeout(async () => {
        console.log("🔄 Selection modified on Pix page! Triggering Pix auto-recalculation...");
        await handleCreateMercadoPagoPayment();
      }, 3500); // 3.5 seconds debounce to prevent rapid duplicate transaction creation

      return () => clearTimeout(timer);
    }
  }, [selectedNumbers, submittedNumbers, paymentStep, isGeneratingPayment]);

  // Dynamically calculate timerInSeconds based on expiration of our active locks OR the payment expiration
  const timerInSeconds = useMemo(() => {
    if (paymentStep === "finished") {
      return 0; // The 10-minute timer stops and disappears when payment is confirmed!
    }
    if (
      paymentStep === "pix" &&
      paymentExpiresAt
    ) {
      const secondsLeft = Math.ceil((paymentExpiresAt - now) / 1000);
      return Math.max(0, secondsLeft);
    }
    if (selectionExpiresAt) {
      const secondsLeft = Math.ceil((selectionExpiresAt - now) / 1000);
      return Math.max(0, secondsLeft);
    }
    return 180;
  }, [now, paymentStep, paymentExpiresAt, selectionExpiresAt]);

  const handleCreateMercadoPagoPayment = async () => {
    if (isGeneratingPayment) return;
    if (raffleConfig.isRaffleActive === false) {
      alert("Desculpe, a rifa está temporariamente desativada pelo administrador. Nenhum pagamento ou checkout pode ser efetuado no momento.");
      return;
    }
    if (!userData.name || !userData.phone) return;
    setIsGeneratingPayment(true);
    setMpError(null);
    try {
      // 1. Double check: Compare current selections against valid/available ones to prevent double-booking collisions
      const invalidSelectedOnStart = selectedNumbers.filter(id => !validSelectedNumbers.includes(id));
      if (invalidSelectedOnStart.length > 0) {
        alert(
          `Aviso: As cotas [ ${invalidSelectedOnStart.join(", ")} ] foram reservadas ou pagas por outro usuário no mesmo instante!\n` +
          `Para sua segurança, elas foram removidas da sua seleção atual.`
        );
        setSelectedNumbers((prev) => prev.filter((id) => !invalidSelectedOnStart.includes(id)));
        setIsGeneratingPayment(false);
        return;
      }

      const previousOrderId = mpPaymentInfo?.orderId;

      // 2. Initiate 10-minute timer immediately to replace the 3-minute selection timer
      const initialExpiresAt = Date.now() + 10 * 60 * 1000;
      setPaymentExpiresAt(initialExpiresAt);

      const activeNumsSnapshot = [...selectedNumbers];

      // 3. Request Mercado Pago creation to our express server proxy endpoint (Atomic backend transaction)
      const resData = await pixService.createPix({
        name: String(userData.name || "").trim(),
        phone: String(userData.phone || "").replace(/\D/g, ""),
        nums: activeNumsSnapshot,
        price: Number(raffleConfig.price || 0),
        sessionId: String(sessionId || ""),
        existingBonusNums: mpPaymentInfo?.bonusNums || lastBonusNums || [],
        raffleId: selectedCustomerRaffleId || raffleConfig.id || "current",
      });

      // Strict post-creation verification of newly generated Pix details before moving to 'pix' step
      if (!resData || !resData.paymentId || !resData.qrCode || !resData.orderId) {
        throw new Error("O servidor retornou dados incompletos para a geração do Pix. Tente novamente.");
      }

      // 4. NOW (and ONLY now) that the Pix response has been successfully generated, verified, & returned,
      // cancel the old order so it is cleanly superseded, with zero chance of leaving the user orderless if the call had failed.
      if (previousOrderId) {
        try {
          ignoreCancellationForOrderIdRef.current = previousOrderId;
          await pixService.cancelOrder(previousOrderId);
        } catch (err: any) {
          console.error("Failed to cancel previous order remotely:", err);
        }
      }

      // 5. Update states with the new successful and verified Pix payload
      setMpPaymentInfo({
        orderId: resData.orderId,
        paymentId: resData.paymentId,
        qrCode: resData.qrCode,
        qrCodeBase64: resData.qrCodeBase64,
        isSimulated: resData.isSimulated,
        bonusNums: resData.bonusNums,
      });

      setPaymentExpiresAt(resData.expiresAt);
      setSubmittedNumbers([...activeNumsSnapshot]);
      recentlyToggledRef.current = {};
      setPaymentStep("pix");
    } catch (err: any) {
      console.error(
        "[MOBILE_CHECKOUT_ERROR] Error creating automated Mercado Pago Pix reservation:",
        err,
      );
      let userFriendlyMsg = err?.message || "Ocorreu um erro ao criar a reserva do Pix. Tente novamente.";
      if (typeof userFriendlyMsg !== "string" || userFriendlyMsg.includes("pattern") || userFriendlyMsg.includes("DOMException") || userFriendlyMsg.includes("SyntaxError")) {
        userFriendlyMsg = "Falha temporária de comunicação com o servidor de pagamento. Por favor, tente novamente em alguns instantes.";
      }
      setMpError(userFriendlyMsg);

      // If there are conflicts returned from the server, handle them incrementally:
      if (err.conflicts && Array.isArray(err.conflicts) && err.conflicts.length > 0) {
        const conflictList: string[] = err.conflicts;
        
        // Remove ONLY the conflicting numbers, keeping all other valid selected numbers intact
        setSelectedNumbers((prev) => prev.filter((id) => !conflictList.includes(id)));
        
        // Provide a clear user-friendly explanation of exactly which numbers collided and that the remainder are kept
        alert(
          `Aviso: As seguintes cotas já foram adquiridas ou reservadas por outro cliente e foram removidas do seu carrinho:\n` +
          `[ ${conflictList.join(", ")} ]\n\n` +
          `As cotas restantes e válidas continuam em sua seleção.`
        );
      }
    } finally {
      setIsGeneratingPayment(false);
    }
  };

  const handleReturnToSelection = async () => {
    if (isGeneratingPayment) return;
    try {
      // 1. If there's an active order, cancel it in Firestore
      if (mpPaymentInfo?.orderId) {
        try {
          const orderDocRef = doc(db, "orders", mpPaymentInfo.orderId);
          const freshSnap = await getDoc(orderDocRef);
          if (freshSnap.exists()) {
            const statusStr = (freshSnap.data()?.status || "").toLowerCase();
            if (statusStr === "pago" || statusStr === "paid" || statusStr === "confirmed") {
              console.log("🛑 Order is already Pago/paid. Aborting return/cancel flow.");
              setPaymentStep("finished");
              alert("Seu pagamento já foi aprovado e seu pedido está confirmado!");
              return;
            }
          }
          ignoreCancellationForOrderIdRef.current = mpPaymentInfo.orderId;
          await pixService.cancelOrder(mpPaymentInfo.orderId);
        } catch (err: any) {
          console.error("Failed to cancel order remotely on return to selection:", err);
        }
      }

      // 2. Clear mpPaymentInfo, timer and restore locks for each of the submitted numbers using backend secure API
      const numsToLock = submittedNumbers.length > 0 ? submittedNumbers : selectedNumbers;
      
      if (numsToLock.length > 0) {
        const lockPromises = numsToLock.map(async (numId) => {
          try {
            const data = await pixService.lockCota({ 
              numberId: numId, 
              sessionId, 
              action: "lock",
              raffleId: selectedCustomerRaffleId || raffleConfig.id || "current"
            });
            if (data.expiresAt) {
              setSelectionExpiresAt(data.expiresAt);
            }
          } catch (e) {
            console.error(`Error restoring lock for ${numId}:`, e);
          }
        });
        await Promise.all(lockPromises);
      }

      // 3. Clear payment snapshots and set step to data
      setSubmittedNumbers([]);
      setMpPaymentInfo(null);
      setPaymentExpiresAt(null);
      setPaymentStep("data");
    } catch (err) {
      console.error("Error returning to selection:", err);
    }
  };

  const [autoSelectAmount, setAutoSelectAmount] = useState<string>("");
  const [isCheckoutVisible, setIsCheckoutVisible] = useState(false);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const handleAdminLogin = async (e: FormEvent) => {
    e.preventDefault();
    console.log("[BUTTON_CLICK] 'Entrar no Painel Security' button trigger.");
    if (isAdminLoggingIn) return;
    try {
      setIsAdminLoggingIn(true);
      const result = await adminService.login(adminPassword);
      if ("token" in result) {
        setIsAdminAuthenticated(true);
        localStorage.setItem("raffle_admin_token", result.token);
        setAdminPassword("");
      } else {
        alert("error" in result ? result.error : "Senha incorreta!");
      }
    } catch (err: any) {
      alert("Erro ao validar credenciais administrativas.");
    } finally {
      setIsAdminLoggingIn(false);
    }
  };

  const numbers = useMemo(() => {
    const t0 = performance.now();
    // Determine number status based on scalable dbNumbers allocations and active real-time locks
    const result = Array.from({ length: raffleConfig.totalNumbers }, (_, i) => {
      const num = String(i + 1).padStart(3, "0");
      let status: Status = "available";
      let isGhost = false;

      const dbNum = dbNumbers[num];
      if (dbNum) {
        const isBonus = !!dbNum.isBonus;
        if (dbNum.status === "paid" || dbNum.status === "Pago") {
          status = isBonus ? "bonus_paid" : "paid";
        } else if (
          dbNum.status === "reserved" ||
          dbNum.status === "pending_payment" ||
          dbNum.status === "Aguardando"
        ) {
          const hasExpired = dbNum.expiresAt ? dbNum.expiresAt < now : false;
          if (!hasExpired) {
            if (isBonus) {
              status = "bonus_reserved";
            } else if (dbNum.sessionId !== sessionId) {
              status = "pending_payment";
            }
          }
        }
      } else {
        // If not ordered, check if locked by someone else
        const activeLock = locks[num];
        if (
          activeLock &&
          activeLock.expiresAt > slowNow &&
          activeLock.sessionId !== sessionId
        ) {
          status = "pending_payment"; // Blocked/Locked for other users
          isGhost = true;
        }
      }

      return {
        id: num,
        status,
        isGhost,
        sessionId: dbNum ? dbNum.sessionId : (locks[num]?.sessionId),
        expiresAt: dbNum ? dbNum.expiresAt : (locks[num]?.expiresAt),
      };
    });
    const t1 = performance.now();
    const duration = t1 - t0;
    if (duration > 2) {
      console.log(`[MOBILE_RENDER_TIME] Synthesized status map for ${raffleConfig.totalNumbers} numbers in ${duration.toFixed(2)}ms`);
    }
    return result;
  }, [raffleConfig.totalNumbers, dbNumbers, locks, sessionId, slowNow, now]);

  // Derived state to compute valid selections from local basket + real-time status
  const validSelectedNumbers = useMemo(() => {
    return selectedNumbers.filter((id) => {
      const dbNum = dbNumbers[id];
      if (dbNum) {
        if (dbNum.status === "paid" || dbNum.status === "Pago") {
          return false; // Alguém já pagou, inválido
        }
        if (
          (dbNum.status === "reserved" || dbNum.status === "pending_payment" || dbNum.status === "Aguardando") &&
          dbNum.expiresAt && dbNum.expiresAt > now
        ) {
          // Permite se for o pedido atual do próprio usuário, ou a mesma sessão, ou o mesmo celular
          const isMyOrder = mpPaymentInfo?.orderId && dbNum.orderId === mpPaymentInfo.orderId;
          const isMySession = sessionId && dbNum.sessionId === sessionId;
          const safeDbPhone = String(dbNum.phone || "").replace(/\D/g, "");
          const safeUserPhone = String(userData.phone || "").replace(/\D/g, "");
          const isMyPhone = safeUserPhone && safeDbPhone && (safeDbPhone === safeUserPhone);

          if (!isMyOrder && !isMySession && !isMyPhone) {
            return false; // Pertence de fato a outro usuário/pedido
          }
        }
      }
      const activeLock = locks[id];
      if (
        activeLock &&
        activeLock.expiresAt > slowNow &&
        activeLock.sessionId !== sessionId
      ) {
        return false; // Bloqueado por outra sessão ativa
      }
      return true;
    });
  }, [selectedNumbers, dbNumbers, locks, sessionId, now, slowNow, mpPaymentInfo, userData.phone]);

  const stats = useMemo(() => {
    const paid = orders
      .filter((o) => o.status === "Pago" || o.status === "paid")
      .reduce((acc, curr) => acc + curr.val, 0);
    const pending = orders
      .filter(
        (o) => o.status === "Aguardando" || o.status === "pending_payment",
      )
      .reduce((acc, curr) => acc + curr.val, 0);
    const countPaid = numbers.filter(
      (n) => n.status === "paid" || n.status === "bonus_paid",
    ).length;
    const countReserved = numbers.filter(
      (n) =>
        n.status === "reserved" ||
        n.status === "pending_payment" ||
        selectedNumbersSet.has(n.id),
    ).length;

    return {
      arrecadado: paid,
      aEntrar: pending,
      countPaid,
      countReserved,
      countAvailable: Math.max(
        0,
        raffleConfig.totalNumbers - countPaid - countReserved,
      ),
    };
  }, [orders, numbers, selectedNumbersSet, raffleConfig.totalNumbers]);

  const progressPercentage = useMemo(() => {
    const total = raffleConfig.totalNumbers || 100;
    const occupied = numbers.filter(
      (n) => n.status === "paid" || n.status === "bonus_paid",
    ).length;
    return total > 0 ? (occupied / total) * 100 : 0;
  }, [numbers, raffleConfig.totalNumbers]);

  const characterProgressBar = useCallback((percentage: number) => {
    const totalBlocks = 10;
    const activeBlocks = Math.round(percentage / 10);
    const blocks = "█".repeat(activeBlocks);
    const empty = "░".repeat(Math.max(0, totalBlocks - activeBlocks));
    return `${blocks}${empty}`;
  }, []);

  const isRaffleFullyClosed = useMemo(() => {
    const promotionEnabled = !!raffleConfig.promotionEnabled;
    const buy = Number(raffleConfig.promotionBuy || 5);
    const promoBonus = Number(raffleConfig.promotionBonus || 1);
    const totalRaffleNumbers = Number(raffleConfig.totalNumbers || 150);

    let capacity = totalRaffleNumbers;
    if (promotionEnabled && buy > 0 && promoBonus > 0) {
      const groupSize = buy + promoBonus;
      const groups = Math.floor(totalRaffleNumbers / groupSize);
      const rem = totalRaffleNumbers % groupSize;
      capacity = groups * buy + Math.min(buy, rem);
    }

    const paidAll = stats.countPaid >= capacity;
    const selectedAll = (stats.countPaid + stats.countReserved) >= capacity;

    if (promotionEnabled && (paidAll || selectedAll)) {
      console.log(`[PROMOTION_LIMIT_REACHED] Client side capacity reached at capacity Limit: ${capacity}`);
    }

    return paidAll || selectedAll;
  }, [stats.countPaid, stats.countReserved, raffleConfig.totalNumbers, raffleConfig.promotionEnabled, raffleConfig.promotionBuy, raffleConfig.promotionBonus]);

  const handleAction = async (
    orderId: string,
    action: "confirm" | "cancel" | "refund",
  ) => {
    try {
      if (action === "refund") {
        if (
          !window.confirm(
            "Tem certeza que deseja REEMBOLSAR esta ordem? Isso liberará todas as cotas associadas de volta para compra pública e marcará o status como Reembolsado.",
          )
        ) {
          return;
        }
      }

      const adminToken = localStorage.getItem("raffle_admin_token") || "";
      await adminService.orderAction(adminToken, orderId, action);

      if (action === "refund") {
        alert("Ordem reembolsada e cotas liberadas com sucesso!");
      }
    } catch (e: any) {
      alert("Erro ao executar ação: " + e.message);
    }
  };

  const handleReleaseSingleCota = async (
    orderId: string,
    numberToRelease: string,
  ) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    if (
      !window.confirm(
        `Você tem certeza que deseja liberar apenas a cota ${numberToRelease} do pedido de ${order.name}?`,
      )
    ) {
      return;
    }

    try {
      const adminToken = localStorage.getItem("raffle_admin_token") || "";
      const data = await adminService.releaseCota(adminToken, orderId, numberToRelease);

      const updatedLength = data.updatedNumsLength || 0;
      if (updatedLength === 0) {
        alert(
          `Como todas as cotas foram liberadas, o pedido de ${order.name} foi cancelado.`,
        );
      } else {
        alert(
          `Cota ${numberToRelease} liberada com sucesso do pedido de ${order.name}!`,
        );
      }
    } catch (err: any) {
      console.error("Erro ao liberar cota individual:", err);
      alert("Erro ao liberar a cota: " + err.message);
    }
  };

  const filteredOrders = useMemo(() => {
    let result = orders;

    if (adminStatusFilter !== "Todos") {
      result = result.filter((o) => {
        const s = (o.status || "").toLowerCase();
        if (adminStatusFilter === "Pago") {
          return s === "pago" || s === "paid" || s === "approved";
        }
        if (adminStatusFilter === "Pendente") {
          return s === "pending_payment" || s === "aguardando" || s === "reserved";
        }
        if (adminStatusFilter === "Cancelado") {
          return s === "cancelado" || s === "canceled" || s === "refunded" || s === "reembolsado";
        }
        return true;
      });
    }

    if (!adminSearch.trim()) return result;
    const q = adminSearch.toLowerCase().trim();
    return result.filter(
      (o) =>
        String(o.name || "").toLowerCase().includes(q) ||
        String(o.phone || "").includes(q) ||
        String(o.id || "").toLowerCase().includes(q) ||
        (Array.isArray(o.nums) && o.nums.some((n) => String(n || "").includes(q))),
    );
  }, [orders, adminSearch, adminStatusFilter]);

  const handleClearRaffle = async () => {
    console.log("[BUTTON_CLICK] 'Reiniciar Rifa' button trigger.");
    if (
      !window.confirm(
        "Você tem certeza que deseja REINICIAR TODA A RIFA? Isso apagará todos os pedidos de forma permanente, liberará todos os números reservados ou pagos e resetará o ganhador.",
      )
    ) {
      console.log("[MODAL_ACTION] Reset confirmation declined by user.");
      return;
    }

    try {
      setIsClearing(true);
      console.log("♻️ [Reset Raffle] Iniciando reinicialização total da rifa...");

      const adminToken = localStorage.getItem("raffle_admin_token") || "";
      const data = await adminService.clearRaffle(adminToken);

      const nextConfig = data.resetConfig || {
        ...raffleConfig,
        winnerNumber: "",
        winnerName: "",
      };

      setEditedConfig(nextConfig);
      setRaffleConfig(nextConfig);

      // Force reset local states immediately to ensure no leftovers or stale UI blocks
      setDbNumbers({});
      setOrders([]);
      setLocks({});
      recentlyToggledRef.current = {};
      setSelectedNumbers([]);
      setSubmittedNumbers([]);
      setPaymentStep("data");
      setUserData({ name: "", phone: "" });
      setMpPaymentInfo(null);
      setMpError(null);
      setAutoSelectAmount("");
      setSearchTerm("");
      setAdminSearch("");

      // Clean local storage fully
      try {
        localStorage.removeItem("raffle_orders_v1");
        localStorage.removeItem("raffle_user_data_v1");
        localStorage.removeItem("raffle_session_id_v2");
        localStorage.removeItem("raffle_submitted_numbers_v1");
        localStorage.removeItem("raffle_payment_step_v1");
        localStorage.removeItem("raffle_payment_expires_at_v1");
        console.log("♻️ [Reset Raffle] Local storage values cleaned successfully.");
      } catch (e) {
        console.error("Local storage reset error:", e);
      }

      console.log("♻️ [Reset Raffle] Local storage values cleaned successfully.");
      alert("A rifa foi totalmente reiniciada com sucesso!");
    } catch (err: any) {
      console.error("❌ [Reset Raffle Error] Falha de reinício no backend ou no Firestore:", err);
      alert("Erro ao reiniciar a rifa: " + err.message);
    } finally {
      setIsClearing(false);
    }
  };

  const handleDrawWinner = async () => {
    if (isDrawing) return;

    // Strict validation: draw only if ALL quotas are paid
    const paidCount = numbers.filter(
      (n) => n.status === "paid" || n.status === "bonus_paid",
    ).length;
    if (paidCount < raffleConfig.totalNumbers) {
      alert(
        `O sorteio só é permitido se TODAS as cotas estiverem preenchidas e PAGAS!\n\nCotas pagas: ${paidCount} de ${raffleConfig.totalNumbers} (${raffleConfig.totalNumbers - paidCount} restantes).`,
      );
      return;
    }

    try {
      setIsDrawing(true);
      setDrawCountdown(5);
      setDrawScrambled("000");

      const adminToken = localStorage.getItem("raffle_admin_token") || "";
      const data = await adminService.draw(adminToken);

      const { winnerNumber: winnerNum, winnerName, updatedConfig: finalConfig, drawId } = data;
      setPendingDrawId(drawId);

      // Interval to scramble the number visual
      const scrambleInterval = setInterval(() => {
        const tempId =
          Math.floor(Math.random() * (raffleConfig.totalNumbers || 100)) + 1;
        setDrawScrambled(String(tempId).padStart(3, "0"));
      }, 80);

      // Interval for countdown
      let remaining = 5;
      const countInterval = setInterval(async () => {
        remaining -= 1;
        setDrawCountdown(remaining);

        if (remaining <= 0) {
          clearInterval(scrambleInterval);
          clearInterval(countInterval);

          setEditedConfig(finalConfig);
          setDrawScrambled(winnerNum);

          // Hold the state for 5 more seconds showing the winner details
          setDrawCountdown(-1); // special flag to denote reveal stage

          setTimeout(() => {
            setIsDrawing(false);
            setDrawCountdown(0);
          }, 5000);
        }
      }, 1000);
    } catch (err: any) {
      setIsDrawing(false);
      setDrawCountdown(0);
      console.error("Erro ao realizar o sorteio:", err);
      alert("Erro ao realizar o sorteio: " + err.message);
    }
  };

  const filteredNumbers = useMemo(() => {
    const t0 = performance.now();
    const result = numbers.filter((n) => {
      const matchesSearch = n.id.includes(searchTerm);
      const matchesFilter =
        filter === "Todos" ||
        (filter === "Disponíveis" && (n.status === "available" || n.isGhost)) ||
        (filter === "Pagos" && (n.status === "paid" || n.status === "bonus_paid")) ||
        (filter === "Reservados" &&
          (n.status === "reserved" || n.status === "pending_payment") &&
          !n.isGhost);
      return matchesSearch && matchesFilter;
    });
    const t1 = performance.now();
    const duration = t1 - t0;
    if (duration > 2) {
      console.log(`[MOBILE_RENDER_TIME] filteredNumbers filter operations for ${numbers.length} items took ${duration.toFixed(2)}ms`);
    }
    return result;
  }, [numbers, searchTerm, filter]);

  useEffect(() => {
    setVisibleLimit(200);
  }, [filter, searchTerm]);

  const visibleNumbers = useMemo(() => {
    return filteredNumbers.slice(0, visibleLimit);
  }, [filteredNumbers, visibleLimit]);

  const selectedNumbersRef = useRef<string[]>([]);
  useEffect(() => {
    selectedNumbersRef.current = selectedNumbers;
  }, [selectedNumbers]);

  const locksRef = useRef<{ [numberId: string]: { sessionId: string; expiresAt: number } }>({});
  useEffect(() => {
    locksRef.current = locks;
  }, [locks]);

  const paymentStepRef = useRef<"data" | "pix" | "finished">("data");
  useEffect(() => {
    paymentStepRef.current = paymentStep;
  }, [paymentStep]);

  const toggleNumber = useCallback(
    async (id: string, status: Status) => {
      if (!raffleConfig.isActive || raffleConfig.isRaffleActive === false) return;

      // Prevent false clicks / double click concurrency
      if (pendingLocksRef.current.has(id)) return;

      const currentLocks = locksRef.current;
      const currentSelected = selectedNumbersRef.current;
      const currentPaymentStep = paymentStepRef.current;

      const dbNum = dbNumbers[id];
      const activeLock = currentLocks[id];

      // Safety Collision Check: check if locked/reserved by ANOTHER session
      const isLockedByOther =
        (activeLock && activeLock.expiresAt > Date.now() && activeLock.sessionId !== sessionId) ||
        (dbNum && dbNum.sessionId !== sessionId && (dbNum.status === "reserved" || dbNum.status === "pending_payment" || dbNum.status === "Aguardando") && dbNum.expiresAt > Date.now());

      if (isLockedByOther) {
        alert("Desculpe, este número acabou de ser reservado por outro usuário!");
        return;
      }

      const isSelected = currentSelected.includes(id) || submittedNumbers.includes(id);

      if (currentPaymentStep === "finished") {
        setPaymentStep("data");
        setSubmittedNumbers([]);
      }

      pendingLocksRef.current.add(id);

      if (isSelected) {
        // Deselect number
        recentlyToggledRef.current[id] = Date.now();
        setSelectedNumbers((prev) => prev.filter((n) => n !== id));
        setSubmittedNumbers((prev) => prev.filter((n) => n !== id));
        setDbNumbers((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setLocks((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });

        try {
          await pixService.lockCota({ 
            numberId: id, 
            sessionId, 
            action: "unlock",
            raffleId: selectedCustomerRaffleId || raffleConfig.id || "current"
          });
        } catch (err: any) {
          console.warn("[MOBILE_RESERVATION_WARNING] Failed to release individual cota lock dynamically:", err.message || err);
        } finally {
          pendingLocksRef.current.delete(id);
        }
      } else {
        // Check dynamic promotional capacity before allowing selection addition
        const promotionEnabled = !!raffleConfig.promotionEnabled;
        const buy = Number(raffleConfig.promotionBuy || 5);
        const promoBonus = Number(raffleConfig.promotionBonus || 1);
        const totalRaffleNumbers = Number(raffleConfig.totalNumbers || 150);

        const busyByOthersCount = numbers.filter((n) => {
          if (n.status === "paid" || n.status === "bonus_paid") return true;
          if (n.status === "reserved" || n.status === "pending_payment") {
            const expired = n.expiresAt && Date.now() >= n.expiresAt;
            return !expired && n.sessionId !== sessionId;
          }
          return false;
        }).length;

        const capacityRemaining = totalRaffleNumbers - busyByOthersCount;
        const candidateLength = currentSelected.length + 1;
        const testBonus = promotionEnabled ? Math.floor(candidateLength / buy) * promoBonus : 0;
        const testTotalNeeded = candidateLength + testBonus;

        if (testTotalNeeded > capacityRemaining) {
          console.warn(`[PROMOTION_LIMIT_REACHED] Selection blocked by client validation. Needed total: ${testTotalNeeded} (candidate: ${candidateLength}, test bonus: ${testBonus}), capacity remaining: ${capacityRemaining}`);
          alert(`⚠️ Restam apenas ${capacityRemaining} cotas disponíveis considerando a promoção ativa.`);
          pendingLocksRef.current.delete(id);
          return;
        }

        // Optimistic locally
        recentlyToggledRef.current[id] = Date.now();
        setSelectedNumbers((prev) => [...prev, id]);
        try {
          const data = await pixService.lockCota({ numberId: id, sessionId, action: "lock", raffleId: selectedCustomerRaffleId || raffleConfig.id || "current" });
          if (data.expiresAt) {
            setSelectionExpiresAt(data.expiresAt);
          }
        } catch (err: any) {
          console.error("[MOBILE_RESERVATION_ERROR] Failed to claim individual cota lock:", err);
          recentlyToggledRef.current[id] = 0;
          setSelectedNumbers((prev) => prev.filter((n) => n !== id));

          const isConflict =
            err?.status === 409 ||
            err?.code === "already_locked" ||
            (typeof err?.message === "string" && (
              err.message.includes("already_locked") ||
              err.message.includes("selecionado") ||
              err.message.includes("outro") ||
              err.message.includes("409")
            ));

          if (isConflict) {
            setLocks((prev) => ({
              ...prev,
              [id]: {
                sessionId: "locked_by_other_local",
                expiresAt: Date.now() + 180000,
              },
            }));
          }

          alert("Falha na garantia da reserva: número selecionado por outro jogador.");
        } finally {
          pendingLocksRef.current.delete(id);
        }
      }
    },
    [raffleConfig, sessionId, numbers, dbNumbers, submittedNumbers],
  );

  const handleCellClick = useCallback((id: string, status: Status) => {
    toggleNumber(id, status);
  }, [toggleNumber]);

  // Random selection logic natively using local state
  const selectRandomNumbers = useCallback(
    async (count: number) => {
      if (!raffleConfig.isActive || raffleConfig.isRaffleActive === false) return;

      const promotionEnabled = !!raffleConfig.promotionEnabled;
      const buy = Number(raffleConfig.promotionBuy || 5);
      const promoBonus = Number(raffleConfig.promotionBonus || 1);
      const totalRaffleNumbers = Number(raffleConfig.totalNumbers || 150);

      const busyByOthersCount = numbers.filter((n) => {
        if (n.status === "paid" || n.status === "bonus_paid") return true;
        if (n.status === "reserved" || n.status === "pending_payment") {
          const expired = n.expiresAt && Date.now() >= n.expiresAt;
          return !expired && n.sessionId !== sessionId;
        }
        return false;
      }).length;

      const capacityRemaining = totalRaffleNumbers - busyByOthersCount;
      let allowedCount = count;
      const totalCandidateProposed = selectedNumbers.length + count;
      const proposedBonus = promotionEnabled ? Math.floor(totalCandidateProposed / buy) * promoBonus : 0;

      if (totalCandidateProposed + proposedBonus > capacityRemaining) {
        let maxAllowedTotal = 0;
        for (let s = capacityRemaining; s >= 1; s--) {
          const testBonus = promotionEnabled ? Math.floor(s / buy) * promoBonus : 0;
          if (s + testBonus <= capacityRemaining) {
            maxAllowedTotal = s;
            break;
          }
        }

        const currentSelectedCount = selectedNumbers.length;
        const maxAllowedAddition = Math.max(0, maxAllowedTotal - currentSelectedCount);

        if (maxAllowedAddition <= 0) {
          alert(`⚠️ Restam apenas ${capacityRemaining} cotas disponíveis considerando a promoção ativa. Você já selecionou o máximo permitido (${currentSelectedCount} cotas).`);
          return;
        }

        alert(`⚠️ Restam apenas ${capacityRemaining} cotas disponíveis considerando a promoção ativa. Limitamos a seleção ao acréscimo de mais ${maxAllowedAddition} cotas.`);
        allowedCount = maxAllowedAddition;
      }

      const available: string[] = numbers
        .filter((n) => n.status === "available" && !selectedNumbersSet.has(n.id) && !n.isGhost)
        .map((n) => n.id);

      if (available.length === 0) {
        alert("Nenhum número disponível no momento!");
        return;
      }

      if (paymentStep === "finished") {
        setPaymentStep("data");
        setSubmittedNumbers([]);
      }

      const shuffled = [...available].sort(() => 0.5 - Math.random());
      const selectedCount = Math.min(allowedCount, available.length);
      const toSelect = shuffled.slice(0, selectedCount);

      if (selectedCount < allowedCount) {
        alert(
          `Apenas ${selectedCount} de ${allowedCount} cotas solicitadas estavam disponíveis e foram adicionadas ao seu carrinho.`
        );
      }

      // Add to local state immediately for speed
      toSelect.forEach((numId) => {
        recentlyToggledRef.current[numId] = Date.now();
      });
      setSelectedNumbers((prev) => [...prev, ...toSelect]);

      // Save temporary locks through the secure backend API using BATCH mode
      try {
        const data = await pixService.lockCota({ numbers: toSelect, sessionId, action: "lock", raffleId: selectedCustomerRaffleId || raffleConfig.id || "current" });
        if (data.expiresAt) {
           setSelectionExpiresAt(data.expiresAt);
        }
      } catch (err: any) {
         console.error("[MOBILE_RESERVATION_ERROR] Random selection batch quota reservation failed:", err);
         // Rollback failures
         toSelect.forEach((numId: string) => {
            recentlyToggledRef.current[numId] = 0;
            setSelectedNumbers((prev) => prev.filter((n) => n !== numId));
         });

         const isConflict =
           err?.status === 409 ||
           err?.code === "already_locked" ||
           (typeof err?.message === "string" && (
             err.message.includes("already_locked") ||
             err.message.includes("selecionado") ||
             err.message.includes("outro") ||
             err.message.includes("409")
           ));

         if (isConflict) {
           const syntheticLocks: Record<string, { sessionId: string; expiresAt: number }> = {};
           toSelect.forEach((numId: string) => {
             syntheticLocks[numId] = {
               sessionId: "locked_by_other_local",
               expiresAt: Date.now() + 180000,
             };
           });
           setLocks((prev) => ({
             ...prev,
             ...syntheticLocks,
           }));
         }

         alert("Algumas cotas já foram reservadas por outro usuário ou estão indisponíveis.");
      }
    },
    [
      raffleConfig,
      numbers,
      selectedNumbersSet,
      paymentStep,
      sessionId,
    ],
  );

  const getStyles = useCallback(
    (status: Status, id: string, isGhost?: boolean) => {
      if (selectedNumbersSet.has(id)) {
        return "bg-yellow-500 border-yellow-400 text-zinc-950 font-black shadow-lg shadow-yellow-500/25 scale-[1.03] z-10 hover:bg-yellow-400";
      }

      if (isGhost) {
        return "bg-zinc-900/[0.04] border-dashed border-zinc-900/[0.15] text-zinc-500/15 cursor-not-allowed pointer-events-none scale-95 opacity-20 filter saturate-50 select-none";
      }

      switch (status) {
        case "paid":
          return "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 cursor-not-allowed";
        case "bonus_paid":
          return "bg-fuchsia-600/20 border-fuchsia-500/50 text-fuchsia-300 font-black cursor-not-allowed shadow-md shadow-fuchsia-500/15";
        case "bonus_reserved":
          return "bg-purple-500/20 border-purple-500/40 text-purple-300 font-bold cursor-not-allowed shadow-sm shadow-purple-500/10";
        case "reserved":
        case "pending_payment":
          return "bg-orange-500/10 border-orange-500/25 text-orange-400 cursor-not-allowed";
        default:
          return (raffleConfig.isActive && raffleConfig.isRaffleActive !== false)
            ? "bg-zinc-900 border-zinc-800/85 hover:border-yellow-500/30 hover:bg-zinc-800 text-zinc-300"
            : "bg-zinc-900/50 border-zinc-900 text-zinc-700 cursor-not-allowed";
      }
    },
    [selectedNumbersSet, raffleConfig.isActive, raffleConfig.isRaffleActive],
  );

  const isSelectionChanged = useMemo(() => {
    if (paymentStep !== "pix") return false;
    const selectedSorted = [...selectedNumbers].sort().join(",");
    const submittedSorted = [...submittedNumbers].sort().join(",");
    return selectedSorted !== submittedSorted && selectedNumbers.length > 0;
  }, [selectedNumbers, submittedNumbers, paymentStep]);

  const totalAmount =
    paymentStep === "finished"
      ? (mpPaymentInfo?.val ?? (submittedNumbers.filter((n) => !mpPaymentInfo?.bonusNums?.includes(n)).length * raffleConfig.price))
      : selectedNumbers.length * raffleConfig.price;

  const whatsappPhone = useMemo(() => {
    const rawVal = raffleConfig.pixPhone || raffleConfig.pixKey || "5563999659203";
    const cleaned = rawVal.replace(/\D/g, "");
    if (cleaned.length === 10 || cleaned.length === 11) {
      return "55" + cleaned;
    }
    return cleaned;
  }, [raffleConfig.pixPhone, raffleConfig.pixKey]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-orange-500/30">
      
      {/* Global Toast */}
      <AnimatePresence>
        {globalToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -20, x: "-50%" }}
            className={`fixed top-8 left-1/2 z-[9999] px-6 py-3.5 rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.5)] font-semibold text-sm flex items-center justify-center text-center gap-3 w-max max-w-[90vw] border backdrop-blur-xl ${
              globalToast.type === 'error' ? 'bg-red-500/20 border-red-500/50 text-red-100' :
              globalToast.type === 'success' ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-100' :
              'bg-zinc-800 border-zinc-700 text-zinc-100'
            }`}
          >
            {globalToast.type === 'error' ? <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" /> : null}
            {globalToast.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : null}
            {globalToast.message}
          </motion.div>
        )}
      </AnimatePresence>

      <main className="pb-32">
        {(!isConfigLoaded || loadingRaffles) && (
          <div className="max-w-7xl mx-auto px-4 mt-12 flex flex-col items-center justify-center min-h-[300px]">
            <div className="w-12 h-12 rounded-full border-4 border-zinc-800 border-t-orange-500 animate-spin" />
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-6 animate-pulse">
              Carregando Rifas em tempo real...
            </p>
          </div>
        )}

        {isConfigLoaded && !loadingRaffles && selectedCustomerRaffleId === null && (
          <div className="flex flex-col bg-[#050505] min-h-screen text-white select-none font-montserrat">
            
            {/* 1. HERO / CAPA */}
            <section className="relative min-h-[500px] sm:min-h-[560px] lg:min-h-[620px] flex items-center justify-start overflow-hidden border-b border-[#121212] bg-[#050505]">
              {/* Background cover image matching lakeside sunset dock with fishing gear, reel, compass & camping tent */}
              <div className="absolute inset-0 z-0">
                <picture className="absolute inset-0 w-full h-full block">
                  <source 
                    media="(max-width: 767px)" 
                    srcSet={raffleConfig?.heroBgUrl || "https://images.unsplash.com/photo-1510312305653-8ed496efae75?q=80&w=1080&auto=format&fit=crop"} 
                  />
                  <source 
                    media="(max-width: 1023px)" 
                    srcSet={raffleConfig?.heroBgUrl || "https://images.unsplash.com/photo-1510312305653-8ed496efae75?q=80&w=1400&auto=format&fit=crop"} 
                  />
                  <img 
                    src={raffleConfig?.heroBgUrl || "https://images.unsplash.com/photo-1510312305653-8ed496efae75?q=80&w=2000&auto=format&fit=crop"} 
                    alt="Pesca e Camping Premium Rifa Master" 
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover opacity-65 md:opacity-80 object-right md:object-center transition-all duration-700"
                  />
                </picture>
                {/* Responsive dark gradient overlays ensuring high text contrast while keeping golden sunset & gear visible */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#050505] via-[#050505]/90 sm:via-[#050505]/75 md:via-[#050505]/45 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-[#050505]/60 opacity-90" />
                <div className="absolute right-[-5%] bottom-[-5%] w-[50%] h-[50%] bg-[#f59e0b]/5 rounded-full blur-[100px] pointer-events-none" />
              </div>

              {/* Clean Left-aligned Hero Content */}
              <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 py-12 lg:py-20 w-full">
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.7 }}
                  className="max-w-2xl text-left"
                >
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 text-amber-400 text-[10px] sm:text-xs font-black uppercase tracking-widest mb-4 sm:mb-6 shadow-lg shadow-amber-500/5 select-none">
                    <Compass className="w-3.5 h-3.5 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
                    <span>RIFA MASTER — PESCA &amp; CAMPING PREMIUM</span>
                  </div>

                  <span className="text-[10px] sm:text-xs font-black text-amber-400/90 tracking-[0.25em] uppercase block mb-2 sm:mb-3">
                    OS MELHORES ITENS DE
                  </span>
                  <h2 className="text-4xl xs:text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.88] uppercase text-white mb-2 font-montserrat">
                    <span className="text-amber-400 block">PESCA E</span>
                    <span className="block">CAMPING</span>
                  </h2>
                  <div className="text-lg sm:text-2xl md:text-3xl font-serif italic text-amber-100/90 tracking-wide font-normal lowercase mb-4 sm:mb-6 leading-none mt-1">
                    em sorteios premium!
                  </div>

                  <p className="text-zinc-300 text-xs sm:text-sm md:text-base font-medium leading-relaxed max-w-lg mb-6 sm:mb-8">
                    Participe dos nossos sorteios e concorra a equipamentos de Pesca, Camping e Outdoor das marcas mais cobiçadas do mundo de forma 100% auditável.
                  </p>

                  <div className="flex flex-col sm:flex-row gap-3.5 sm:gap-4 items-stretch sm:items-center">
                    <button
                      onClick={() => {
                        document.getElementById("rifas-section")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="w-full sm:w-auto bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-wider py-3.5 sm:py-4 px-8 rounded-xl shadow-lg shadow-amber-500/20 transition-all duration-300 transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Ticket className="w-4 h-4" />
                      <span>VER RIFAS</span>
                    </button>
                    <button
                      onClick={() => {
                        document.getElementById("como-funciona-section")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="w-full sm:w-auto bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white font-black uppercase text-xs tracking-wider py-3.5 sm:py-4 px-8 rounded-xl transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 backdrop-blur-sm"
                    >
                      <Play className="w-4 h-4 text-zinc-400 fill-zinc-400" />
                      <span>COMO FUNCIONA</span>
                    </button>
                  </div>

                  {/* Trust indicator right under buttons */}
                  <div className="mt-6 sm:mt-8 flex items-center gap-2.5 text-zinc-400 text-[11px] sm:text-xs font-semibold uppercase tracking-wider select-none">
                    <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>100% Seguro • Ambiente protegido e transações seguras</span>
                  </div>
                </motion.div>
              </div>
            </section>

            {/* FEATURES RIBBON (MOCKUP RIBBON) */}
            <div className="bg-[#070707] border-b border-[#121212] py-4 sm:py-6 px-2 sm:px-4 relative z-10 select-none">
              <div className="max-w-7xl mx-auto grid grid-cols-4 gap-1 sm:gap-4 divide-x divide-zinc-900/35">
                <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-1 sm:gap-4 px-1 sm:px-4 w-full">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                    <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="flex flex-col items-center sm:items-start">
                    <h5 className="text-[7.5px] xs:text-[9px] sm:text-[11px] font-extrabold sm:font-black text-white uppercase tracking-wider leading-none sm:leading-tight">100% Seguro</h5>
                    <p className="hidden sm:block text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-1">Ambiente protegido e dados seguros</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-1 sm:gap-4 px-1 sm:px-4 w-full">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                    <Trophy className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="flex flex-col items-center sm:items-start">
                    <h5 className="text-[7.5px] xs:text-[9px] sm:text-[11px] font-extrabold sm:font-black text-white uppercase tracking-wider leading-none sm:leading-tight">Resultado ao Vivo</h5>
                    <p className="hidden sm:block text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-1">Acompanhe o sorteio em tempo real</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-1 sm:gap-4 px-1 sm:px-4 w-full">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                    <Award className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="flex flex-col items-center sm:items-start">
                    <h5 className="text-[7.5px] xs:text-[9px] sm:text-[11px] font-extrabold sm:font-black text-white uppercase tracking-wider leading-none sm:leading-tight">Prêmios Premium</h5>
                    <p className="hidden sm:block text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-1">Equipamentos selecionados originais</p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-1 sm:gap-4 px-1 sm:px-4 w-full">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                    <MessageCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  </div>
                  <div className="flex flex-col items-center sm:items-start">
                    <h5 className="text-[7.5px] xs:text-[9px] sm:text-[11px] font-extrabold sm:font-black text-white uppercase tracking-wider leading-none sm:leading-tight">Suporte Dedicado</h5>
                    <p className="hidden sm:block text-zinc-500 text-[10px] uppercase font-bold tracking-widest mt-1">Atendimento rápido e humanizado</p>
                  </div>
                </div>
              </div>
            </div>

            {/* 2. RIFAS EM DESTAQUE */}
            <section id="rifas-section" className="py-10 sm:py-16 max-w-7xl mx-auto px-4 w-full border-b border-[#121212]">
              <div className="text-center max-w-2xl mx-auto mb-10">
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                  Rifas em destaque
                </h3>
                <div className="w-12 h-1 bg-amber-500 mx-auto mt-3 mb-4 rounded-full" />
                <p className="text-zinc-400 text-xs sm:text-sm tracking-wide">
                  Equipamentos selecionados para pesca, camping e aventura.
                </p>
              </div>

              {activeRaffles.length === 0 ? (
                <div className="max-w-2xl mx-auto bg-[#0A0A0A] border border-zinc-800/80 rounded-2xl p-8 sm:p-10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 bg-amber-500 h-full" />
                  <div className="flex flex-col sm:flex-row items-start gap-5">
                    <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 shrink-0">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-lg font-black text-white mb-2 uppercase tracking-wide">Campanhas em Preparação</h4>
                      <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed mb-6">
                        Nossa equipe está selecionando os melhores equipamentos de pesca e aventura para os próximos sorteios. Participe do nosso grupo de membros VIP para receber as novidades e ter acesso antecipado às cotas!
                      </p>
                      {raffleConfig.whatsappGroupUrl && (
                        <a
                          href={raffleConfig.whatsappGroupUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-[#25D366] hover:bg-[#20ba5a] text-white font-black uppercase text-xs py-3 px-5 rounded-xl shadow-lg transition-all cursor-pointer"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>Entrar no Grupo VIP</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative group/carousel max-w-6xl mx-auto px-2 md:px-12">
                  {/* Left Navigation Button */}
                  <button 
                    onClick={scrollCarouselLeft}
                    className={`absolute -left-2 md:left-0 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-zinc-950/90 border border-zinc-800 text-zinc-400 hover:text-amber-400 hover:border-amber-500/50 flex items-center justify-center backdrop-blur-md shadow-2xl transition-all duration-300 opacity-0 group-hover/carousel:opacity-100 focus:opacity-100 cursor-pointer disabled:opacity-0 disabled:pointer-events-none`}
                    disabled={!canScrollLeft}
                    aria-label="Voltar rifa"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>

                  {/* Scrollable track */}
                  <div 
                    ref={customerCarouselRef}
                    onScroll={handleCarouselScroll}
                    className="flex overflow-x-auto gap-6 pb-6 pt-2 scroll-smooth snap-x snap-mandatory scrollbar-none"
                    style={{
                      maskImage: "linear-gradient(to right, transparent, white 5%, white 95%, transparent)",
                      WebkitMaskImage: "linear-gradient(to right, transparent, white 5%, white 95%, transparent)"
                    }}
                  >
                    {activeRaffles.map((raffle, index) => {
                      const stats = activeRafflesStats[raffle.id] || { soldCount: 0, percentSold: 0, remainingCount: Number(raffle.totalNumbers || 100) };
                      const isQuaseEncerrada = stats.percentSold >= 80;
                      const isSelected = activeSlideIndex === index;
                      
                      return (
                        <div 
                          key={raffle.id}
                          className={`bg-[#0A0A0A] border ${
                            isSelected ? "border-amber-500/60 shadow-[0_15px_40px_rgba(245,158,11,0.06)]" : "border-zinc-900 hover:border-amber-500/25"
                          } rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 flex flex-col justify-between group relative w-[88vw] xs:w-[82vw] sm:w-[380px] md:w-[360px] lg:w-[380px] shrink-0 snap-center transform ${
                            isSelected ? "scale-[1.01] z-10" : "scale-[0.98] opacity-80 hover:opacity-100"
                          }`}
                        >
                          {/* Card Image */}
                          <div 
                            className="relative h-56 sm:h-64 w-full overflow-hidden bg-zinc-950 cursor-pointer"
                            onClick={() => {
                              const targetSlug = raffle.slug || slugify(raffle.title) || raffle.id;
                              window.history.pushState(null, "", "/" + targetSlug);
                              if (setCurrentPath) setCurrentPath("/" + targetSlug);
                              setSelectedCustomerRaffleId(raffle.id);
                              setSelectedRaffleId(raffle.id);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                          >
                            {raffle.imageUrl ? (
                              <img 
                                src={raffle.imageUrl} 
                                alt={raffle.title} 
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-700">
                                <Ticket className="w-12 h-12 opacity-30 text-amber-400 mb-2" />
                                <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Sem Imagem</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-black/30 pointer-events-none" />
                            
                            {/* Status Badge */}
                            <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5 items-start">
                              {(raffle.isDestaque || raffle.isFeatured) && (
                                <div className="bg-gradient-to-r from-amber-400 to-amber-500 text-black text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-lg shadow-amber-500/20 flex items-center gap-1 border border-amber-300">
                                  <Star className="w-3 h-3 fill-black text-black" />
                                  <span>Destaque</span>
                                </div>
                              )}
                              {isQuaseEncerrada ? (
                                <div className="bg-amber-500 text-black text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
                                  <span>Quase Encerrada</span>
                                </div>
                              ) : (
                                <div className="bg-amber-500 text-black text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-lg flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-black animate-pulse" />
                                  <span>Disponível</span>
                                </div>
                              )}
                            </div>

                            {/* Draw Mode Badge */}
                            <div className="absolute top-4 right-4 z-10 bg-zinc-950/80 border border-zinc-800 text-zinc-300 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full shadow-md">
                              {raffle.drawMode === "federal" ? "🎰 Loteria Federal" : "⚡ Sorteio Automático"}
                            </div>

                            {/* Price Tag */}
                            <div className="absolute bottom-4 right-4 bg-zinc-950/95 border border-amber-500/30 text-amber-400 font-black text-xs px-3.5 py-1.5 rounded-xl shadow-lg backdrop-blur-md">
                              Cota a partir de <span className="text-sm">R$ {Number(raffle.price || 10).toFixed(2).replace(".", ",")}</span>
                            </div>
                          </div>

                          {/* Card Content */}
                          <div className="p-6 flex-1 flex flex-col justify-between space-y-5">
                            <div>
                              <div className="text-[9px] text-amber-400 font-extrabold uppercase tracking-widest mb-1.5">
                                {raffle.drawMode === "federal" ? "Sorteio Oficial" : "Sorteio Criptográfico"}
                              </div>
                              <h4 className="text-lg font-extrabold text-white group-hover:text-amber-400 transition-colors line-clamp-2 leading-snug">
                                {raffle.title}
                              </h4>
                              {raffle.description && (
                                <p className="text-xs text-zinc-500 line-clamp-2 mt-2 leading-relaxed">
                                  {raffle.description}
                                </p>
                              )}
                            </div>

                            <div className="space-y-3 pt-4 border-t border-zinc-900">
                              {/* Progress details */}
                              <div className="flex justify-between items-end text-xs">
                                <span className="text-zinc-500 font-semibold uppercase tracking-wider text-[10px]">
                                  Progresso
                                </span>
                                <span className="text-amber-400 font-black text-sm">{stats.percentSold.toFixed(1)}%</span>
                              </div>
                              <div className="w-full h-2 bg-zinc-950 rounded-full overflow-hidden border border-zinc-900 p-0.5">
                                <div 
                                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 rounded-full transition-all duration-500"
                                  style={{ width: `${Math.max(4, stats.percentSold)}%` }}
                                />
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2.5 pt-1">
                              <button
                                onClick={() => {
                                  const targetSlug = raffle.slug || slugify(raffle.title) || raffle.id;
                                  window.history.pushState(null, "", "/" + targetSlug);
                                  if (setCurrentPath) setCurrentPath("/" + targetSlug);
                                  setSelectedCustomerRaffleId(raffle.id);
                                  setSelectedRaffleId(raffle.id);
                                  window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs py-3.5 px-4 rounded-xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                              >
                                <span>Participar</span>
                                <ArrowRight className="w-4 h-4 shrink-0" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const targetSlug = raffle.slug || slugify(raffle.title) || raffle.id;
                                  const shareUrl = `${window.location.origin}/${targetSlug}`;
                                  safeCopyToClipboard(shareUrl);
                                  setGlobalToast({ message: "🔗 Link da rifa copiado com sucesso!", type: "success" });
                                }}
                                className="p-3.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 hover:border-amber-500/30 text-zinc-400 hover:text-amber-400 rounded-xl transition-all cursor-pointer flex items-center justify-center shrink-0"
                                title="Compartilhar"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Navigation Button */}
                  <button 
                    onClick={scrollCarouselRight}
                    className={`absolute -right-2 md:right-0 top-1/2 -translate-y-1/2 z-20 w-12 h-12 rounded-full bg-zinc-950/90 border border-zinc-800 text-zinc-400 hover:text-amber-400 hover:border-amber-500/50 flex items-center justify-center backdrop-blur-md shadow-2xl transition-all duration-300 opacity-0 group-hover/carousel:opacity-100 focus:opacity-100 cursor-pointer disabled:opacity-0 disabled:pointer-events-none`}
                    disabled={!canScrollRight}
                    aria-label="Avançar rifa"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>

                  {/* Indicator Dots */}
                  {activeRaffles.length > 1 && (
                    <div className="flex justify-center items-center gap-2.5 mt-8 select-none">
                      {activeRaffles.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => scrollCarouselToSlide(idx)}
                          className={`h-2 rounded-full transition-all duration-300 ${
                            activeSlideIndex === idx ? "w-8 bg-amber-500" : "w-2 bg-zinc-800 hover:bg-zinc-700"
                          }`}
                          aria-label={`Ir para slide ${idx + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* 2.5. ÚLTIMOS GANHADORES (CARROSSEL) */}
            <section id="ganhadores-section" className="py-12 sm:py-20 bg-[#070707] border-b border-[#121212] w-full">
              <div className="max-w-7xl mx-auto px-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between mb-8 sm:mb-12 gap-4">
                  <div>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px] font-black uppercase tracking-widest mb-3">
                      <Trophy className="w-3.5 h-3.5" />
                      <span>Contemplados REAIS</span>
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                      Últimos Ganhadores
                    </h3>
                    <p className="text-zinc-400 text-xs sm:text-sm tracking-wide mt-1">
                      Confira as pessoas reais contempladas nos nossos sorteios de pesca e camping.
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      window.history.pushState(null, "", "/hall-da-fama");
                      if (setCurrentPath) setCurrentPath("/hall-da-fama");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-zinc-300 hover:text-amber-400 px-4 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer shadow-lg shrink-0"
                  >
                    <span>Ver Hall da Fama</span>
                    <ArrowRight className="w-4 h-4 text-amber-400" />
                  </button>
                </div>

                {/* Winners Carousel Track */}
                <div className="relative group/winners-carousel max-w-7xl mx-auto">
                  {/* Left Navigation Button */}
                  <button 
                    onClick={scrollWinnersLeft}
                    className="absolute -left-2 md:-left-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-zinc-950/90 border border-zinc-800 text-zinc-400 hover:text-amber-400 hover:border-amber-500/50 flex items-center justify-center backdrop-blur-md shadow-2xl transition-all duration-300 opacity-0 group-hover/winners-carousel:opacity-100 focus:opacity-100 cursor-pointer disabled:opacity-0 disabled:pointer-events-none"
                    disabled={!canScrollWinnersLeft}
                    aria-label="Voltar ganhadores"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>

                  {/* Scrollable track */}
                  <div 
                    ref={winnersCarouselRef}
                    onScroll={handleWinnersCarouselScroll}
                    className="flex overflow-x-auto gap-5 pb-4 pt-1 scroll-smooth snap-x snap-mandatory scrollbar-none"
                  >
                    {displayWinners.map((winner, idx) => {
                      const isDestaque = winner.status === "Destaque";
                      return (
                        <div
                          key={winner.id || idx}
                          onClick={() => setSelectedWinnerModal(winner)}
                          className={`bg-[#0A0A0A] border ${
                            isDestaque 
                              ? "border-amber-500/40 hover:border-amber-400/70 shadow-[0_10px_30px_rgba(245,158,11,0.08)]" 
                              : "border-zinc-900 hover:border-amber-500/30"
                          } rounded-2xl overflow-hidden shadow-2xl transition-all duration-300 group/wcard cursor-pointer w-[82vw] xs:w-[75vw] sm:w-[320px] md:w-[340px] shrink-0 snap-center flex flex-col justify-between`}
                        >
                          {/* Image banner */}
                          <div className="relative h-44 sm:h-48 w-full overflow-hidden bg-zinc-950">
                            {winner.prizeImageUrl ? (
                              <img
                                src={winner.prizeImageUrl}
                                alt={winner.prizeTitle}
                                referrerPolicy="no-referrer"
                                className="w-full h-full object-cover group-hover/wcard:scale-105 transition-transform duration-500"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 text-zinc-700">
                                <Trophy className="w-10 h-10 text-amber-500/40 mb-1" />
                                <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">Sem Imagem</span>
                              </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-black/20 to-transparent pointer-events-none" />

                            {/* Badge Destaque or Ganhador */}
                            <div className="absolute top-3 left-3 z-10">
                              <div className="bg-amber-500 text-black text-[9.5px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1">
                                <Trophy className="w-3 h-3 fill-black" />
                                <span>Contemplado</span>
                              </div>
                            </div>

                            {/* Cota Tag */}
                            <div className="absolute bottom-3 right-3 z-10 bg-zinc-950/90 border border-amber-500/40 text-amber-400 text-[11px] font-mono font-black px-3 py-1 rounded-xl shadow-lg backdrop-blur-md">
                              Cota nº {winner.winnerNumber || "---"}
                            </div>
                          </div>

                          {/* Card Body */}
                          <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                            <div>
                              <h4 className="text-base font-extrabold text-white group-hover/wcard:text-amber-400 transition-colors line-clamp-1">
                                {winner.prizeTitle}
                              </h4>
                              {winner.drawDate && (
                                <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-bold uppercase tracking-wider mt-1">
                                  <Calendar className="w-3 h-3 text-zinc-600" />
                                  <span>Sorteado em {winner.drawDate}</span>
                                </div>
                              )}
                            </div>

                            {/* Winner Profile */}
                            <div className="bg-zinc-950/80 border border-zinc-900 p-3 rounded-xl flex items-center gap-3">
                              {winner.winnerImageUrl ? (
                                <img
                                  src={winner.winnerImageUrl}
                                  alt={winner.winnerName}
                                  referrerPolicy="no-referrer"
                                  className="w-9 h-9 rounded-full object-cover border-2 border-amber-500 shrink-0"
                                />
                              ) : (
                                <div className="w-9 h-9 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black text-xs shrink-0">
                                  🏆
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-black text-white truncate uppercase">
                                  {winner.winnerName || "Ganhador Anônimo"}
                                </p>
                                <p className="text-[10px] text-zinc-500 font-bold truncate uppercase">
                                  {winner.city ? `${winner.city}${winner.state ? ` - ${winner.state}` : ''}` : "Brasil"}
                                </p>
                              </div>
                            </div>

                            {/* CTA */}
                            <button
                              type="button"
                              className="w-full bg-zinc-900 hover:bg-amber-500 text-zinc-300 hover:text-black font-black uppercase text-[10px] tracking-wider py-2.5 rounded-xl border border-zinc-800 hover:border-amber-500 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <span>Ver Detalhes do Prêmio</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Right Navigation Button */}
                  <button 
                    onClick={scrollWinnersRight}
                    className="absolute -right-2 md:-right-4 top-1/2 -translate-y-1/2 z-20 w-11 h-11 rounded-full bg-zinc-950/90 border border-zinc-800 text-zinc-400 hover:text-amber-400 hover:border-amber-500/50 flex items-center justify-center backdrop-blur-md shadow-2xl transition-all duration-300 opacity-0 group-hover/winners-carousel:opacity-100 focus:opacity-100 cursor-pointer disabled:opacity-0 disabled:pointer-events-none"
                    disabled={!canScrollWinnersRight}
                    aria-label="Avançar ganhadores"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </div>
              </div>
            </section>

            {/* 3. CATEGORIAS */}
            <section id="categories-section" className="py-20 sm:py-28 max-w-7xl mx-auto px-4 w-full border-b border-[#121212]">
              <div className="text-center max-w-2xl mx-auto mb-16">
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                  Categorias de Equipamentos
                </h3>
                <div className="w-12 h-1 bg-amber-500 mx-auto mt-3 mb-4 rounded-full" />
                <p className="text-zinc-400 text-xs sm:text-sm tracking-wide">
                  Nossos prêmios são focados nas principais vertentes de vida selvagem e outdoor.
                </p>
              </div>

              <div className="flex overflow-x-auto pb-4 gap-6 scrollbar-thin scrollbar-thumb-zinc-850 scrollbar-track-transparent snap-x snap-mandatory md:grid md:grid-cols-3 md:gap-8 md:overflow-visible md:pb-0">
                {/* CATEGORY 1 */}
                <div className="bg-[#0A0A0A] border border-zinc-900 rounded-2xl p-6 sm:p-8 hover:border-amber-500/20 hover:shadow-[0_15px_30px_rgba(0,0,0,0.5)] transition-all duration-300 group shrink-0 w-[82%] sm:w-[280px] md:w-auto snap-center">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 text-2xl font-bold mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                    🎣
                  </div>
                  <h4 className="text-base sm:text-lg font-extrabold text-white mb-2 uppercase tracking-wide">Pesca Esportiva</h4>
                  <p className="text-zinc-500 text-xs sm:text-sm leading-relaxed">
                    Varas de fibra de carbono, carretilhas importadas, conjuntos profissionais de fly e iscas de alta performance.
                  </p>
                </div>

                {/* CATEGORY 2 */}
                <div className="bg-[#0A0A0A] border border-zinc-900 rounded-2xl p-6 sm:p-8 hover:border-amber-500/20 hover:shadow-[0_15px_30px_rgba(0,0,0,0.5)] transition-all duration-300 group shrink-0 w-[82%] sm:w-[280px] md:w-auto snap-center">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 text-2xl font-bold mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                    🏕️
                  </div>
                  <h4 className="text-base sm:text-lg font-extrabold text-white mb-2 uppercase tracking-wide">Camping & Outdoor</h4>
                  <p className="text-zinc-500 text-xs sm:text-sm leading-relaxed">
                    Barracas técnicas ultra-leves, sacos de dormir térmicos, fogareiros portáteis e isolantes auto-infláveis.
                  </p>
                </div>

                {/* CATEGORY 3 */}
                <div className="bg-[#0A0A0A] border border-zinc-900 rounded-2xl p-6 sm:p-8 hover:border-amber-500/20 hover:shadow-[0_15px_30px_rgba(0,0,0,0.5)] transition-all duration-300 group shrink-0 w-[82%] sm:w-[280px] md:w-auto snap-center">
                  <div className="w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 text-2xl font-bold mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
                    🧭
                  </div>
                  <h4 className="text-base sm:text-lg font-extrabold text-white mb-2 uppercase tracking-wide">Aventura & Sobrevivência</h4>
                  <p className="text-zinc-500 text-xs sm:text-sm leading-relaxed">
                    Mochilas cargueiras de alta durabilidade, facas esportivas de aço damasco, lanternas táticas e kits EDC de sobrevivência.
                  </p>
                </div>
              </div>
            </section>

            {/* 4. COMO FUNCIONA */}
            <section id="como-funciona-section" className="py-20 sm:py-28 max-w-7xl mx-auto px-4 w-full border-b border-[#121212]">
              <div className="text-center max-w-2xl mx-auto mb-16">
                <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">
                  Sua jornada rumo ao prêmio
                </h3>
                <div className="w-12 h-1 bg-amber-500 mx-auto mt-3 mb-4 rounded-full" />
                <p className="text-zinc-400 text-xs sm:text-sm tracking-wide">
                  É extremamente simples e 100% transparente participar das nossas campanhas.
                </p>
              </div>

              <div className="flex overflow-x-auto pb-4 gap-4 scrollbar-thin scrollbar-thumb-zinc-850 scrollbar-track-transparent snap-x snap-mandatory lg:grid lg:grid-cols-5 lg:gap-6 lg:overflow-visible lg:pb-0">
                {/* STEP 1 */}
                <div className="bg-[#0A0A0A] border border-zinc-900 rounded-2xl p-6 relative overflow-hidden shrink-0 w-[78%] sm:w-[220px] lg:w-auto snap-center">
                  <div className="text-amber-500/10 font-black text-7xl absolute -right-3 -top-3">01</div>
                  <h5 className="text-sm font-black text-white uppercase tracking-wider mb-2 relative z-10 pt-4">Escolha seu prêmio</h5>
                  <p className="text-zinc-500 text-[11px] sm:text-xs leading-relaxed">
                    Navegue pelas campanhas e encontre o equipamento ideal para sua próxima aventura selvagem.
                  </p>
                </div>

                {/* STEP 2 */}
                <div className="bg-[#0A0A0A] border border-zinc-900 rounded-2xl p-6 relative overflow-hidden shrink-0 w-[78%] sm:w-[220px] lg:w-auto snap-center">
                  <div className="text-amber-500/10 font-black text-7xl absolute -right-3 -top-3">02</div>
                  <h5 className="text-sm font-black text-white uppercase tracking-wider mb-2 relative z-10 pt-4">Escolha suas cotas</h5>
                  <p className="text-zinc-500 text-[11px] sm:text-xs leading-relaxed">
                    Selecione quantos números deseja comprar para potencializar suas chances de ganhar.
                  </p>
                </div>

                {/* STEP 3 */}
                <div className="bg-[#0A0A0A] border border-zinc-900 rounded-2xl p-6 relative overflow-hidden shrink-0 w-[78%] sm:w-[220px] lg:w-auto snap-center">
                  <div className="text-amber-500/10 font-black text-7xl absolute -right-3 -top-3">03</div>
                  <h5 className="text-sm font-black text-white uppercase tracking-wider mb-2 relative z-10 pt-4">Faça o pagamento</h5>
                  <p className="text-zinc-500 text-[11px] sm:text-xs leading-relaxed">
                    Efetue o pagamento por Pix de forma rápida e segura, com compensação automática.
                  </p>
                </div>

                {/* STEP 4 */}
                <div className="bg-[#0A0A0A] border border-zinc-900 rounded-2xl p-6 relative overflow-hidden shrink-0 w-[78%] sm:w-[220px] lg:w-auto snap-center">
                  <div className="text-amber-500/10 font-black text-7xl absolute -right-3 -top-3">04</div>
                  <h5 className="text-sm font-black text-white uppercase tracking-wider mb-2 relative z-10 pt-4">Acompanhe</h5>
                  <p className="text-zinc-500 text-[11px] sm:text-xs leading-relaxed">
                    Monitore a venda das cotas em tempo real e verifique os detalhes publicados na plataforma.
                  </p>
                </div>

                {/* STEP 5 */}
                <div className="bg-[#0A0A0A] border border-zinc-900 rounded-2xl p-6 relative overflow-hidden shrink-0 w-[78%] sm:w-[220px] lg:w-auto snap-center">
                  <div className="text-amber-500/10 font-black text-7xl absolute -right-3 -top-3">05</div>
                  <h5 className="text-sm font-black text-white uppercase tracking-wider mb-2 relative z-10 pt-4">Confira o resultado</h5>
                  <p className="text-zinc-500 text-[11px] sm:text-xs leading-relaxed">
                    Após o sorteio, faça a conferência transparente no nosso painel de auditoria.
                  </p>
                </div>
              </div>
            </section>

            {/* 5. AUDITORIA PÚBLICA */}
            <section id="auditoria-home-section" className="py-20 sm:py-28 max-w-7xl mx-auto px-4 w-full">
              <div className="bg-gradient-to-br from-[#0A0A0A] to-[#0D0D0D] border border-zinc-900 rounded-3xl p-8 sm:p-14 shadow-2xl relative overflow-hidden flex flex-col lg:flex-row items-center gap-12">
                <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full filter blur-3xl pointer-events-none" />
                
                <div className="space-y-6 lg:w-1/2">
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400 text-[9px] font-black uppercase tracking-wider">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Sorteio Criptográfico Seguro</span>
                  </div>
                  
                  <h3 className="text-2xl sm:text-4xl font-black text-white leading-tight uppercase tracking-tight">
                    Você não precisa apenas confiar.<br/>Você pode verificar.
                  </h3>
                  
                  <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed">
                    Após o sorteio, o Rifa Master disponibiliza todos os dados do seed secreto de forma pública. Qualquer pessoa ou auditor independente pode recalcular deterministicamente o resultado usando o algoritmo oficial de Fisher-Yates e garantir que o sorteio foi realizado sem manipulações.
                  </p>

                  <div className="space-y-3 pt-2 text-zinc-500 text-xs font-bold uppercase tracking-wider">
                    <div className="flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>Verificação SHA-256 do Seed Commitment</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>Transparência total na população participante</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      <span>Gerador de sorteio aberto e testável online</span>
                    </div>
                  </div>

                  <div className="pt-4 flex flex-wrap gap-3">
                    <button
                      onClick={() => setIsAuditModalOpen(true)}
                      className="bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-wider py-4 px-7 rounded-xl shadow-lg shadow-amber-500/15 transition-all cursor-pointer inline-flex items-center gap-2 active:scale-95"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>Sobre a Auditoria</span>
                    </button>
                    <button
                      onClick={() => {
                        window.history.pushState({}, "", "/auditoria");
                        setCurrentPath("/auditoria");
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      className="bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-zinc-300 hover:text-white font-black uppercase text-xs tracking-wider py-4 px-7 rounded-xl transition-all cursor-pointer inline-flex items-center gap-2 active:scale-95"
                    >
                      <span>Painel de Auditoria</span>
                      <ArrowRight className="w-4 h-4 text-amber-400" />
                    </button>
                  </div>
                </div>

                <div 
                  onClick={() => setIsAuditModalOpen(true)}
                  className="lg:w-1/2 flex justify-center w-full cursor-pointer group/term"
                >
                  <div className="bg-[#050505] border border-zinc-850 group-hover/term:border-amber-500/50 rounded-2xl p-6 w-full max-w-md shadow-2xl relative transition-all duration-300 group-hover/term:shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                    <div className="flex items-center justify-between border-b border-zinc-900 pb-4 mb-4">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                      </div>
                      <span className="text-[10px] text-zinc-600 group-hover/term:text-amber-400 font-extrabold uppercase tracking-widest font-mono transition-colors">PROVABLY_FAIR_VERIFIER (Clique para Detalhes)</span>
                    </div>
                    <div className="space-y-4 font-mono text-[10px] text-zinc-400">
                      <div>
                        <div className="text-zinc-600 mb-1">// Commitment do Sorteio (Gerado pré-vendas)</div>
                        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-900 text-zinc-400 select-all truncate">
                          SHA256: d04b98fec3dc6509f62c08cc681a...
                        </div>
                      </div>
                      <div>
                        <div className="text-zinc-600 mb-1">// Revelação do Seed (Após encerramento)</div>
                        <div className="bg-zinc-950 p-2.5 rounded border border-zinc-900 text-amber-400 select-all truncate">
                          SEED: e9a2c3fb107d...
                        </div>
                      </div>
                      <div className="pt-2 border-t border-zinc-900 flex justify-between items-center">
                        <span className="text-emerald-500 font-black flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>INTEGRIDADE CONFIRMADA</span>
                        </span>
                        <span className="text-zinc-600">v1.0.0</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

          </div>
        )}

        {isConfigLoaded && !loadingRaffles && selectedCustomerRaffleId !== null && (
          <>
            <div className="max-w-7xl mx-auto px-4 pt-4 sm:pt-6 pb-2 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    window.history.pushState(null, "", "/");
                    if (setCurrentPath) setCurrentPath("/");
                    setSelectedCustomerRaffleId(null);
                    clearMyLocks();
                    setSelectedNumbers([]);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="inline-flex items-center gap-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-amber-500/40 text-zinc-300 hover:text-amber-400 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer shadow-lg active:scale-95"
                >
                  <ArrowLeft className="w-4 h-4 text-amber-400" />
                  <span>Voltar para Rifas</span>
                </button>

                <button
                  onClick={() => {
                    const targetSlug = raffleConfig.slug || slugify(raffleConfig.title || "") || selectedCustomerRaffleId || "rifa";
                    const shareUrl = `${window.location.origin}/${targetSlug}`;
                    safeCopyToClipboard(shareUrl);
                    setGlobalToast({ message: "🔗 Link direto da rifa copiado!", type: "success" });
                  }}
                  className="inline-flex items-center gap-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 px-3.5 py-2.5 rounded-xl font-bold text-xs transition-all cursor-pointer"
                  title="Copiar link direto para compartilhar esta rifa"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Copiar Link</span>
                </button>
              </div>

              <div className="text-right">
                <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold block">Rifa Selecionada</span>
                <span className="text-xs sm:text-sm font-extrabold text-amber-400">{raffleConfig.title}</span>
              </div>
            </div>

            {raffleConfig.winnerNumber ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, type: "spring" }}
                className="max-w-7xl mx-auto px-4 py-16 sm:py-24"
              >
                <div className="bg-gradient-to-br from-amber-500/10 via-zinc-900 to-amber-500/5 border-2 border-amber-500/30 rounded-[2.5rem] p-5 sm:p-10 md:p-14 relative overflow-hidden shadow-[0_0_50px_-12px_rgba(245,158,11,0.25)] flex flex-col md:flex-row items-center justify-between gap-8 min-h-[400px]">
                  <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none animate-pulse">
                    <PartyPopper className="w-64 h-64 text-amber-400" />
                  </div>
                  <div className="absolute -bottom-16 -left-16 w-80 h-80 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

                  <div className="flex items-center gap-8 flex-col sm:flex-row text-center sm:text-left relative z-10">
                    <motion.div
                      animate={{
                        rotate: [0, -10, 10, -10, 10, 0],
                        scale: [1, 1.1, 1.1, 1.1, 1],
                      }}
                      transition={{
                        repeat: Infinity,
                        duration: 4,
                        repeatDelay: 2,
                      }}
                      className="bg-amber-500/20 text-amber-400 w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center shrink-0 border border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]"
                    >
                      <Trophy className="w-10 h-10 sm:w-12 sm:h-12" />
                    </motion.div>
                    <div>
                      <span className="bg-amber-500/15 text-amber-400 text-xs font-black uppercase tracking-widest px-4 py-1.5 rounded-full border border-amber-500/20">
                        Sorteio Realizado 🏆
                      </span>
                      <h3 className="text-3xl sm:text-4xl md:text-5xl font-black text-white mt-4 tracking-tighter leading-none">
                        Parabéns ao Ganhador! 🎉
                      </h3>
                      <p className="text-zinc-400 text-sm sm:text-base mt-3 max-w-xl leading-relaxed">
                        Nossos sinceros parabéns para o grande felizardo(a)
                        deste sorteio especial! Entraremos em contato
                        diretamente com o proprietário(a) do bilhete premiado
                        para realizar a entrega oficial do prêmio:{" "}
                        <strong className="text-amber-400">
                          {raffleConfig.title}
                        </strong>
                        .
                      </p>
                    </div>
                  </div>

                  <div className="bg-zinc-950/50 border border-zinc-800/80 rounded-3xl p-6 sm:p-8 flex flex-col items-center sm:items-start w-full sm:w-auto min-w-0 max-w-full sm:min-w-[280px] text-center sm:text-left gap-4 relative z-10 shadow-inner">
                    <div>
                      <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-1">
                        Número Sorteado
                      </p>
                      <span className="text-5xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-amber-200">
                        {raffleConfig.winnerNumber}
                      </span>
                    </div>
                    {raffleConfig.winnerName && (
                      <div className="border-t border-zinc-800/50 pt-3 w-full">
                        <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-1">
                          Ganhador(a)
                        </p>
                        <span className="text-white font-black text-xl leading-tight block truncate">
                          {raffleConfig.winnerName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              <>
                {/* COMPACT STREAMLINED HERO & QUICK BUY SECTION */}
                <section className="max-w-7xl mx-auto px-4 pt-4 pb-2 space-y-4">
                  {/* COMPACT RAFFLE SUMMARY CARD */}
                  <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-zinc-900/90 border border-zinc-800 rounded-3xl p-4 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl"
                  >
                    <div className="flex flex-col md:flex-row items-center md:items-stretch gap-5">
                      {/* Compact Image Box */}
                      <div className="relative w-full md:w-56 lg:w-64 h-40 sm:h-44 shrink-0 rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800/80 flex items-center justify-center group">
                        {raffleConfig.imageUrl ? (
                          <>
                            <div 
                              className="absolute inset-0 bg-cover bg-center opacity-30 blur-xl scale-110 pointer-events-none select-none"
                              style={{ backgroundImage: `url(${raffleConfig.imageUrl})` }}
                            />
                            <img
                              src={raffleConfig.imageUrl}
                              alt={raffleConfig.title}
                              loading="eager"
                              fetchPriority="high"
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-contain relative z-10 transition-transform duration-500 group-hover:scale-105 p-1"
                            />
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-700">
                            <Smartphone className="w-12 h-12" />
                          </div>
                        )}

                        {/* Price Badge on image */}
                        <div className="absolute bottom-2.5 right-2.5 bg-zinc-950/90 border border-amber-500/40 text-amber-400 font-black text-xs px-3 py-1 rounded-xl shadow-lg backdrop-blur-md z-20">
                          R$ {Number(raffleConfig?.price || 10).toFixed(2).replace(".", ",")} <span className="text-[9px] text-zinc-400 font-bold">/ cota</span>
                        </div>
                      </div>

                      {/* Header Details */}
                      <div className="flex-1 flex flex-col justify-between space-y-3 w-full">
                        <div>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                             <div className="flex flex-wrap items-center gap-2">
                              {(isRaffleFullyClosed ?? false) ? (
                                <span className="bg-amber-500/15 text-amber-400 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500/30 animate-pulse">
                                  Rifa Fechada (Aguardar Sorteio)
                                </span>
                              ) : (
                                <span className="bg-amber-500/10 text-amber-400 text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider border border-amber-500/20 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3 text-amber-400" /> Rifa Ativa
                                </span>
                              )}

                              {/* Blinking Draw Mode Indicator Badge */}
                              {raffleConfig?.drawMode === "federal" ? (
                                <span className="bg-amber-500/20 text-amber-300 border border-amber-500/50 text-[10px] sm:text-xs font-black px-3 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-lg animate-pulse">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                  </span>
                                  🎰 Sorteio: Loteria Federal
                                </span>
                              ) : (
                                <span className="bg-purple-500/20 text-purple-300 border border-purple-500/50 text-[10px] sm:text-xs font-black px-3 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1.5 shadow-lg animate-pulse">
                                  <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                                  </span>
                                  ⚡ Sorteio: Automático
                                </span>
                              )}
                            </div>

                            {/* Live Sales Badge */}
                            <span className="text-[11px] font-extrabold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                              {(((stats?.countPaid ?? 0) / (raffleConfig?.totalNumbers ?? 1)) * 100).toFixed(1)}% Vendido
                            </span>
                          </div>

                          <h2 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white uppercase line-clamp-2">
                            {raffleConfig?.title || "Prêmio Especial"}
                          </h2>

                          {/* Blinking Draw Mode Banner */}
                          <div className="mt-2.5 p-2.5 sm:p-3 rounded-2xl bg-zinc-950/90 border border-zinc-800 flex items-center gap-2.5 shadow-inner">
                            <div className="shrink-0">
                              {raffleConfig?.drawMode === "federal" ? (
                                <span className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                                </span>
                              ) : (
                                <span className="relative flex h-3 w-3">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
                                </span>
                              )}
                            </div>
                            <div className="text-xs">
                              <span className={`uppercase font-black animate-pulse tracking-wide ${
                                raffleConfig?.drawMode === "federal" ? "text-amber-400" : "text-purple-400"
                              }`}>
                                {raffleConfig?.drawMode === "federal" ? "🎰 Sorteio pela Loteria Federal" : "⚡ Sorteio Automático pelo Sistema"}
                              </span>
                              <p className="text-zinc-400 text-[11px] font-medium mt-0.5">
                                {raffleConfig?.drawMode === "federal"
                                  ? "O número vencedor será apurado oficialmente com base nos resultados da Loteria Federal."
                                  : "O número vencedor é gerado e auditado automaticamente pelo sistema assim que finalizadas as vendas."}
                              </p>
                            </div>
                          </div>

                          {raffleConfig?.description && (
                            <div className="mt-2.5 pt-2 border-t border-zinc-800/60">
                              <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed whitespace-pre-line font-medium max-h-48 overflow-y-auto pr-1 [scrollbar-width:thin] [scrollbar-color:#3f3f46_transparent]">
                                {raffleConfig.description}
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Real-time Sales Progress Bar */}
                        <div className="space-y-1.5 bg-zinc-950/60 border border-zinc-800/80 rounded-2xl p-3">
                          <div className="flex justify-between items-center text-[11px] font-bold">
                            <span className="text-zinc-400 flex items-center gap-1.5">
                              <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                              <span>Progresso das Vendas:</span>
                            </span>
                            <span className="text-amber-400 font-black text-sm">
                              {(((stats?.countPaid ?? 0) / (raffleConfig?.totalNumbers ?? 1)) * 100).toFixed(1)}%
                            </span>
                          </div>
                          <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden p-0.5 border border-zinc-800">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${((stats?.countPaid ?? 0) / (raffleConfig?.totalNumbers ?? 1)) * 100}%` }}
                              transition={{ duration: 1, ease: "easeOut" }}
                              className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-amber-300 rounded-full"
                            />
                          </div>
                        </div>

                        {/* Trust Security Badges Compact Row */}
                        <div className="flex items-center gap-2 pt-1 overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden w-full">
                          {[
                            { title: "PIX Automático", color: "text-amber-400 bg-amber-500/5 border-amber-500/20" },
                            { title: "Mercado Pago Seguro", color: "text-emerald-400 bg-emerald-500/5 border-emerald-500/20" },
                            { title: "Suporte no WhatsApp", color: "text-green-400 bg-green-500/5 border-green-500/20" },
                            { title: "Atualização em Tempo Real", color: "text-blue-400 bg-blue-500/5 border-blue-500/20" },
                          ].map((trust, idx) => (
                            <div key={idx} className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border ${trust.color} text-[9px] font-extrabold uppercase tracking-wider shrink-0`}>
                              <ShieldCheck className="w-3 h-3 shrink-0" />
                              <span>{trust.title}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* HIGH-PRIORITY "COMPRA RÁPIDA" (QUICK BUY) PANEL */}
                  <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 }}
                    className={`bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-amber-500/10 border-2 border-amber-500/40 rounded-3xl p-4 sm:p-5 shadow-[0_0_30px_rgba(245,158,11,0.15)] relative overflow-hidden ${(isRaffleFullyClosed || (raffleConfig?.isRaffleActive ?? false) === false) ? "opacity-40 select-none pointer-events-none" : ""}`}
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Zap className="w-4 h-4 text-amber-400 animate-bounce" />
                          <h3 className="text-sm sm:text-base font-black uppercase tracking-wider text-white">
                            ⚡ Compra Rápida de Cotas
                          </h3>
                        </div>
                        <p className="text-zinc-400 text-xs font-semibold">
                          Selecione a quantidade de bilhetes para acelerar sua compra:
                        </p>
                      </div>

                      {/* Quick Pack Buttons with estimated price labels */}
                      <div className="flex flex-wrap items-center gap-2">
                        {[3, 5, 10, 20, 50, 100].map((num) => {
                          const estimatedPrice = num * (raffleConfig?.price || 10);
                          return (
                            <button
                              key={num}
                              type="button"
                              onClick={() => selectRandomNumbers(num)}
                              disabled={isRaffleFullyClosed || (raffleConfig?.isRaffleActive ?? false) === false}
                              className="bg-gradient-to-b from-zinc-800 to-zinc-900 border border-amber-500/30 hover:border-amber-400 text-white hover:text-amber-400 px-3.5 py-2 rounded-2xl text-xs font-black transition-all active:scale-95 cursor-pointer flex flex-col items-center justify-center min-w-[58px] shadow-lg hover:shadow-amber-500/20 group"
                            >
                              <span className="text-sm font-black text-amber-400 group-hover:scale-110 transition-transform">+{num}</span>
                              <span className="text-[8px] text-zinc-400 font-bold">R$ {estimatedPrice}</span>
                            </button>
                          );
                        })}

                        {/* Custom amount selector */}
                        <div className="flex items-center gap-1.5 bg-zinc-950/80 border border-zinc-800 rounded-2xl p-1 pl-2.5">
                          <input
                            type="number"
                            value={autoSelectAmount}
                            onChange={(e) => setAutoSelectAmount(e.target.value)}
                            placeholder="Qtd"
                            disabled={isRaffleFullyClosed || (raffleConfig?.isRaffleActive ?? false) === false}
                            className="w-12 bg-transparent transition-all font-bold text-xs text-center text-white outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const val = parseInt(autoSelectAmount);
                              if (!isNaN(val) && val > 0) {
                                selectRandomNumbers(val);
                                setAutoSelectAmount("");
                              }
                            }}
                            disabled={isRaffleFullyClosed || (raffleConfig?.isRaffleActive ?? false) === false}
                            className="bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-black px-3 py-1.5 rounded-xl transition-all active:scale-95 cursor-pointer shadow-md"
                          >
                            Ok
                          </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </section>

                {/* NUMBER GRID SECTION */}
                <section id="selection-grid-section" className="max-w-7xl mx-auto px-4 mt-4 scroll-mt-24">
                  <div className="bg-zinc-900 border border-zinc-800/80 rounded-3xl sm:rounded-[2.5rem] p-5 sm:p-8 shadow-2xl border-b-[12px] border-b-amber-500/10">
                    {raffleConfig.isRaffleActive === false && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-8 p-6 rounded-3xl bg-rose-500/15 border border-rose-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-lg shadow-rose-500/5 relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                          <ShieldAlert className="w-24 h-24 text-rose-500" />
                        </div>
                        <div className="flex items-center gap-4 flex-col sm:flex-row relative z-10">
                          <div className="bg-rose-500/20 w-12 h-12 rounded-full flex items-center justify-center animate-pulse text-rose-450 shrink-0">
                            <ShieldAlert className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-rose-450 font-black text-lg uppercase tracking-wider">
                              Rifa temporariamente desativada
                            </h4>
                            <p className="text-zinc-400 text-sm mt-0.5 max-w-2xl">
                              O administrador pausou a rifa temporariamente. A seleção de novas cotas, o checkout e a faturização Pix estão indisponíveis no momento. Por favor, aguarde o retorno das operações!
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {isRaffleFullyClosed && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="mb-8 p-6 rounded-3xl bg-amber-500/15 border border-amber-500/30 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left shadow-lg shadow-amber-500/5 relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                          <Clock className="w-24 h-24 text-amber-400" />
                        </div>
                        <div className="flex items-center gap-4 flex-col sm:flex-row relative z-10">
                          <div className="bg-amber-500/20 w-12 h-12 rounded-full flex items-center justify-center animate-pulse text-amber-400 shrink-0">
                            <Clock className="w-6 h-6" />
                          </div>
                          <div>
                            <h4 className="text-amber-400 font-black text-lg uppercase tracking-wider">
                              rifa fechada, aguardar sorteio
                            </h4>
                            <p className="text-zinc-400 text-sm mt-0.5 max-w-2xl">
                              Todas as cotas foram preenchidas! Se algum usuário
                              desistir, liberar cotas ou o cronômetro expirar, a
                              rifa abrirá automaticamente em tempo real para
                              novas seleções.
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {raffleConfig.purchaseMode === "aleatorio" ? (
                      <div className="space-y-8">
                        <div className="text-center space-y-2">
                          <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight flex items-center justify-center gap-3">
                            Compra Rápida e Aleatória
                            <span className="text-xs bg-amber-500/20 text-amber-400 px-2.5 py-1 rounded-lg font-black font-mono">
                              Bolsão de Cotas
                            </span>
                          </h2>
                          <p className="text-zinc-400 text-xs max-w-xl mx-auto">
                            O sistema selecionará automaticamente cotas livres e totalmente aleatórias para você de forma instantânea. Sem repetições!
                          </p>
                        </div>

                        {/* Presets Cards Grid */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {[1, 2, 5, 10, 20, 50].map((qty) => {
                            const isSelectedPreset = selectedNumbers.length === qty;
                            return (
                              <button
                                key={qty}
                                type="button"
                                onClick={async () => {
                                  setSelectedNumbers([]);
                                  await selectRandomNumbers(qty);
                                }}
                                className={`p-6 rounded-3xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-2 active:scale-95 ${
                                  isSelectedPreset
                                    ? "bg-amber-500/15 border-amber-500 text-amber-400 font-black shadow-lg shadow-amber-500/10"
                                    : "bg-zinc-900/50 hover:bg-zinc-900 border-zinc-850 hover:border-zinc-700 text-zinc-300"
                                }`}
                              >
                                <span className="text-2xl font-black font-mono">{qty}</span>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                                  {qty === 1 ? "Cota" : "Cotas"}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* Custom Input Block */}
                        <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-6 space-y-4 max-w-lg mx-auto">
                          <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block text-left">
                            Ou digite uma quantidade personalizada
                          </span>
                          <div className="flex gap-3">
                            <input
                              type="number"
                              min="1"
                              max={raffleConfig.totalNumbers || 150}
                              placeholder="Ex: 15"
                              value={randomCount}
                              onChange={(e) => setRandomCount(e.target.value)}
                              className="flex-1 bg-black border border-zinc-850 rounded-2xl px-4 py-3 text-sm font-black text-white font-mono outline-none focus:border-amber-500"
                            />
                            <button
                              type="button"
                              onClick={async () => {
                                const parsed = parseInt(randomCount, 10);
                                if (isNaN(parsed) || parsed <= 0) {
                                  alert("Por favor, digite uma quantidade válida maior que zero.");
                                  return;
                                }
                                setSelectedNumbers([]);
                                await selectRandomNumbers(parsed);
                              }}
                              className="px-6 bg-amber-500 hover:bg-amber-400 text-zinc-950 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
                            >
                              Reservar Cotas
                            </button>
                          </div>
                          <p className="text-[10px] text-zinc-500 italic text-left">
                            As cotas serão imediatamente reservadas por 3 minutos enquanto você realiza o pagamento.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col md:flex-row gap-4 md:items-center md:justify-between mb-6">
                          <div>
                            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-3">
                              Escolha seus números
                            </h2>
                            <p className="text-zinc-400 text-xs mt-1">
                              Clique nos números desejados para reservar. Tempo de reserva:{" "}
                              <span className="text-amber-400 font-black">3 minutos</span>.
                            </p>

                            {/* Status Legend Pills */}
                            <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                              {[
                                { label: "Disponível", style: "bg-zinc-950/80 border-zinc-800 text-zinc-400" },
                                { label: "Reservado", style: "bg-amber-500/10 border-amber-500/25 text-amber-400 font-bold" },
                                { label: "Pago", style: "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 font-bold" },
                                { label: "Selecionado", style: "bg-amber-500 border-amber-400 text-zinc-950 font-bold" },
                              ].map((status) => (
                                <div
                                  key={status.label}
                                  className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] uppercase tracking-wider font-extrabold border ${status.style}`}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                                  <span>{status.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          <div className="flex flex-col sm:flex-row gap-3">
                            <div className="relative group">
                              <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-amber-400 transition-colors" />
                              <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Buscar número..."
                                className="bg-zinc-800/80 border border-zinc-700/80 rounded-xl pl-11 pr-4 py-2.5 w-full sm:w-48 outline-none focus:border-amber-500/50 transition-all text-sm text-white"
                              />
                            </div>

                            <div className="relative">
                              <Filter className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500" />
                              <select
                                value={filter}
                                onChange={(e) => setFilter(e.target.value)}
                                className="bg-zinc-800/80 border border-zinc-700/80 rounded-xl pl-11 pr-8 py-2.5 outline-none focus:border-amber-500/50 transition-all text-sm appearance-none cursor-pointer w-full sm:w-auto text-white"
                              >
                                <option>Todos</option>
                                <option>Disponíveis</option>
                                <option>Pagos</option>
                                <option>Reservados</option>
                              </select>
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-5 gap-2 sm:gap-3 notranslate" translate="no">
                          {visibleNumbers.map((number) => {
                            const isSelected = selectedNumbersSet.has(number.id);
                            return (
                              <NumberCell
                                key={number.id}
                                id={number.id}
                                status={number.status as Status}
                                isGhost={number.isGhost}
                                isSelected={isSelected}
                                isActiveRaffle={raffleConfig.isActive && raffleConfig.isRaffleActive !== false}
                                styleClasses={getStyles(
                                  number.status as Status,
                                  number.id,
                                  number.isGhost,
                                )}
                                timerText={
                                  isSelected
                                    ? formatTime(timerInSeconds)
                                    : undefined
                                }
                                onClick={handleCellClick}
                              />
                            );
                          })}
                        </div>

                        {filteredNumbers.length > visibleLimit && (
                          <div className="flex justify-center mt-6">
                            <button
                              type="button"
                              onClick={() => setVisibleLimit((prev) => prev + 200)}
                              className="bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 font-bold px-6 py-2.5 rounded-xl transition-all active:scale-95 text-xs uppercase tracking-wider cursor-pointer"
                            >
                              Exibir mais cotas (+200)
                            </button>
                          </div>
                        )}

                        {filteredNumbers.length === 0 && (
                          <div className="py-20 text-center">
                            <Search className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
                            <p className="text-zinc-500 font-medium">
                              Nenhum número encontrado para "{searchTerm}"
                            </p>
                            <button
                              onClick={() => {
                                setSearchTerm("");
                                setFilter("Todos");
                              }}
                              className="mt-4 text-emerald-500 font-bold hover:underline"
                            >
                              Limpar filtros
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </section>
              </>
            )}
          </>
        )}

        <AnimatePresence mode="wait">
          {(selectedNumbers.length > 0 ||
            paymentStep === "pix" ||
            paymentStep === "finished") && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="max-w-7xl mx-auto px-4 mt-8 pb-32"
              id="payment-section"
              onViewportEnter={() => setIsCheckoutVisible(true)}
              onViewportLeave={() => setIsCheckoutVisible(false)}
            >
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl sm:rounded-[2.5rem] p-4 sm:p-10 shadow-2xl overflow-hidden min-h-[400px] flex flex-col relative">
                {/* Fechar/Desistir Button */}
                {paymentStep !== "finished" && (
                  <button
                    onClick={() => setShowExitConfirm(true)}
                    className="absolute right-4 top-4 sm:right-8 sm:top-8 text-zinc-500 hover:text-white transition-colors p-2 rounded-full hover:bg-zinc-800 z-50 transition-transform active:scale-95"
                    title="Fechar e cancelar reserva"
                  >
                    <X className="w-6 h-6" />
                  </button>
                )}
                <AnimatePresence mode="wait">
                  {paymentStep === "data" && (
                    <motion.div
                      key="step-data"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      className="flex-1"
                    >
                      <div className="mb-8">
                        <h2 className="text-3xl font-black mb-2">Seus Dados</h2>
                        <p className="text-zinc-500 font-medium">
                          Preencha seus dados para vincular aos números.
                        </p>
                      </div>

                      <div className="space-y-6 max-w-2xl">
                        <div>
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-3 pl-1">
                            Nome Completo
                          </label>
                          <div className="relative">
                            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                            <input
                              value={userData.name}
                              onChange={(e) =>
                                setUserData({
                                  ...userData,
                                  name: e.target.value,
                                })
                              }
                              className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-amber-500/50 focus:bg-zinc-800 transition-all text-lg"
                              placeholder="Ex: João da Silva"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-zinc-500 uppercase tracking-widest block mb-3 pl-1">
                            WhatsApp para contato
                          </label>
                          <div className="relative">
                            <MessageCircle className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                            <input
                              type="text"
                              inputMode="tel"
                              value={userData.phone}
                              onChange={(e) => {
                                let v = e.target.value.replace(/\D/g, "");
                                // Remove leading Brazilian country code 55 if pasted with it
                                if ((v.length === 12 || v.length === 13) && v.startsWith("55")) {
                                  v = v.slice(2);
                                }
                                if (v.length > 11) v = v.slice(0, 11);
                                if (v.length > 2) {
                                  v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
                                }
                                if (v.length > 10) {
                                  v = `${v.slice(0, 10)}-${v.slice(10)}`;
                                }
                                setUserData({ ...userData, phone: v });
                              }}
                              maxLength={15}
                              className="w-full bg-zinc-800/50 border border-zinc-700/50 rounded-2xl pl-12 pr-4 py-4 outline-none focus:border-amber-500/50 focus:bg-zinc-800 transition-all text-lg"
                              placeholder="(11) 99999-9999"
                            />
                          </div>
                        </div>
                      </div>

                      {mpError && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-center text-sm font-bold mt-4">
                          {mpError}
                        </div>
                      )}

                      <button
                        disabled={
                          !(userData?.name) ||
                          !(userData?.phone) ||
                          isGeneratingPayment
                        }
                        onClick={handleCreateMercadoPagoPayment}
                        className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed text-black font-black py-5 rounded-2xl text-xl transition-all shadow-xl shadow-amber-500/20 active:scale-[0.98] mt-4 flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {isGeneratingPayment ? (
                          <>
                            <RefreshCw className="w-5 h-5 animate-spin text-white" />
                            <span>RESERVANDO COTAS...</span>
                          </>
                        ) : (
                          <>
                            <QrCode className="w-5 h-5 text-white" />
                            <span>RESERVAR E VER CHAVE PIX</span>
                          </>
                        )}
                      </button>
                    </motion.div>
                  )}

                  {paymentStep === "pix" && (
                    <motion.div
                      key="step-pix"
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -25 }}
                      className="grid lg:grid-cols-2 gap-6 lg:gap-10 w-full max-w-full overflow-hidden"
                    >
                      <div className="w-full max-w-full overflow-hidden">
                        <button
                          onClick={handleReturnToSelection}
                          className="text-zinc-500 hover:text-white flex items-center gap-2 mb-6 font-bold text-sm transition-colors"
                        >
                          <X className="w-4 h-4" /> Voltar para dados
                        </button>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                          <div className="flex flex-col">
                            <h2 className="text-2xl sm:text-3xl font-black text-white">
                              Pagamento Pix
                            </h2>
                            <span className="text-amber-400 text-xs font-bold uppercase tracking-widest mt-1">
                              Mercado Pago Pix Automatizado
                            </span>
                          </div>
                          <div className="flex items-center self-start sm:self-auto gap-2 bg-amber-500/10 text-amber-400 text-[10px] px-3.5 py-2 rounded-full font-black border border-amber-500/20 animate-pulse shrink-0">
                            <Clock className="w-3.5 h-3.5" />
                            RESERVA ATIVA: {formatTime(timerInSeconds)}
                          </div>
                        </div>

                        {isSelectionChanged && !isGeneratingPayment && (
                          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl p-4 mb-6 flex items-start gap-3 animate-pulse">
                            <RefreshCw className="w-5 h-5 animate-spin shrink-0 mt-0.5" />
                            <div className="space-y-1">
                              <p className="font-extrabold text-xs sm:text-sm text-amber-300">
                                Alteração detectada no carrinho!
                              </p>
                              <p className="text-zinc-400 text-[11px] sm:text-xs leading-relaxed font-semibold">
                                O valor da sua compra mudou. Aguarde 1 segundo para gerarmos automaticamente o Pix com o novo valor correspondente.
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="bg-zinc-800/50 border border-zinc-700/50 rounded-3xl p-4 sm:p-8 mb-6 flex flex-col items-center justify-center relative group w-full max-w-full overflow-hidden">
                          {isGeneratingPayment && (
                            <div className="absolute inset-0 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center text-center p-6 z-20 space-y-4">
                              <RefreshCw className="w-10 h-10 text-amber-400 animate-spin" />
                              <p className="text-white font-black text-base sm:text-lg">
                                Atualizando seu Pix...
                              </p>
                              <p className="text-zinc-400 text-xs font-semibold max-w-xs leading-relaxed">
                                Recalculando o valor total e gerando uma nova chave Pix para as suas cotas atualizadas.
                              </p>
                            </div>
                          )}

                          <div className="p-3 sm:p-4 bg-white rounded-2xl shadow-[0_0_50px_rgba(255,255,255,0.1)] mb-4 flex items-center justify-center overflow-hidden w-36 h-36 min-[375px]:w-44 min-[375px]:h-44 sm:w-48 sm:h-48 md:w-56 md:h-56 max-w-full aspect-square shrink-0">
                            <img
                              src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(mpPaymentInfo?.qrCode || "SIMULADO")}`}
                              className="w-full h-full object-contain"
                              alt="Pix QR Code"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <p className="text-zinc-400 text-[10px] sm:text-xs font-bold uppercase tracking-widest text-center mt-2 leading-relaxed px-2">
                            Abra o aplicativo de pagamentos do seu Banco,
                            escolha "Pix" e aponte a câmera para ler o QR Code
                          </p>
                        </div>

                        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 text-center">
                          <p className="text-emerald-500 font-black">
                            {isSelectionChanged && !isGeneratingPayment ? (
                              <span>Recalculando: R$ {(selectedNumbers.length * raffleConfig.price).toFixed(2).replace(".", ",")}...</span>
                            ) : (
                              <span>Valor total: R$ {totalAmount.toFixed(2).replace(".", ",")}</span>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-col justify-center space-y-6 w-full max-w-full overflow-hidden">
                        <div className="space-y-4 w-full max-w-full">
                          {/* Order Details Card */}
                          <div className="bg-zinc-900 border border-zinc-850 rounded-2xl p-4 sm:p-5 space-y-3 w-full max-w-full overflow-hidden">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 border-b border-zinc-800/80 pb-3 mb-1">
                              <span className="text-xs font-black uppercase tracking-wider text-zinc-500">
                                Status da Reserva
                              </span>
                              <span className="self-start sm:self-auto bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider animate-pulse whitespace-nowrap">
                                Aguardando Pagamento Pix
                              </span>
                            </div>
                            <div className="flex justify-between items-center border-b border-zinc-800/80 pb-2 gap-4">
                              <span className="text-xs text-zinc-500 uppercase font-black tracking-wider shrink-0">
                                Código Reserva
                              </span>
                              <span className="text-xs font-mono font-black text-amber-400 truncate min-w-0 max-w-[120px] xs:max-w-[160px] sm:max-w-none text-right">
                                {mpPaymentInfo?.orderId}
                              </span>
                            </div>
                            <div className="flex justify-between items-center border-b border-zinc-800/80 pb-2 gap-4">
                              <span className="text-xs text-zinc-500 uppercase font-black tracking-wider shrink-0">
                                Titular
                              </span>
                              <span className="text-xs sm:text-sm font-bold text-zinc-350 truncate min-w-0 max-w-[120px] xs:max-w-[160px] sm:max-w-none text-right">
                                {raffleConfig.pixReceiver || "Admin"}
                              </span>
                            </div>
                            <div className="flex justify-between items-center border-b border-zinc-800/80 pb-2 gap-4">
                              <span className="text-xs text-zinc-500 uppercase font-black tracking-wider shrink-0">
                                Banco
                              </span>
                              <span className="text-xs sm:text-sm font-bold text-zinc-350 flex items-center gap-2 truncate min-w-0 max-w-[120px] xs:max-w-[160px] sm:max-w-none text-right justify-end">
                                {raffleConfig.pixBankLogo && (
                                  <img
                                    src={raffleConfig.pixBankLogo}
                                    alt="Logo"
                                    className="w-4 h-4 object-contain rounded-sm shrink-0"
                                    referrerPolicy="no-referrer"
                                  />
                                )}
                                <span className="truncate">{raffleConfig.pixBank || "Banco do Recebedor"}</span>
                              </span>
                            </div>
                            {raffleConfig.pixKeyType && (
                              <div className="flex justify-between items-center border-b border-zinc-800/80 pb-2 gap-4">
                                <span className="text-xs text-zinc-500 uppercase font-black tracking-wider shrink-0">
                                  Tipo de Chave
                                </span>
                                <span className="text-xs sm:text-sm font-bold text-zinc-350 truncate min-w-0 max-w-[120px] xs:max-w-[160px] sm:max-w-none text-right">
                                  {raffleConfig.pixKeyType}
                                </span>
                              </div>
                            )}
                            <div className="flex justify-between items-center border-b border-zinc-800/80 pb-2 gap-4">
                              <span className="text-xs text-zinc-500 uppercase font-black tracking-wider shrink-0">
                                Chave Pix
                              </span>
                              <span className="text-xs sm:text-sm font-mono font-bold text-zinc-350 truncate min-w-0 max-w-[120px] xs:max-w-[160px] sm:max-w-none text-right">
                                {raffleConfig.pixKey || "Suporte/Manual"}
                              </span>
                            </div>
                            <div className="flex flex-col gap-2 pt-1">
                              <span className="text-xs text-zinc-500 uppercase font-black tracking-wider">
                                Minhas Cotas Reservadas
                              </span>
                              {isSelectionChanged ? (
                                <div className="flex flex-wrap gap-1.5 mt-1 font-mono">
                                  {selectedNumbers.map((n) => (
                                    <span
                                      key={n}
                                      className="bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 font-bold text-xs sm:text-sm px-2.5 sm:px-3 text-center rounded-xl shrink-0 animate-pulse"
                                    >
                                      {n} (Alterando...)
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex flex-wrap gap-1.5 mt-1 font-mono">
                                  {submittedNumbers
                                    .filter((n) => !mpPaymentInfo?.bonusNums?.includes(n))
                                    .map((n) => (
                                      <span
                                        key={n}
                                        className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs sm:text-sm px-2.5 sm:px-3 text-center rounded-xl shrink-0"
                                      >
                                        {n}
                                      </span>
                                    ))}
                                  {mpPaymentInfo?.bonusNums && mpPaymentInfo.bonusNums.map((n) => (
                                    <span
                                      key={n}
                                      className="bg-pink-500/10 border border-pink-500/20 text-pink-400 font-bold text-xs sm:text-sm px-2.5 sm:px-3 text-center rounded-xl shrink-0 flex items-center gap-1 animate-fadeIn"
                                      title="Cota Bônus recebida via regra automática!"
                                    >
                                      🎁 {n} (Grátis)
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="bg-zinc-800/30 border border-zinc-700/30 rounded-2xl p-4 sm:p-5 flex flex-col gap-3 w-full option-card">
                            <div className="flex items-start sm:items-center gap-3">
                              <div className="relative flex h-3 w-3 mt-1 sm:mt-0 shrink-0">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] uppercase font-black tracking-widest text-zinc-500">
                                  Sincronização em Tempo Real
                                </p>
                                <p className="text-xs sm:text-sm font-bold text-zinc-200 leading-relaxed">
                                  Aguardando pagamento via Pix. Esta tela
                                  atualizará automaticamente!
                                </p>
                              </div>
                            </div>

                            {mpPaymentInfo?.isSimulated && (
                              <div className="bg-orange-950/40 border border-orange-500/20 rounded-xl p-3.5 flex flex-col items-center justify-center space-y-2 mt-1 w-full scale-100">
                                <p className="text-[10px] text-orange-400 font-black uppercase tracking-widest text-center">
                                  Modo Simulado Ativo (Chave MP ausente)
                                </p>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    try {
                                      const simRes = await fetch(
                                        "/api/simulate-webhook",
                                        {
                                          method: "POST",
                                          headers: {
                                            "Content-Type": "application/json",
                                          },
                                          body: JSON.stringify({
                                            paymentId: mpPaymentInfo.paymentId,
                                          }),
                                        },
                                      );
                                      if (simRes.ok) {
                                        console.log(
                                          "Simulated payment approved successfully!",
                                        );
                                      } else {
                                        alert(
                                          "Falha ao simular confirmação do pagamento.",
                                        );
                                      }
                                    } catch (simErr) {
                                      console.error(
                                        "Simulation error:",
                                        simErr,
                                      );
                                    }
                                  }}
                                  className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-2 rounded-xl text-xs uppercase tracking-wider transition-all active:scale-95 shadow-md flex items-center justify-center gap-2"
                                >
                                  ✨ Simular Confirmação Pagamento (Teste)
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="group w-full max-w-full">
                            <p className="text-zinc-500 text-[10px] uppercase font-black tracking-widest mb-2 pl-1">
                              Código Pix / Chave Pix (Copia e Cola)
                            </p>
                            <div className="bg-zinc-850/60 border border-zinc-800 rounded-2xl p-3 sm:p-4 flex flex-col gap-3 group-hover:border-emerald-500/50 transition-colors w-full max-w-full overflow-hidden">
                              <textarea
                                readOnly
                                value={mpPaymentInfo?.qrCode || "Gerando código Pix..."}
                                onClick={(e) => {
                                  const target = e.target as HTMLTextAreaElement;
                                  target.select();
                                  if (mpPaymentInfo?.qrCode) {
                                    safeCopyToClipboard(mpPaymentInfo.qrCode);
                                    setIsCopied(true);
                                    setTimeout(() => setIsCopied(false), 2000);
                                  }
                                }}
                                className="bg-zinc-900/80 p-3.5 rounded-xl border border-zinc-750/80 font-mono font-bold text-emerald-400 text-[11px] sm:text-xs flex-1 break-all whitespace-pre-wrap select-all cursor-pointer overflow-y-auto leading-relaxed h-[84px] text-left w-full outline-none focus:outline-none focus:ring-0 resize-none active:bg-zinc-900/90 transition-all scrollbar-none"
                                style={{ wordBreak: "break-all", overflowWrap: "anywhere" }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (mpPaymentInfo?.qrCode) {
                                    safeCopyToClipboard(mpPaymentInfo.qrCode);
                                    setIsCopied(true);
                                    setTimeout(() => setIsCopied(false), 2000);
                                  }
                                }}
                                className={`
                                  w-full py-4 rounded-xl text-xs font-black transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg h-12 uppercase tracking-wider select-none shrink-0 cursor-pointer
                                  ${isCopied ? "bg-emerald-500 text-black shadow-emerald-500/10" : "bg-amber-500 hover:bg-amber-400 text-black shadow-lg shadow-amber-500/20"}
                                `}
                              >
                                {isCopied ? (
                                  <>
                                    <CheckCircle2 className="w-4 h-4" />
                                    <span>Copiado com Sucesso! Chave Ativa</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-4 h-4 text-white" />
                                    <span>Copiar Chave Copia e Cola</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* WhatsApp Receipt Button - Locked in Pix selection until identified */}
                        <div className="pt-2 w-full">
                          <button
                            disabled
                            type="button"
                            className="w-full bg-zinc-800 border border-zinc-700/50 text-zinc-500 font-bold py-4 px-4 rounded-2xl text-xs sm:text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-not-allowed opacity-70"
                          >
                            <MessageCircle className="w-5 h-5 flex-shrink-0 text-zinc-600" />
                            WhatsApp Liberado Após Identificação
                          </button>
                        </div>

                        <div className="border-t border-zinc-800/80 pt-4 w-full">
                          <p className="text-zinc-500 text-[10px] text-center uppercase tracking-widest leading-relaxed">
                            ⏳ O botão de WhatsApp para comprovantes será liberado automaticamente assim que o pagamento Pix for identificado pelo nosso sistema!
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {paymentStep === "finished" && (
                    <motion.div
                      key="step-finished"
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex-1 flex flex-col items-center justify-center py-10"
                    >
                      <div className="bg-emerald-500/20 p-6 rounded-full mb-8 relative">
                        <CheckCircle2 className="w-20 h-20 text-emerald-500" />
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.2, type: "spring" }}
                          className="absolute -top-2 -right-2 bg-white text-emerald-600 p-2 rounded-full shadow-lg"
                        >
                          <Smartphone className="w-6 h-6" />
                        </motion.div>
                      </div>

                      <h2 className="text-4xl font-black text-center mb-4 leading-tight text-emerald-400">
                        Pagamento Aprovado! 🎉
                      </h2>
                      <p className="text-zinc-400 text-center max-w-md text-sm mb-8">
                        Seu pagamento foi confirmado automaticamente. Boa sorte
                        no sorteio! 🍀
                      </p>

                      <div className="relative bg-zinc-900 border border-zinc-800 rounded-[2rem] p-6 w-full max-w-md shadow-2xl overflow-hidden before:absolute before:inset-0 before:bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.08),transparent_50%)]">
                        {/* Ticket header styling */}
                        <div className="text-center pb-6 border-b border-zinc-800/80">
                          <p className="text-emerald-500 font-extrabold uppercase tracking-widest text-[9px]">
                            Comprovante Digital de Compra
                          </p>
                          <h3 className="text-2xl font-black mt-1 text-white">
                            BILHETE DE RIFA
                          </h3>
                          <p className="text-zinc-500 text-[10px] font-medium font-mono mt-0.5">
                            ID: {mpPaymentInfo?.orderId || "SORTEIO"}
                          </p>
                        </div>

                        {/* Ticket Info list */}
                        <div className="py-6 space-y-4 text-left">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500 font-extrabold uppercase tracking-widest text-[9px]">
                              Nome Completo
                            </span>
                            <span className="text-zinc-200 font-extrabold">
                              {userData.name || "Adquirinte"}
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500 font-extrabold uppercase tracking-widest text-[9px]">
                              Telefone Celular
                            </span>
                            <span className="text-zinc-300 font-bold">
                              {userData.phone || "N/A"}
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500 font-extrabold uppercase tracking-widest text-[9px]">
                              Status da Operação
                            </span>
                            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">
                              ● PAGO
                            </span>
                          </div>

                          <div className="flex justify-between items-center text-sm">
                            <span className="text-zinc-500 font-extrabold uppercase tracking-widest text-[9px]">
                              Data e Hora
                            </span>
                            <span className="text-zinc-300 font-medium text-xs font-mono">
                              {new Date().toLocaleString("pt-BR")}
                            </span>
                          </div>

                          {/* Dotted separator */}
                          <div className="border-t border-dashed border-zinc-800/80 my-4" />

                          {/* Bought and Bonus Numbers Split */}
                          <div className="flex flex-col space-y-5">
                            <div className="space-y-2">
                              <span className="text-zinc-500 font-extrabold uppercase tracking-widest text-[9px] text-center block">
                                Meus Números Comprados
                              </span>
                              <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                                {submittedNumbers
                                  .filter((n) => !mpPaymentInfo?.bonusNums?.includes(n))
                                  .map((n) => (
                                    <span
                                      key={n}
                                      className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono font-bold text-center px-4 py-2 rounded-xl text-base min-w-[50px] shadow-sm"
                                    >
                                      {n}
                                    </span>
                                  ))}
                              </div>
                            </div>

                            {mpPaymentInfo?.bonusNums && mpPaymentInfo.bonusNums.length > 0 && (
                              <div className="space-y-2 pt-2 border-t border-zinc-900/45">
                                <span className="text-pink-400 font-black uppercase tracking-widest text-[9px] text-center block flex items-center justify-center gap-1">
                                  🎁 Números de Bônus Ganhos!
                                </span>
                                <div className="flex flex-wrap justify-center gap-1.5 pt-1">
                                  {mpPaymentInfo.bonusNums.map((n) => (
                                    <span
                                      key={n}
                                      className="bg-pink-500/10 border border-pink-500/20 text-pink-400 font-mono font-bold text-center px-4 py-2 rounded-xl text-base min-w-[50px] shadow-sm animate-fadeIn"
                                    >
                                      {n}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="border-t border-dashed border-zinc-800/80 my-4" />

                          <div className="flex justify-between items-center text-sm pt-2">
                            <span className="text-zinc-400 font-black uppercase tracking-widest text-[9px]">
                              Total Pago
                            </span>
                            <span className="text-xl font-black text-emerald-400">
                              R$ {totalAmount.toFixed(2).replace(".", ",")}
                            </span>
                          </div>
                        </div>

                        {/* WhatsApp & direct admin receipt sender buttons */}
                        <div className="pt-2 w-full flex flex-col gap-2">
                          <a
                            href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
                              (() => {
                                const bonus = mpPaymentInfo?.bonusNums || [];
                                const selectedOnly = submittedNumbers.filter(n => !bonus.includes(n));
                                return `✅ *PAGAMENTO CONFIRMADO*\n\n` +
                                  `🏆 *Rifa:* ${raffleConfig.title || "Rifa"}\n` +
                                  `👤 *Nome:* ${userData.name || "N/A"}\n` +
                                  `📞 *Telefone:* ${userData.phone || "N/A"}\n` +
                                  `🎟️ *Cotas:* ${selectedOnly.join(", ")}\n` +
                                  (bonus.length > 0 ? `🎁 *Bônus:* ${bonus.join(", ")}\n` : "") +
                                  `💰 *Valor Pago:* R$ ${totalAmount.toFixed(2).replace(".", ",")}\n` +
                                  `🕒 *Data/Hora:* ${new Date().toLocaleString("pt-BR")}\n\n` +
                                  `Status: Confirmado e Pago automaticamente via Pix!`;
                              })()
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 px-4 rounded-2xl text-xs sm:text-sm uppercase tracking-wider transition-all shadow-lg hover:shadow-emerald-600/20 active:scale-95 flex items-center justify-center gap-2"
                          >
                            <MessageCircle className="w-5 h-5 flex-shrink-0" />
                            Enviar Comprovante via WhatsApp
                          </a>
                        </div>

                        <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-widest text-center mt-3 border-t border-zinc-800/80 pt-4">
                          Tire um print desta tela para o seu controle.
                        </p>
                      </div>

                      {/* Auto-close Indicator */}
                      <p className="mt-6 text-xs font-semibold text-zinc-500 text-center animate-pulse flex items-center justify-center gap-1.5">
                        <Clock className="w-4 h-4 animate-spin text-emerald-500" />
                        Retornando à seleção de rifas em{" "}
                        <span className="text-zinc-300 font-extrabold">{successTimer}s</span>...
                      </p>

                      <button
                        onClick={() => {
                          setSubmittedNumbers([]);
                          setSelectedNumbers([]);
                          recentlyToggledRef.current = {};
                          setPaymentStep("data");
                          setMpPaymentInfo(null);
                          setPaymentExpiresAt(null);
                          const el =
                            document.getElementById("top-section") ||
                            document.documentElement;
                          el?.scrollIntoView({ behavior: "smooth" });
                        }}
                        className="mt-6 bg-zinc-800 hover:bg-zinc-700 hover:border-orange-500/30 border border-zinc-700/80 text-white font-black px-8 py-4 rounded-2xl transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 text-md w-full max-w-md"
                      >
                        SELECIONAR MAIS NÚMEROS
                      </button>

                      <button
                        onClick={() => {
                          clearMyLocks();
                          recentlyToggledRef.current = {};
                          setSelectedNumbers([]);
                          setSubmittedNumbers([]);
                          setPaymentStep("data");
                          setMpPaymentInfo(null);
                          setPaymentExpiresAt(null);
                        }}
                        className="mt-4 text-zinc-500 hover:text-zinc-400 font-bold text-sm transition-all"
                      >
                        Limpar seleção e voltar ao início
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ADMIN MODAL (Isolated securely to /admin and /dashboard) */}
        <AnimatePresence>
          {false && (
            <motion.section
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            >
              <div
                className="absolute inset-0"
                onClick={() => setShowAdmin(false)}
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="bg-zinc-950 border border-zinc-805 rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 shadow-[0_0_80px_rgba(0,0,0,0.8)] w-full max-w-6xl max-h-[90vh] overflow-y-auto relative z-10 scrollbar-none"
              >
                {!isAdminAuthenticated ? (
                  <div className="max-w-md mx-auto py-16 text-center">
                    <div className="bg-zinc-900 w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-zinc-800 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                      <ShieldCheck className="w-10 h-10 text-orange-400" />
                    </div>
                    <h2 className="text-3xl font-black mb-2 uppercase tracking-wide bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
                      Acesso Restrito
                    </h2>
                    <p className="text-zinc-500 text-xs sm:text-sm font-medium tracking-wide mb-8">
                      Digite a senha administrativa para gerenciar o sistema.
                    </p>
                    <form onSubmit={handleAdminLogin} className="space-y-4">
                      <input
                        type="password"
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••"
                        className="w-full bg-zinc-900/60 border border-zinc-800 rounded-2xl px-6 py-4 text-center text-3xl tracking-[1em] outline-none focus:border-orange-500/80 focus:ring-4 focus:ring-orange-500/10 transition-all font-mono text-white placeholder-zinc-700"
                        autoFocus
                      />
                      <button className="w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:brightness-110 active:scale-[0.98] text-white font-black py-4.5 rounded-2xl text-xs uppercase tracking-widest transition-all shadow-lg shadow-orange-600/10">
                        ENTRAR NO PAINEL SECURITY
                      </button>
                    </form>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 gap-6 border-b border-zinc-900 pb-6">
                      <div className="flex items-center gap-4">
                        <div className="bg-zinc-900 p-3.5 rounded-2xl border border-zinc-800 shadow-md">
                          <ShieldCheck className="w-7 h-7 text-orange-400 animate-pulse" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h2 className="text-2xl sm:text-3xl font-black tracking-tight uppercase">
                              Painel de Controle
                            </h2>
                            <span className="hidden sm:inline-block bg-orange-500/10 text-orange-400 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest border border-orange-500/20">
                              ADMIN
                            </span>
                          </div>
                          <p className="text-zinc-500 text-xs sm:text-sm font-semibold mt-0.5">
                            Gestão completa, configurações gerais e relatórios realtime
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 items-center">
                        <button
                          disabled={isClearing}
                          onClick={handleClearRaffle}
                          className="flex items-center gap-2 px-5 py-3 bg-red-500/5 hover:bg-red-500 text-red-500 hover:text-black border border-red-500/15 hover:border-red-500 rounded-xl transition-all text-xs font-black uppercase tracking-wider disabled:opacity-50 disabled:pointer-events-none active:scale-95 cursor-pointer"
                        >
                          {isClearing ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          Reiniciar Rifa
                        </button>
                        <button
                          onClick={() => {
                            setIsAdminAuthenticated(false);
                            localStorage.removeItem("raffle_admin_token");
                          }}
                          className="px-5 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-350 hover:text-white rounded-xl border border-zinc-800 transition-all text-xs font-black uppercase tracking-wider active:scale-95 cursor-pointer"
                        >
                          Sair
                        </button>
                        <button
                          onClick={() => setShowAdmin(false)}
                          className="p-3 bg-zinc-900 hover:bg-zinc-800 rounded-xl border border-zinc-800 transition-all text-zinc-400 hover:text-white active:scale-95 cursor-pointer"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
                      {/* STATS */}
                      <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-emerald-500/[0.02] border border-emerald-500/15 rounded-3xl p-6 shadow-[0_4px_30px_rgba(16,185,129,0.01)] hover:bg-emerald-500/[0.04] transition-all duration-300 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center mb-4">
                              <p className="text-emerald-500 text-[9px] uppercase font-black tracking-widest">
                                Valor Arrecadado (Pagos)
                              </p>
                              <span className="flex h-1.5 w-1.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                              </span>
                            </div>
                            <h3 className="text-3xl sm:text-4xl font-black text-emerald-400 tracking-tight leading-none">
                              R$ {stats.arrecadado.toLocaleString("pt-BR")}
                            </h3>
                          </div>
                          <p className="text-zinc-500 text-[10px] mt-4 font-bold uppercase tracking-wider">
                            📊 {stats.countPaid} cotas confirmadas
                          </p>
                        </div>

                        <div className="bg-orange-500/[0.02] border border-orange-500/15 rounded-3xl p-6 shadow-[0_4px_30px_rgba(249,115,22,0.01)] hover:bg-orange-500/[0.04] transition-all duration-300 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center mb-4">
                              <p className="text-orange-400 text-[9px] uppercase font-black tracking-widest">
                                Valor a Entrar (Aguardando)
                              </p>
                              <span className="flex h-1.5 w-1.5 relative">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-orange-500"></span>
                              </span>
                            </div>
                            <h3 className="text-3xl sm:text-4xl font-black text-orange-400 tracking-tight leading-none">
                              R$ {stats.aEntrar.toLocaleString("pt-BR")}
                            </h3>
                          </div>
                          <p className="text-zinc-500 text-[10px] mt-4 font-bold uppercase tracking-wider">
                            ⏳ {stats.countReserved} cotas pendentes
                          </p>
                        </div>

                        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between">
                          <div>
                            <p className="text-zinc-500 text-[9px] uppercase font-black tracking-widest mb-4">
                              Taxa de Ocupação da Rifa
                            </p>
                            <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tight leading-none flex items-baseline gap-1">
                              {Math.round(
                                ((stats.countPaid + stats.countReserved) /
                                  raffleConfig.totalNumbers) *
                                  100,
                              )}
                              <span className="text-lg text-zinc-500 font-bold">%</span>
                            </h3>
                          </div>
                          <div className="mt-4">
                            <div className="relative w-full bg-zinc-900 h-2.5 rounded-full overflow-hidden border border-zinc-800">
                              <div
                                className="bg-gradient-to-r from-emerald-500 to-indigo-505 h-full transition-all duration-1000"
                                style={{
                                  width: `${(stats.countPaid / (raffleConfig.totalNumbers || 1)) * 100}%`,
                                }}
                              />
                            </div>
                            <div className="flex justify-between items-center text-[8px] text-zinc-500 font-black mt-1.5 uppercase tracking-wide">
                              <span>{stats.countPaid} pagas</span>
                              <span>{stats.countReserved} pendentes</span>
                            </div>
                          </div>
                        </div>

                        <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 flex flex-col justify-between">
                          <div>
                            <div className="flex justify-between items-center mb-4">
                              <p className="text-zinc-500 text-[9px] uppercase font-black tracking-widest">
                                Status de Publicação
                              </p>
                              <span className="flex h-2 w-2 relative">
                                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${raffleConfig.isActive ? "bg-emerald-400" : "bg-red-400"}`}></span>
                                <span className={`relative inline-flex rounded-full h-2 w-2 ${raffleConfig.isActive ? "bg-emerald-500" : "bg-red-500"}`}></span>
                              </span>
                            </div>
                            <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">
                              {raffleConfig.isActive ? "Ativa no Site" : "Pausada"}
                            </h3>
                          </div>
                          
                          <div className="pt-4">
                            <button
                              disabled={isTogglingActive}
                              onClick={async () => {
                                console.log("[BUTTON_CLICK] 'Alternar Status Ativo' button trigger.");
                                if (isTogglingActive) return;
                                setIsTogglingActive(true);
                                const nextState = !raffleConfig.isActive;
                                console.log("[ADMIN_ACTION_START] Action: save-config (Toggle active status) -> Target status:", nextState);
                                try {
                                  const cleanConfig = {
                                    title: String(
                                      editedConfig.title || "iPhone 15 Pro Max",
                                    ),
                                    description: String(
                                      editedConfig.description || "",
                                    ),
                                    price: Number(editedConfig.price || 10),
                                    totalNumbers: Number(
                                      editedConfig.totalNumbers || 150,
                                    ),
                                    isActive: nextState,
                                    isRaffleActive: nextState,
                                    imageUrl: String(editedConfig.imageUrl || ""),
                                    pixKey: String(editedConfig.pixKey || ""),
                                    pixReceiver: String(
                                      editedConfig.pixReceiver || ""
                                    ),
                                    pixBank: String(editedConfig.pixBank || ""),
                                    pixPhone: String(editedConfig.pixPhone || ""),
                                    pixKeyType: String(editedConfig.pixKeyType || ""),
                                    pixBankLogo: String(editedConfig.pixBankLogo || ""),
                                    winnerNumber: String(
                                      editedConfig.winnerNumber || "",
                                    ),
                                    winnerName: String(
                                      editedConfig.winnerName || "",
                                    ),
                                  };

                                  const adminToken = localStorage.getItem("raffle_admin_token") || "";
                                  await adminService.saveConfig(adminToken, cleanConfig);

                                  // Instantly update local React state for optimistic real-time rendering
                                  setRaffleConfig(cleanConfig);
                                  setEditedConfig(cleanConfig);
                                  console.log("[ADMIN_ACTION_SUCCESS] Action: save-config (Toggle active status) successfully committed. Status is now:", nextState);
                                } catch (err: any) {
                                  console.error("[ADMIN_ACTION_ERROR] Action: save-config (Toggle active status) failed:", err);
                                  alert("Erro ao alternar status da rifa: " + err.message);
                                } finally {
                                  setIsTogglingActive(false);
                                }
                              }}
                              className={`w-full py-3.5 rounded-xl text-xs font-black tracking-widest transition-all uppercase cursor-pointer ${isTogglingActive ? "opacity-50 cursor-wait" : ""} ${raffleConfig.isActive ? "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-black" : "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-black"}`}
                            >
                              {isTogglingActive ? (
                                <span className="flex items-center justify-center gap-2">
                                  <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
                                  PROCESSANDO...
                                </span>
                              ) : raffleConfig.isActive ? (
                                "DESATIVAR AGORA"
                              ) : (
                                "ATIVAR AGORA"
                              )}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* CONFIGURATION FORM */}
                      <div className="bg-zinc-900/15 border border-zinc-900/80 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-[0_4px_35px_rgba(0,0,0,0.15)]">
                        <div className="border-b border-zinc-900/60 pb-3 flex items-center justify-between">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            ⚙️ Configuração Geral da Rifa
                          </h4>
                          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-800/80">
                            Realtime Sync
                          </span>
                        </div>

                        <div className="space-y-5">
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1.5 pl-1 select-none">
                              Título do Prêmio
                            </label>
                            <input
                              value={editedConfig.title || ""}
                              onChange={(e) =>
                                setEditedConfig((prev) => ({
                                  ...prev,
                                  title: e.target.value,
                                }))
                              }
                              placeholder="Ex: iPhone 15 Pro Max"
                              className="w-full bg-zinc-950 border border-zinc-850 focus:border-orange-500/80 focus:ring-4 focus:ring-orange-500/10 rounded-2xl px-4 py-3 text-sm text-zinc-200 font-bold outline-none transition-all placeholder:text-zinc-700"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1.5 pl-1 select-none">
                                Preço por Cota (R$)
                              </label>
                              <input
                                type="number"
                                value={editedConfig.price || ""}
                                onChange={(e) =>
                                  setEditedConfig((prev) => ({
                                    ...prev,
                                    price: Number(e.target.value),
                                  }))
                                }
                                placeholder="Ex: 10"
                                className="w-full bg-zinc-950 border border-zinc-850 focus:border-orange-500/80 focus:ring-4 focus:ring-orange-500/10 rounded-2xl px-4 py-3 text-sm text-zinc-200 font-bold outline-none transition-all placeholder:text-zinc-700"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1.5 pl-1 select-none">
                                Total de Números
                              </label>
                              <input
                                type="number"
                                value={editedConfig.totalNumbers || ""}
                                onChange={(e) =>
                                  setEditedConfig((prev) => ({
                                    ...prev,
                                    totalNumbers: Number(e.target.value),
                                  }))
                                }
                                placeholder="Ex: 150"
                                className="w-full bg-zinc-950 border border-zinc-850 focus:border-orange-500/80 focus:ring-4 focus:ring-orange-500/10 rounded-2xl px-4 py-3 text-sm text-zinc-200 font-bold outline-none transition-all placeholder:text-zinc-700"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1.5 pl-1 select-none">
                              Descrição do Prêmio
                            </label>
                            <textarea
                              value={editedConfig.description || ""}
                              onChange={(e) =>
                                setEditedConfig((prev) => ({
                                  ...prev,
                                  description: e.target.value,
                                }))
                              }
                              placeholder="Ex: Lacrado, 256GB..."
                              className="w-full bg-zinc-950 border border-zinc-850 focus:border-orange-500/80 focus:ring-4 focus:ring-orange-500/10 rounded-2xl px-4 py-3 text-sm text-zinc-200 font-bold outline-none transition-all min-h-[90px] placeholder:text-zinc-700 resize-none leading-relaxed"
                            />
                                <div className="mt-2 flex items-center gap-4">
                              {editedConfig.imageUrl ? (
                                <img
                                  src={editedConfig.imageUrl}
                                  className="w-16 h-16 rounded-2xl object-cover border border-zinc-850 shadow-md flex-shrink-0"
                                  alt="Preview"
                                />
                              ) : (
                                <div className="w-16 h-16 rounded-2xl bg-zinc-950 border border-zinc-850 flex items-center justify-center text-zinc-700 flex-shrink-0">
                                  <Smartphone className="w-6 h-6 animate-pulse" />
                                </div>
                              )}
                              <div className="flex-1 border-2 border-dashed border-zinc-850 hover:border-orange-500/50 bg-zinc-950/30 rounded-2xl p-4.5 text-center group transition-all duration-300 cursor-pointer relative">
                                <span className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-widest group-hover:text-orange-400 transition-colors flex flex-col items-center justify-center gap-1">
                                  {isUploadingImage ? (
                                    <>
                                      <span className="inline-flex items-center gap-1.5 text-orange-400">
                                        <Zap className="w-3 h-3 animate-bounce" />
                                        <span>Subindo {imageUploadProgress !== null ? `${imageUploadProgress}%` : ""}</span>
                                      </span>
                                    </>
                                  ) : (
                                    "Enviar Imagem Local"
                                  )}
                                </span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  disabled={isUploadingImage}
                                  className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setIsUploadingImage(true);
                                      setImageUploadProgress(1);
                                      setImageUploadError(null);

                                      performRobustImageUpload(file, {
                                        onProgress: (pct) => {
                                          setImageUploadProgress(pct);
                                        },
                                        onSuccess: async (url) => {
                                          console.log("📸 [IMAGE_UPLOAD_SUCCESS] ImgBB permanent upload succeeded. Public URL:", url);
                                          
                                          // Update both states immediately so that the form preview AND the public main raffle page display the new image instantly
                                          setEditedConfig((prev) => ({
                                            ...prev,
                                            imageUrl: url,
                                          }));
                                          setRaffleConfig((prev) => ({
                                            ...prev,
                                            imageUrl: url,
                                          }));
 
                                          // Persist definition immediately to the Firestore NoSQL database
                                          try {
                                            console.log("[IMAGE_SAVE_START] Persisting verified ImgBB URL to Firestore config...");
                                            const adminToken = localStorage.getItem("raffle_admin_token") || "";
                                            const currentEdited = editedConfigRef.current;
                                            const currentRaffle = raffleConfigRef.current;
                                            
                                            const configPayload = {
                                              title: String(currentEdited.title || currentRaffle.title || ""),
                                              description: String(currentEdited.description || currentRaffle.description || ""),
                                              price: Number(currentEdited.price || currentRaffle.price || 10),
                                              totalNumbers: Number(currentEdited.totalNumbers || currentRaffle.totalNumbers || 150),
                                              isActive: Boolean(currentRaffle.isActive),
                                              imageUrl: url,
                                              pixKeyType: String(currentEdited.pixKeyType || currentRaffle.pixKeyType || ""),
                                              pixBankLogo: String(currentEdited.pixBankLogo || currentRaffle.pixBankLogo || ""),
                                              pixKey: String(currentEdited.pixKey || currentRaffle.pixKey || ""),
                                              pixReceiver: String(currentEdited.pixReceiver || currentRaffle.pixReceiver || ""),
                                              pixBank: String(currentEdited.pixBank || currentRaffle.pixBank || ""),
                                              pixPhone: String(currentEdited.pixPhone || currentRaffle.pixPhone || ""),
                                              winnerNumber: String(currentEdited.winnerNumber || currentRaffle.winnerNumber || ""),
                                              winnerName: String(currentEdited.winnerName || currentRaffle.winnerName || ""),
                                            };
 
                                            await adminService.saveConfig(adminToken, configPayload);
                                            console.log("[IMAGE_SAVE_SUCCESS] Successfully saved and synchronized verified ImgBB URL:", url);
                                            console.log("⚙️ [IMAGE_FIRESTORE_SAVE] Firestore database successfully synchronized in real-time with image URL:", url);
                                          } catch (saveErr: any) {
                                            console.error("[IMAGE_SAVE_ERROR] Failed to save verified image URL to Firestore config:", saveErr);
                                            console.error("❌ [Image Update Error] Failed to contact save-config API during image upload completion:", saveErr);
                                            alert("Não foi possível persistir a nova imagem nas configurações do banco de dados.\n\nDetalhes do erro: " + (saveErr?.message || saveErr));
                                          }
 
                                          setIsUploadingImage(false);
                                          setTimeout(() => {
                                            setImageUploadProgress(null);
                                          }, 3000);
                                        },
                                        onError: (err) => {
                                          const errMsg = err.message || String(err);
                                          console.error("❌ [Image Update Error] ImgBB permanent upload failed in background:", errMsg);
                                          setImageUploadError(errMsg);
                                          setIsUploadingImage(false);
                                          setTimeout(() => {
                                            setImageUploadProgress(null);
                                          }, 3000);
                                        }
                                      }).catch((err) => {
                                        console.error("❌ [Image Update Error] Critical background upload task outer crash:", err);
                                        setIsUploadingImage(false);
                                        setImageUploadProgress(null);
                                      });
                                    }
                                  }}
                                />
                              </div>
                            </div>
                            <input
                              value={editedConfig.imageUrl || ""}
                              onChange={(e) =>
                                setEditedConfig((prev) => ({
                                  ...prev,
                                  imageUrl: e.target.value,
                                }))
                              }
                              placeholder="Cole o link da imagem da web aqui..."
                              className="w-full bg-zinc-950 border border-zinc-850 focus:border-orange-500/80 focus:ring-4 focus:ring-orange-500/10 rounded-2xl px-4 py-2.5 text-xs text-zinc-300 font-medium outline-none transition-all placeholder:text-zinc-700 mt-3"
                            />
                            {imageUploadError && (
                              <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 font-semibold leading-relaxed flex flex-col gap-1">
                                <span className="font-extrabold text-red-300 block">❌ FALHA NO ENVIO PARA IMGBB:</span>
                                <span>{imageUploadError}</span>
                                <span className="text-zinc-500 mt-1 text-[9px] leading-normal font-normal">
                                  A imagem foi temporariamente otimizada em formato local (Base64) para não interromper sua edição, mas recomendamos conferir a chave <strong>VITE_IMGBB_API_KEY</strong> nos Segredos/Ambiente ou tentar um arquivo de tamanho menor.
                                </span>
                              </div>
                            )}
                            {editedConfig.imageUrl && editedConfig.imageUrl.startsWith("data:") && editedConfig.imageUrl.length > 150000 && (
                              <div className="mt-3.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-400 font-medium leading-relaxed w-full">
                                <span className="font-extrabold text-amber-300 block mb-0.5">⚠️ ALERTA DE PERFORMANCE:</span>
                                A imagem salva atualmente está em formato de texto não otimizado (Base64 pesado). Isso pode lentificar o carregamento da página e exceder o limite do Firestore. É altamente recomendado configurar <strong>VITE_IMGBB_API_KEY</strong> e clicar em <strong>"Enviar Imagem Local"</strong> acima para salvá-la em alta performance no ImgBB e otimizar permanentemente a velocidade do seu site!
                              </div>
                            )}
                          </div>

                          <div className="border-t border-zinc-900/60 pt-5 flex flex-col gap-5">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                              <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                                Dados do Pix do Recebedor
                              </h5>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1.5 pl-1 select-none">
                                  Tipo da Chave Pix
                                </label>
                                <select
                                  value={editedConfig.pixKeyType || ""}
                                  onChange={(e) =>
                                    setEditedConfig((prev) => ({
                                      ...prev,
                                      pixKeyType: e.target.value,
                                    }))
                                  }
                                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/5 rounded-2xl px-4 py-3 text-sm text-zinc-200 font-bold outline-none transition-all placeholder:text-zinc-700"
                                >
                                  <option value="">Selecione o tipo...</option>
                                  <option value="Celular">Celular</option>
                                  <option value="E-mail">E-mail</option>
                                  <option value="CPF">CPF</option>
                                  <option value="CNPJ">CNPJ</option>
                                  <option value="Chave Aleatória">Chave Aleatória</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1.5 pl-1 select-none">
                                  Chave Pix para Recebimento
                                </label>
                                <input
                                  value={editedConfig.pixKey || ""}
                                  onChange={(e) =>
                                    setEditedConfig((prev) => ({
                                      ...prev,
                                      pixKey: e.target.value,
                                    }))
                                  }
                                  placeholder="E-mail, CPF, CNPJ ou Telefone..."
                                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/5 rounded-2xl px-4 py-3 text-sm text-zinc-200 font-bold outline-none transition-all placeholder:text-zinc-700"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1.5 pl-1 select-none">
                                  Nome Completo do Titular
                                </label>
                                <input
                                  value={editedConfig.pixReceiver || ""}
                                  onChange={(e) =>
                                    setEditedConfig((prev) => ({
                                      ...prev,
                                      pixReceiver: e.target.value,
                                    }))
                                  }
                                  placeholder="Nome igual ao cadastrado no banco"
                                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/5 rounded-2xl px-4 py-3 text-sm text-zinc-200 font-bold outline-none transition-all placeholder:text-zinc-700"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1.5 pl-1 select-none">
                                  Banco / Instituição Fin.
                                </label>
                                <input
                                  value={editedConfig.pixBank || ""}
                                  onChange={(e) =>
                                    setEditedConfig((prev) => ({
                                      ...prev,
                                      pixBank: e.target.value,
                                    }))
                                  }
                                  placeholder="Ex: Nubank, Mercado Pago..."
                                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/5 rounded-2xl px-4 py-3 text-sm text-zinc-200 font-bold outline-none transition-all placeholder:text-zinc-700"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1.5 pl-1 select-none">
                                  URL do Logotipo do Banco (Opcional)
                                </label>
                                <input
                                  value={editedConfig.pixBankLogo || ""}
                                  onChange={(e) =>
                                    setEditedConfig((prev) => ({
                                      ...prev,
                                      pixBankLogo: e.target.value,
                                    }))
                                  }
                                  placeholder="https://exemplo.com/logo.png"
                                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/5 rounded-2xl px-4 py-3 text-sm text-zinc-200 font-bold outline-none transition-all placeholder:text-zinc-700"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1.5 pl-1 select-none">
                                  WhatsApp do Administrador (para suporte)
                                </label>
                                <input
                                  value={editedConfig.pixPhone || ""}
                                  onChange={(e) =>
                                    setEditedConfig((prev) => ({
                                      ...prev,
                                      pixPhone: e.target.value,
                                    }))
                                  }
                                  placeholder="DDD + Número (ex: 5563999659203)"
                                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-emerald-500/60 focus:ring-4 focus:ring-emerald-500/5 rounded-2xl px-4 py-3 text-sm text-zinc-200 font-bold outline-none transition-all placeholder:text-zinc-700"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-zinc-900/60 pt-5 flex flex-col gap-4">
                            <h5 className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center justify-between pointer-events-none">
                              <span>🏆 Resultado do Sorteio (Ganhador)</span>
                              {isDrawing && (
                                <span className="animate-pulse text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md text-[9px] font-black">
                                  SORTEANDO EM {drawCountdown}s
                                </span>
                              )}
                            </h5>

                            {/* Automated Draw Widget */}
                            <div className="bg-zinc-950/70 border border-zinc-900 p-5 rounded-2xl flex flex-col items-center justify-center gap-4 relative overflow-hidden shadow-inner">
                              {(() => {
                                const paidCount = numbers.filter(
                                  (n) => n.status === "paid" || n.status === "bonus_paid",
                                ).length;
                                const total = raffleConfig.totalNumbers || 100;
                                const allPaid = paidCount === total;

                                if (isDrawing) {
                                  return (
                                    <div className="text-center py-4">
                                      <div className="text-5xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 animate-pulse tracking-widest">
                                        {drawScrambled}
                                      </div>
                                      <p className="text-zinc-500 text-[9px] uppercase font-black tracking-widest mt-2">
                                        Sorteando realtime entre cotas ativas...
                                      </p>
                                    </div>
                                  );
                                }

                                return (
                                  <>
                                    {!allPaid && (
                                      <div className="w-full text-zinc-400 text-xs text-center font-bold px-4 py-3 bg-red-500/[0.02] border border-red-500/15 rounded-xl flex flex-col items-center justify-center gap-1.5">
                                        <div className="flex items-center gap-1.5 text-red-500">
                                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                                          <span className="font-black text-[10px] uppercase tracking-widest">
                                            Sorteio Bloqueado
                                          </span>
                                        </div>
                                        <span className="text-[10px] sm:text-[11px] text-zinc-500 leading-normal">
                                          Faltam {total - paidCount} cotas a serem preenchidas e pagas ({paidCount}/{total} pagas)
                                        </span>
                                      </div>
                                    )}

                                    {pendingDrawId ? (
                                      <div className="w-full flex gap-3">
                                        <button
                                          type="button"
                                          onClick={handlePublishDraw}
                                          className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:brightness-110 text-white font-black text-[10px] py-4 rounded-xl transition-all shadow-md active:scale-95 uppercase tracking-widest cursor-pointer"
                                        >
                                          Publicar Resultado
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => setPendingDrawId(null)}
                                          className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold text-[10px] py-4 rounded-xl transition-all border border-zinc-800 uppercase tracking-widest cursor-pointer"
                                        >
                                          Cancelar Sorteio
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        disabled={!allPaid}
                                        onClick={handleDrawWinner}
                                        className={`w-full flex items-center justify-center gap-2 font-black text-xs py-4 px-6 rounded-xl transition-all shadow-md active:scale-95 ${
                                          allPaid
                                            ? "bg-gradient-to-r from-orange-500 to-amber-600 hover:brightness-110 text-white shadow-[0_4px_25px_rgba(249,115,22,0.15)] cursor-pointer"
                                            : "bg-zinc-900 border border-zinc-800 text-zinc-650 cursor-not-allowed opacity-50 select-none font-bold"
                                        }`}
                                      >
                                        <Trophy className="w-4 h-4" />
                                        SORTEAR AUTOMÁTICO (REALTIME 5S)
                                      </button>
                                    )}
                                  </>
                                );
                              })()}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1.5 pl-1 select-none">
                                  Número Ganhador
                                </label>
                                <input
                                  value={editedConfig.winnerNumber || ""}
                                  onChange={(e) => {
                                    const typed = e.target.value;
                                    const cleanNum = typed.trim();
                                    let autoName = editedConfig.winnerName || "";

                                    if (cleanNum) {
                                      const normalizeQuota = (q: string): string => {
                                        const cleaned = String(q).replace(/^0+/, "");
                                        return cleaned === "" ? "0" : cleaned;
                                      };
                                      const normalizedCleanNum = normalizeQuota(cleanNum);

                                      const matchingOrder =
                                        orders.find(
                                          (o) =>
                                            o.status === "Pago" &&
                                            Array.isArray(o.nums) &&
                                            o.nums.map(normalizeQuota).includes(normalizedCleanNum),
                                        ) ||
                                        orders.find(
                                          (o) =>
                                            o.status !== "Cancelado" &&
                                            Array.isArray(o.nums) &&
                                            o.nums.map(normalizeQuota).includes(normalizedCleanNum),
                                        );
                                      if (matchingOrder) {
                                        autoName = matchingOrder.name;
                                      }
                                    }

                                    setEditedConfig((prev) => ({
                                      ...prev,
                                      winnerNumber: typed,
                                      winnerName: autoName,
                                    }));
                                  }}
                                  placeholder="Número premiado oficial"
                                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-amber-500/60 focus:ring-4 focus:ring-amber-500/5 rounded-2xl px-4 py-3 text-sm text-zinc-200 font-bold outline-none transition-all placeholder:text-zinc-700"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1.5 pl-1 select-none">
                                  Nome do Vencedor Ganhador
                                </label>
                                <input
                                  value={editedConfig.winnerName || ""}
                                  onChange={(e) =>
                                    setEditedConfig((prev) => ({
                                      ...prev,
                                      winnerName: e.target.value,
                                    }))
                                  }
                                  placeholder="Nome do cliente sortudo"
                                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-amber-500/60 focus:ring-4 focus:ring-amber-500/5 rounded-2xl px-4 py-3 text-sm text-zinc-200 font-bold outline-none transition-all placeholder:text-zinc-700"
                                />
                              </div>

                              <div className="sm:col-span-2">
                                <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1.5 pl-1 select-none">
                                  Link do Vídeo do Sorteio (Opcional)
                                </label>
                                <input
                                  value={editedConfig.videoLink || ""}
                                  onChange={(e) =>
                                    setEditedConfig((prev) => ({
                                      ...prev,
                                      videoLink: e.target.value,
                                    }))
                                  }
                                  placeholder="Ex: https://www.youtube.com/watch?v=..."
                                  className="w-full bg-zinc-950 border border-zinc-850 focus:border-amber-500/60 focus:ring-4 focus:ring-amber-500/5 rounded-2xl px-4 py-3 text-sm text-zinc-200 font-bold outline-none transition-all placeholder:text-zinc-700"
                                />
                              </div>
                            </div>
                          </div>

                          <div className="border-t border-zinc-900/60 pt-5">
                            <button
                              onClick={async () => {
                                console.log("[CONFIG_SAVE_ATTEMPT] Started legacy settings form saving flow.");
                                try {
                                  if (isSavingSettings) return;

                                  // Utility clean/coerce/validate
                                  const getParsedVal = (fieldName: string, rawVal: any, options: { min?: number; max?: number; integerOnly?: boolean } = {}) => {
                                    const trimmed = String(rawVal === undefined || rawVal === null ? "" : rawVal).trim();
                                    if (trimmed === "") {
                                      const msg = `O campo '${fieldName}' é obrigatório e não pode ficar vazio.`;
                                      console.error(`[CONFIG_VALIDATION_ERROR] Field: ${fieldName}, Value is empty. Error: ${msg}`);
                                      throw new Error(msg);
                                    }
                                    const normalized = trimmed.replace(",", ".");
                                    if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
                                      const msg = `O valor '${rawVal}' do campo '${fieldName}' não está em um formato numérico válido.`;
                                      console.error(`[CONFIG_VALIDATION_ERROR] Field: ${fieldName}, Value: ${rawVal}, Expected format: Number. Error: ${msg}`);
                                      throw new Error(msg);
                                    }
                                    const value = options.integerOnly ? parseInt(normalized, 10) : parseFloat(normalized);
                                    if (isNaN(value)) {
                                      const msg = `O campo '${fieldName}' contém um valor inválido (NaN).`;
                                      console.error(`[CONFIG_VALIDATION_ERROR] Field: ${fieldName}, Parsed to NaN. Error: ${msg}`);
                                      throw new Error(msg);
                                    }
                                    if (options.min !== undefined && value < options.min) {
                                      const msg = `O valor do campo '${fieldName}' deve ser no mínimo ${options.min}.`;
                                      console.error(`[CONFIG_VALIDATION_ERROR] Field: ${fieldName}, Value: ${value}, Minimum: ${options.min}. Error: ${msg}`);
                                      throw new Error(msg);
                                    }
                                    if (options.max !== undefined && value > options.max) {
                                      const msg = `O valor do campo '${fieldName}' deve ser no máximo ${options.max}.`;
                                      console.error(`[CONFIG_VALIDATION_ERROR] Field: ${fieldName}, Value: ${value}, Maximum: ${options.max}. Error: ${msg}`);
                                      throw new Error(msg);
                                    }
                                    return value;
                                  };

                                  // Extract cleaned strings
                                  const titleCleaned = String(editedConfig.title || "").trim();
                                  if (!titleCleaned) {
                                    throw new Error("O campo 'Título do Prêmio' é obrigatório.");
                                  }

                                  const parsedPrice = getParsedVal("Preço por Cota", editedConfig.price, { min: 0.01 });
                                  const parsedTotal = getParsedVal("Total de Números", editedConfig.totalNumbers, { min: 1, max: 10000, integerOnly: true });

                                  let parsedProjBuy = editedConfig.promotionBuy || 5;
                                  let parsedProjBonus = editedConfig.promotionBonus || 1;
                                  if (editedConfig.promotionEnabled) {
                                    parsedProjBuy = getParsedVal("Promoção (Compre)", editedConfig.promotionBuy, { min: 1, integerOnly: true });
                                    parsedProjBonus = getParsedVal("Promoção (Ganhe)", editedConfig.promotionBonus, { min: 1, integerOnly: true });
                                  }

                                  const cleanConfig = {
                                    title: titleCleaned,
                                    description: String(editedConfig.description || "").trim(),
                                    price: parsedPrice,
                                    totalNumbers: parsedTotal,
                                    isActive: Boolean(raffleConfig.isActive),
                                    imageUrl: String(editedConfig.imageUrl || "").trim(),
                                    pixKeyType: String(editedConfig.pixKeyType || "").trim(),
                                    pixBankLogo: String(editedConfig.pixBankLogo || "").trim(),
                                    pixKey: String(editedConfig.pixKey || "").trim(),
                                    pixReceiver: String(editedConfig.pixReceiver || "").trim(),
                                    pixBank: String(editedConfig.pixBank || "").trim(),
                                    pixPhone: String(editedConfig.pixPhone || "").trim(),
                                    winnerNumber: String(editedConfig.winnerNumber || "").trim(),
                                    winnerName: String(editedConfig.winnerName || "").trim(),
                                    promotionEnabled: Boolean(editedConfig.promotionEnabled),
                                    promotionBuy: parsedProjBuy,
                                    promotionBonus: parsedProjBonus,
                                  };

                                  const paidCount = numbers.filter(
                                    (n) => n.status === "paid" || n.status === "bonus_paid",
                                  ).length;
                                  const total = raffleConfig.totalNumbers || 100;
                                  if (
                                    cleanConfig.winnerNumber &&
                                    cleanConfig.winnerNumber !== (raffleConfig.winnerNumber || "") &&
                                    paidCount < total
                                  ) {
                                    throw new Error(`O sorteio só é permitido se TODAS as cotas estiverem preenchidas e PAGAS!\n\nCotas pagas: ${paidCount} de ${total} (${total - paidCount} restantes).`);
                                  }

                                  setIsSavingSettings(true);
                                  console.log("[BUTTON_CLICK] 'Salvar Configurações' button trigger.");
                                  console.log("[CONFIG_SAVE_START] Began settings form saving flow.");
                                  console.log("[ADMIN_ACTION_START] Action: save-config (Save current config)");
                                  console.log("⚙️ [Save Settings] Iniciando salvamento das configurações com payload:", cleanConfig);

                                  const adminToken = localStorage.getItem("raffle_admin_token") || "";
                                  const wantActive = window.confirm("Deseja ativar a rifa para o público agora?");
                                  console.log("[MODAL_ACTION] Configuration activation confirm response:", wantActive);
                                  const configToSend = {
                                    ...cleanConfig,
                                    isActive: wantActive,
                                  };

                                  await adminService.saveConfig(adminToken, configToSend);

                                  // Update state variables immediately on client side to avoid lag
                                  setRaffleConfig(configToSend);
                                  setEditedConfig(configToSend);

                                  console.log("[CONFIG_SAVE_SUCCESS] Saved settings configured form fields successfully.");
                                  console.log("[ADMIN_ACTION_SUCCESS] Action: save-config successfully committed.");
                                  console.log("✅ [Save Settings Success] Configurações persistidas com sucesso no Firestore:", configToSend);
                                  alert("Suas configurações foram salvas com sucesso!");
                                } catch (err: any) {
                                  console.error("[CONFIG_SAVE_ERROR] Failed during configuration settings form saving:", err);
                                  console.error("[ADMIN_ACTION_ERROR] Action: save-config failed:", err);
                                  console.error("❌ [Save Settings Error] Falha ao persistir configurações no Firestore:", err);
                                  alert("Erro ao salvar configurações: " + err.message);
                                } finally {
                                  setIsSavingSettings(false);
                                }
                              }}
                              disabled={isSavingSettings}
                              className="w-full bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 hover:brightness-110 disabled:opacity-55 disabled:cursor-wait text-white font-black py-4 rounded-xl transition-all shadow-[0_4px_25px_rgba(249,115,22,0.15)] active:scale-95 cursor-pointer uppercase tracking-widest text-xs flex justify-center items-center gap-2"
                            >
                              {isSavingSettings ? (
                                <>
                                  <span className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent animate-spin" />
                                  SALVANDO CONFIGURAÇÕES...
                                </>
                              ) : (
                                "SALVAR CONFIGURAÇÃO ATUAL"
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* SYSTEM BACKUPS & SNAPS CARD */}
                    <div className="bg-zinc-900/15 border border-zinc-900/85 rounded-3xl p-6 sm:p-8 flex flex-col gap-6 shadow-[0_4px_35px_rgba(0,0,0,0.15)] mb-10">
                      <div className="border-b border-zinc-900/60 pb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-4 h-4 text-orange-400" />
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                            🛡️ Snapshots de Segurança & Backups de Produção
                          </h4>
                        </div>
                        <span className="text-[8px] font-black uppercase tracking-widest text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          Active Hot-Snapshots
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <p className="text-zinc-400 text-xs leading-relaxed font-semibold">
                            Baixe um backup local em formato compactado JSON contendo todos os dados vitais da aplicação. Isso inclui configurações gerais, imagem da rifa, cupons reservados, números pagos, dados cadastrais dos participantes, registros de pagamentos do Mercado Pago e histórico dos sorteios efetuados.
                          </p>
                          <button
                            disabled={isExportingBackup}
                            onClick={handleExportBackup}
                            className={`w-full py-3.5 px-6 rounded-xl text-xs font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
                              isExportingBackup
                                ? "bg-zinc-900 text-zinc-500 border border-zinc-800 animate-pulse"
                                : "bg-zinc-900 hover:bg-zinc-800 text-orange-400 hover:text-white border border-orange-500/10 hover:border-orange-500/25 active:scale-95"
                            }`}
                          >
                            {isExportingBackup ? (
                              <>
                                <span className="w-3.5 h-3.5 rounded-full border-2 border-orange-400 border-t-transparent animate-spin" />
                                EXPORTANDO...
                              </>
                            ) : (
                              <>
                                <TrendingUp className="w-4 h-4" />
                                EXPORTAR BACKUP COMPLETO (JSON)
                              </>
                            )}
                          </button>
                        </div>

                        <div className="space-y-3 border-t md:border-t-0 md:border-l border-zinc-900/60 pt-6 md:pt-0 md:pl-6 flex flex-col justify-between">
                          <p className="text-zinc-500 text-[11px] leading-relaxed font-semibold">
                            Restaure um snapshot completo arrastando ou selecionando o arquivo JSON em seu computador. Os dados serão consolidados e sincronizados em tempo real no banco de dados principal com zero tempo de inatividade. Em conformidade com o ecossistema Vercel.
                          </p>
                          
                          <div>
                            <label className="block w-full">
                              <span className="sr-only">Escolher arquivo de backup</span>
                              <input
                                type="file"
                                accept=".json"
                                disabled={isImportingBackup}
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    handleImportBackup(f);
                                  }
                                }}
                                className="block w-full text-xs text-zinc-500 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-[10px] file:font-black file:uppercase file:tracking-wider file:bg-orange-500/10 file:text-orange-400 hover:file:bg-orange-500/20 file:transition-all cursor-pointer"
                              />
                            </label>
                            {isImportingBackup && (
                              <div className="mt-3 flex items-center gap-2 text-[10px] text-orange-400 font-extrabold animate-pulse">
                                <span className="w-3 h-3 rounded-full border border-orange-400 border-t-transparent animate-spin" />
                                CONSOLIDANDO RESTAURAÇÃO DE DADOS...
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-12 mb-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-t border-zinc-900 pt-8">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                        <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tight flex items-center gap-2.5">
                          <span>📋 Pedidos Recentes</span>
                          <span className="text-[10px] bg-zinc-900 text-zinc-400 px-2 py-1 rounded-full font-extrabold uppercase tracking-widest border border-zinc-800">
                            {adminSearch || adminStatusFilter !== "Todos"
                              ? `${filteredOrders.length} DE ${orders.length} ENCONTRADOS`
                              : `${orders.length} PEDIDOS TOTAL`}
                          </span>
                        </h3>

                        {/* Status Filter for Admin Orders */}
                        <div className="flex flex-wrap gap-1 bg-zinc-950 p-1 border border-zinc-900 rounded-xl max-w-max">
                          {["Todos", "Pago", "Pendente", "Cancelado"].map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => setAdminStatusFilter(status)}
                              className={`px-3 py-1.5 text-[9px] uppercase font-black tracking-wider rounded-lg transition-all cursor-pointer ${
                                adminStatusFilter === status
                                  ? "bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md shadow-orange-600/15"
                                  : "text-zinc-500 hover:text-white"
                              }`}
                            >
                              {status}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Search Input for Admin */}
                      <div className="relative w-full md:w-80 group">
                        <Search className="w-4 h-4 absolute left-4.5 top-1/2 -translate-y-1/2 text-zinc-500 group-focus-within:text-orange-400 transition-colors pointer-events-none" />
                        <input
                          type="text"
                          value={adminSearch}
                          onChange={(e) => setAdminSearch(e.target.value)}
                          placeholder="Buscar por nome ou cota (ex: 082)..."
                          className="w-full bg-zinc-950 border border-zinc-850 focus:border-orange-500/80 focus:ring-4 focus:ring-orange-500/10 rounded-2xl pl-12 pr-10 py-3.5 text-xs text-white placeholder-zinc-700 font-semibold transition-all outline-none"
                        />
                        {adminSearch && (
                          <button
                            onClick={() => setAdminSearch("")}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white text-base font-black cursor-pointer px-1 active:scale-90"
                          >
                            ×
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto rounded-3xl border border-zinc-900 bg-zinc-950/20 shadow-md scrollbar-none mb-4">
                      <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                          <tr className="bg-zinc-900/40 text-zinc-500 text-[9px] uppercase font-black tracking-widest border-b border-zinc-900">
                            <th className="px-6 py-4.5">Status</th>
                            <th className="px-6 py-4.5">Cliente</th>
                            <th className="px-6 py-4.5">WhatsApp</th>
                            <th className="px-6 py-4.5">Números (Cotas)</th>
                            <th className="px-6 py-4.5">Valor Total</th>
                            <th className="px-6 py-4.5 text-center">Ações de Gestão</th>
                          </tr>
                        </thead>

                        <tbody className="divide-y divide-zinc-900/60 font-semibold text-xs text-zinc-200">
                          {filteredOrders.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 font-bold uppercase tracking-wider">
                                🚫 Nenhum pedido encontrado para esta busca
                              </td>
                            </tr>
                          ) : (
                            filteredOrders.map((item) => (
                              <tr
                                key={item.id}
                                className="hover:bg-zinc-900/10 transition-colors"
                              >
                                <td className="px-6 py-5">
                                  <span
                                    className={`
                                    text-[9px] px-3.5 py-1.5 rounded-full font-black uppercase tracking-widest border
                                    ${
                                      item.status === "Pago"
                                        ? "bg-emerald-500/5 text-emerald-400 border-emerald-500/15"
                                        : item.status === "Cancelado"
                                          ? "bg-red-500/5 text-red-400 border-red-500/15"
                                          : item.status === "expired"
                                            ? "bg-red-500/10 text-rose-400 border-red-500/20"
                                            : item.status === "Reembolsado"
                                              ? "bg-zinc-900 text-zinc-500 border-zinc-800"
                                              : "bg-orange-500/5 text-orange-400 border-orange-500/15"
                                    }
                                  `}
                                  >
                                    {item.status === "expired" ? "Expirado" : item.status}
                                  </span>
                                </td>
                                <td className="px-6 py-5 text-sm font-black text-zinc-100">
                                  <div>{item.name}</div>
                                  {item.paymentCollisionError && (
                                    <div className="text-[9px] text-red-400 mt-1.5 uppercase font-bold tracking-widest bg-red-950/20 px-2 py-1 rounded border border-red-500/20 block text-left leading-normal">
                                      ⚠️ Pago atrasado após expirar com colisão! Reembolsar ou trocar cotas.
                                    </div>
                                  )}
                                </td>
                                <td className="px-6 py-5 text-zinc-400 tabular-nums">
                                  <a href={`https://wa.me/55${String(item.phone || "").replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className="hover:text-emerald-400 flex items-center gap-2 transition-colors cursor-pointer" title="Abrir WhatsApp do cliente">
                                    <MessageCircle className="w-3.5 h-3.5"/>
                                    {item.phone}
                                  </a>
                                </td>
                                <td className="px-6 py-5">
                                  <div className="flex flex-wrap gap-1.5 max-w-[280px]">
                                    {item.nums.map((n) => (
                                      <span
                                        key={n}
                                        className="bg-zinc-900 px-3 py-1 rounded-xl text-[11px] font-mono border border-zinc-850 flex items-center gap-1.5 text-zinc-300 font-bold shadow-sm"
                                      >
                                        {n}
                                        {item.status === "Aguardando" && (
                                          <button
                                            onClick={() =>
                                              handleReleaseSingleCota(item.id, n)
                                            }
                                            title={`Liberar cota ${n}`}
                                            className="text-red-500 hover:text-red-400 font-black ml-1 text-sm px-1 hover:bg-red-500/10 rounded-md transition-colors active:scale-90"
                                          >
                                            ×
                                          </button>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-6 py-5 text-sm font-black text-emerald-400 tabular-nums">
                                  R$ {item.val.toLocaleString("pt-BR")}
                                </td>
                                <td className="px-6 py-5">
                                  {item.status === "Aguardando" && (
                                    <div className="flex gap-2 justify-center">
                                      <button
                                        onClick={() =>
                                          handleAction(item.id, "confirm")
                                        }
                                        title="Confirmar Todas"
                                        className="bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-black hover:shadow-md hover:shadow-emerald-500/20 px-3 py-2 rounded-xl border border-emerald-500/15 transition-all active:scale-95 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest cursor-pointer"
                                      >
                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                        Confirmar
                                      </button>
                                      <button
                                        onClick={() =>
                                          handleAction(item.id, "cancel")
                                        }
                                        title="Recusar Todas"
                                        className="bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-black hover:shadow-md hover:shadow-red-500/20 px-3 py-2 rounded-xl border border-red-500/15 transition-all active:scale-95 flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest cursor-pointer"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                        Recusar
                                      </button>
                                    </div>
                                  )}
                                  {item.status === "Pago" && (
                                    <div className="flex justify-center">
                                      <button
                                        onClick={() =>
                                          handleAction(item.id, "refund")
                                        }
                                        title="Reembolsar e liberar cota"
                                        className="bg-yellow-500/5 hover:bg-yellow-550 text-yellow-500 hover:text-black hover:shadow-md hover:shadow-yellow-500/25 px-4.5 py-2.5 transition-all active:scale-95 border border-yellow-500/15 rounded-xl flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest cursor-pointer"
                                      >
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" />
                                        Reembolsar & Liberar
                                      </button>
                                    </div>
                                  )}
                                  {item.status !== "Aguardando" && item.status !== "Pago" && (
                                    <span className="text-[10px] text-zinc-650 block text-center italic font-bold">
                                      Nenhuma ação / Concluído
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </motion.div>
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* DISCRETE PREMIUM FOOTER */}
      {isConfigLoaded && (
        <>
          <footer className="border-t border-[#121212] bg-[#070707] pt-16 pb-32 sm:pb-16 px-6 relative z-10 font-montserrat select-none">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-10 md:gap-6 border-b border-[#121212] pb-12">
              <div className="space-y-4 max-w-sm">
                <div className="flex items-center gap-2">
                  <h4 className="text-xl font-bold text-white tracking-tight">
                    Rifa<span className="text-amber-400 font-black">Master</span>
                  </h4>
                </div>
                <p className="text-zinc-500 text-xs font-semibold uppercase tracking-wider">
                  Pesca • Camping • Aventura
                </p>
                <p className="text-zinc-600 text-xs leading-relaxed">
                  Oferecendo oportunidades reais de conquistar os melhores equipamentos do mundo outdoor com transparência, segurança e auditoria pública garantidas por criptografia matemática.
                </p>
              </div>

              <div className="flex flex-wrap gap-x-12 gap-y-6">
                <div className="space-y-3.5">
                  <h5 className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Navegação</h5>
                  <ul className="space-y-2 text-xs font-bold text-zinc-400">
                    <li>
                      <button
                        onClick={() => {
                          window.history.pushState({}, "", "/");
                          setCurrentPath("/");
                          setTimeout(() => {
                            document.getElementById("rifas-section")?.scrollIntoView({ behavior: "smooth" });
                          }, 100);
                        }}
                        className="hover:text-white transition-colors cursor-pointer"
                      >
                        Rifas Ativas
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          window.history.pushState({}, "", "/auditoria");
                          setCurrentPath("/auditoria");
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        className="hover:text-white transition-colors cursor-pointer"
                      >
                        Auditoria Pública
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          window.history.pushState({}, "", "/");
                          setCurrentPath("/");
                          setTimeout(() => {
                            document.getElementById("como-funciona-section")?.scrollIntoView({ behavior: "smooth" });
                          }, 100);
                        }}
                        className="hover:text-white transition-colors cursor-pointer"
                      >
                        Como Funciona
                      </button>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3.5">
                  <h5 className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Legal & Suporte</h5>
                  <ul className="space-y-2 text-xs font-bold text-zinc-400">
                    <li>
                      <button
                        onClick={() => {
                          setInfoModalContent({
                            title: "Termos de Uso - Rifa Master",
                            text: "1. A participação nas campanhas do Rifa Master é destinada a maiores de 18 anos.\n\n2. Cada cota adquirida representa uma fração de participação no sorteio final associado à campanha.\n\n3. O sorteio oficial é executado de forma provably fair. O seed secreto criptografado correspondente a cada rifa é fixado antes do início de qualquer venda de cotas e publicado na rede como commitment SHA-256.\n\n4. Após a venda de 100% das cotas, o seed secreto original é revelado publicamente. O algoritmo de embaralhamento Fisher-Yates (DETERMINÍSTICO) é utilizado para associar de forma aleatória as cotas à população imutável de participantes com base neste seed.\n\n5. Pagamentos via Pix são processados e confirmados automaticamente por nossos intermediadores integrados de alta segurança. Caso ocorra qualquer falha no processo, entre em contato imediatamente através dos canais de suporte oficiais no WhatsApp."
                          });
                        }}
                        className="hover:text-white transition-colors cursor-pointer text-left"
                      >
                        Termos de Uso
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          setInfoModalContent({
                            title: "Política de Privacidade - Rifa Master",
                            text: "1. Nós respeitamos profundamente a sua privacidade e segurança de dados.\n\n2. As informações de contato fornecidas no momento da reserva de cotas (Nome completo, Telefone e E-mail) são coletadas com a finalidade exclusiva de processar pagamentos e viabilizar a entrega dos prêmios aos respectivos ganhadores.\n\n3. Nós não comercializamos nem compartilhamos seus dados pessoais com terceiros sob nenhuma circunstância.\n\n4. As transações financeiras são criptografadas de ponta a ponta através de conexões SSL seguras com nossos parceiros de pagamento autorizados.\n\n5. Você poderá solicitar a exclusão total de seus dados cadastrais a qualquer momento entrando em contato direto com o suporte."
                          });
                        }}
                        className="hover:text-white transition-colors cursor-pointer text-left"
                      >
                        Política de Privacidade
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          const cleanPhone = String(raffleConfig.pixPhone || raffleConfig.pixKey || "5563999659203").replace(/\D/g, "");
                          const waLink = `https://wa.me/55${cleanPhone}?text=Ol%C3%A1%2C%20tenho%20d%C3%BAvidas%20sobre%20as%20rifas!`;
                          window.open(waLink, "_blank");
                        }}
                        className="hover:text-amber-400 transition-colors cursor-pointer text-left flex items-center gap-1"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Suporte WhatsApp</span>
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="max-w-7xl mx-auto pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-zinc-500 text-[10px] sm:text-xs font-semibold tracking-wider uppercase">
              <span className="tracking-[0.15em]">&copy; 2026 RIFA MASTER • TODOS OS DIREITOS RESERVADOS</span>
              <span className="tracking-widest text-amber-500/50">
                Desenvolvido por{" "}
                <a
                  href="https://www.instagram.com/lucaspescadoresportivo?igsh=MWhrcGo4c2tnbjBwZA%3D%3D&utm_source=qr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 font-black transition-colors duration-300 cursor-pointer pb-0.5 normal-case tracking-normal hover:underline"
                >
                  Lucas Gomes
                </a>
              </span>
            </div>
          </footer>

          {/* DYNAMIC TERMS & PRIVACY MODAL */}
          <AnimatePresence>
            {infoModalContent && (
              <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                {/* Overlay backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setInfoModalContent(null)}
                  className="fixed inset-0 bg-black/80 backdrop-blur-md"
                />
                
                {/* Modal Container */}
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 15 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 15 }}
                  transition={{ duration: 0.3 }}
                  className="bg-[#0A0A0A] border border-zinc-850 rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col relative z-10 overflow-hidden shadow-2xl shadow-black"
                >
                  {/* Header */}
                  <div className="p-6 border-b border-zinc-900 flex justify-between items-center bg-zinc-950/40">
                    <h3 className="text-sm font-black text-amber-400 uppercase tracking-wider">
                      {infoModalContent.title}
                    </h3>
                    <button
                      onClick={() => setInfoModalContent(null)}
                      className="p-1.5 hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-white transition-colors cursor-pointer"
                      aria-label="Fechar"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                  
                  {/* Content body with custom styling */}
                  <div className="p-6 overflow-y-auto text-zinc-300 text-xs sm:text-sm leading-relaxed space-y-4 font-montserrat select-text scrollbar-thin">
                    {infoModalContent.text.split("\n\n").map((para, idx) => (
                      <p key={idx}>{para}</p>
                    ))}
                  </div>
                  
                  {/* Footer */}
                  <div className="p-4 border-t border-zinc-900 bg-zinc-950/40 flex justify-end">
                    <button
                      onClick={() => setInfoModalContent(null)}
                      className="bg-amber-500 hover:bg-amber-400 text-black font-extrabold uppercase text-xs px-5 py-2.5 rounded-xl transition-all cursor-pointer"
                    >
                      Entendi
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}

      {/* FIXED SUMMARY BAR */}
      <AnimatePresence>
        {selectedNumbers.length > 0 &&
          raffleConfig.isActive &&
          raffleConfig.isRaffleActive !== false &&
          paymentStep !== "finished" &&
          !isCheckoutVisible && (
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="fixed bottom-0 left-0 right-0 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur-xl z-[150] shadow-[0_-10px_50px_rgba(0,0,0,0.8)]"
            >
              <div className="max-w-7xl mx-auto px-4 py-3 flex flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3 sm:gap-6">
                  <div className="bg-orange-600 p-2 sm:p-3 rounded-xl sm:rounded-2xl shadow-lg shadow-orange-600/20 flex flex-col items-center min-w-[50px] sm:min-w-[60px]">
                    <span className="text-lg sm:text-2xl font-black tabular-nums leading-none">
                      {selectedNumbers.length}
                    </span>
                    <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-tighter opacity-60">
                      COTAS
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <p className="text-zinc-500 text-[8px] sm:text-[10px] uppercase font-black tracking-widest hidden xs:block">
                        Expira em:
                      </p>
                      <span className="text-orange-400 text-[10px] font-black tabular-nums">
                        {formatTime(timerInSeconds)}
                      </span>
                    </div>
                    <h3 className="text-lg sm:text-2xl font-black text-white tabular-nums leading-none mt-0.5">
                      R$ {(selectedNumbers.length * raffleConfig.price).toFixed(2).replace(".", ",")}
                    </h3>
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setShowExitConfirm(true);
                    }}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-400 p-3 sm:px-6 sm:py-3 rounded-xl sm:rounded-2xl font-bold transition-all active:scale-95 border border-zinc-700"
                    title="Limpar seleção"
                  >
                    <span className="hidden sm:inline">LIMPAR</span>
                    <div className="sm:hidden w-4 h-4 flex items-center justify-center text-[10px]">
                      X
                    </div>
                  </button>

                  {paymentStep === "data" ? (
                    <button
                      onClick={() => {
                        const el = document.getElementById("payment-section");
                        el?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white px-4 py-3 sm:px-8 sm:py-3 rounded-xl sm:rounded-2xl font-black transition-all shadow-xl shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
                    >
                      CONTINUAR
                      <Smartphone className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        const el = document.getElementById("payment-section");
                        el?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white px-4 py-3 sm:px-8 sm:py-3 rounded-xl sm:rounded-2xl font-black transition-all shadow-xl shadow-orange-500/20 active:scale-95 flex items-center justify-center gap-2 text-xs sm:text-sm cursor-pointer"
                    >
                      FINALIZAR
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
      </AnimatePresence>

      {/* Sorteador Rifa Master Fullscreen Drawing Countdown Takeover */}
      <AnimatePresence>
        {isDrawing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-zinc-950/98 backdrop-blur-2xl z-[999] flex flex-col items-center justify-center p-6 text-center select-none"
          >
            {/* Ambient glowing blobs */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/20 rounded-full blur-[120px] pointer-events-none animate-pulse" />
            <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-96 h-96 bg-orange-500/10 rounded-full blur-[120px] pointer-events-none animate-pulse" />

            {/* Main Stage */}
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="max-w-xl w-full bg-gradient-to-b from-zinc-900 to-zinc-950 border-2 border-amber-500/30 rounded-[3rem] p-8 sm:p-12 relative overflow-hidden shadow-[0_0_80px_rgba(245,158,11,0.25)] flex flex-col items-center gap-8"
            >
              {drawCountdown === -1 ? (
                <>
                  {/* Winner Celebrating State */}
                  <div className="flex flex-col items-center gap-2">
                    <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-xs font-black uppercase tracking-widest px-5 py-2 rounded-full shadow-lg shadow-amber-500/35 animate-bounce">
                      🏆 GANHADOR CONFIRMADO 🎫
                    </span>
                    <h2 className="text-white font-black text-2xl sm:text-3xl tracking-tighter mt-3 leading-none">
                      Parabéns ao Sorteado! 🎉
                    </h2>
                  </div>

                  {/* Big Ganhador Trophy Emblem */}
                  <motion.div
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 15 }}
                    className="relative w-36 h-36 bg-amber-500/10 text-amber-400 rounded-full flex items-center justify-center border-2 border-amber-500/30 shadow-[0_0_40px_rgba(245,158,11,0.2)]"
                  >
                    <Trophy className="w-16 h-16 animate-pulse" />
                  </motion.div>

                  {/* Winner Number and Name Big Card */}
                  <div className="w-full space-y-4">
                    <div className="bg-zinc-950/80 border-2 border-amber-500/50 rounded-2xl py-4 px-6 flex flex-col items-center gap-1 shadow-2xl">
                      <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                        Número Premiado
                      </span>
                      <span className="text-6xl font-mono font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 tracking-widest">
                        {drawScrambled}
                      </span>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl py-4 px-6 flex flex-col items-center gap-1">
                      <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                        Nome do Ganhador(a)
                      </span>
                      <span className="text-white font-black text-2xl tracking-tight block truncate max-w-full">
                        {editedConfig.winnerName}
                      </span>
                    </div>
                  </div>

                  {/* Bottom Return indicator */}
                  <div className="flex items-center gap-2 text-zinc-500 text-xs font-bold animate-pulse mt-1">
                    <span>Retornando ao painel em instantes...</span>
                  </div>
                </>
              ) : (
                <>
                  {/* Decorative Header */}
                  <div className="flex flex-col items-center gap-2">
                    <span className="bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg shadow-amber-500/20">
                      Sorteador Oficial Rifa Master 🎫
                    </span>
                    <h2 className="text-zinc-400 font-bold uppercase tracking-widest text-xs mt-2">
                      Gerando Resultado Premiado
                    </h2>
                  </div>

                  {/* Big Countdown Timer Circle / Card */}
                  <div className="relative w-48 h-48 sm:w-56 sm:h-56 flex items-center justify-center">
                    {/* Visual animated ring */}
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        ease: "linear",
                        duration: 2,
                        repeat: Infinity,
                      }}
                      className="absolute inset-0 border-4 border-dashed border-amber-500/20 rounded-full"
                    />
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{
                        ease: "linear",
                        duration: 4,
                        repeat: Infinity,
                      }}
                      className="absolute inset-4 border border-zinc-700/50 rounded-full"
                    />
                    <motion.div
                      animate={{ scale: [1, 1.05, 1] }}
                      transition={{ duration: 1, repeat: Infinity }}
                      className="absolute inset-8 bg-amber-500/5 rounded-full border border-amber-500/10"
                    />

                    {/* Big Giant Countdown Digit */}
                    <span className="absolute text-8xl sm:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-400 select-none cursor-default drop-shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                      {drawCountdown}
                    </span>
                  </div>

                  {/* Live spinning ticker style container */}
                  <div className="w-full bg-zinc-950 border border-zinc-800 rounded-2xl py-5 px-6 flex flex-col items-center gap-2 relative shadow-inner">
                    <span className="text-zinc-500 text-[10px] font-black uppercase tracking-widest">
                      Número Embaralhado
                    </span>
                    <span className="text-5xl font-mono font-black text-amber-400 tracking-wider">
                      {drawScrambled}
                    </span>
                  </div>

                  {/* Informative Subtext */}
                  <p className="text-zinc-400 text-sm max-w-sm mt-2 font-medium leading-relaxed">
                    Aguarde... Buscando ganhador entre todos os compradores de
                    bilhetes ativas da nossa rifa premium!
                  </p>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONFIRMATION EXIT MODAL */}
      <AnimatePresence>
        {showExitConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[220] flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-zinc-900 border border-zinc-850 rounded-3xl p-6 sm:p-10 max-w-md w-full shadow-2xl text-center space-y-6"
            >
              <div className="bg-red-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto text-red-500">
                <AlertTriangle className="w-8 h-8" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-black text-white">
                  Você ainda não finalizou seu pagamento
                </h3>
                <p className="text-zinc-500 text-sm font-medium leading-relaxed">
                  Deseja continuar com suas cotas selecionadas ou desistir da compra? Se desistir, as cotas serão liberadas para outros compradores de imediato.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  onClick={() => {
                    setShowExitConfirm(false);
                    if (mpPaymentInfo) {
                      setPaymentStep("pix");
                    }
                    const el = document.getElementById("payment-section");
                    el?.scrollIntoView({ behavior: "smooth" });
                  }}
                  className="w-full bg-orange-600 hover:bg-orange-500 text-white font-black py-3 rounded-xl transition-all shadow-lg active:scale-95 text-sm"
                >
                  Continuar pagamento
                </button>
                
                <button
                  onClick={async () => {
                    const sessionNumsFromDb = Object.keys(dbNumbers).filter(
                      (num) => dbNumbers[num]?.sessionId === sessionId && dbNumbers[num]?.status !== "paid" && dbNumbers[num]?.status !== "Pago"
                    );
                    const sessionNumsFromLocks = Object.keys(locks).filter(
                      (num) => locks[num]?.sessionId === sessionId
                    );
                    const targetsToRelease = Array.from(
                      new Set([
                        ...selectedNumbers,
                        ...submittedNumbers,
                        ...sessionNumsFromDb,
                        ...sessionNumsFromLocks,
                      ])
                    );

                    if (mpPaymentInfo?.orderId) {
                      try {
                        const orderDocRef = doc(db, "orders", mpPaymentInfo.orderId);
                        const freshSnap = await getDoc(orderDocRef);
                        if (freshSnap.exists()) {
                          const statusStr = (freshSnap.data()?.status || "").toLowerCase();
                          if (statusStr === "pago" || statusStr === "paid" || statusStr === "confirmed") {
                            console.log("🛑 Order is already Pago/paid. Aborting exit cancellation.");
                            setPaymentStep("finished");
                            alert("Seu pagamento já foi aprovado e seu pedido está confirmado! Suas cotas estão garantidas.");
                            setShowExitConfirm(false);
                            return;
                          }
                        }
                        ignoreCancellationForOrderIdRef.current = mpPaymentInfo.orderId;
                        await pixService.cancelOrder({
                          orderId: mpPaymentInfo.orderId,
                          sessionId,
                          raffleId: selectedCustomerRaffleId || raffleConfig.id || "current",
                        });
                      } catch (err: any) {
                        console.error("Error canceling order remotely on desist:", err);
                      }
                    } else if (sessionId) {
                      try {
                        await pixService.cancelOrder({
                          sessionId,
                          raffleId: selectedCustomerRaffleId || raffleConfig.id || "current",
                        });
                      } catch (err: any) {
                        console.error("Error canceling session remotely on desist:", err);
                      }
                    }

                    if (targetsToRelease.length > 0) {
                      await clearMyLocks(targetsToRelease);
                    }

                    recentlyToggledRef.current = {};
                    setSelectedNumbers([]);
                    setSubmittedNumbers([]);
                    setMpPaymentInfo(null);
                    setPaymentExpiresAt(null);
                    setSelectionExpiresAt(null);
                    setLastBonusNums([]);

                    setDbNumbers((prev) => {
                      const next = { ...prev };
                      targetsToRelease.forEach((num) => delete next[num]);
                      return next;
                    });
                    setLocks((prev) => {
                      const next = { ...prev };
                      targetsToRelease.forEach((num) => delete next[num]);
                      return next;
                    });

                    try {
                      localStorage.removeItem("raffle_selected_numbers_v1");
                      localStorage.removeItem("raffle_submitted_numbers_v1");
                      localStorage.removeItem("raffle_payment_step_v1");
                    } catch (e) {}

                    setShowExitConfirm(false);
                    setPaymentStep("data");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 font-bold py-3 rounded-xl transition-all active:scale-95 text-sm hover:text-white"
                >
                  Desistir da compra
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* AUDIT INFORMATION MODAL */}
      <AnimatePresence>
        {isAuditModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[230] flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setIsAuditModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0D0D0D] border border-zinc-800 rounded-3xl p-6 sm:p-8 max-w-2xl w-full shadow-2xl space-y-6 relative max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              {/* Close Button */}
              <button
                onClick={() => setIsAuditModalOpen(false)}
                className="absolute top-5 right-5 w-9 h-9 rounded-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-all cursor-pointer z-10"
              >
                <X className="w-5 h-5" />
              </button>

              {/* Header */}
              <div className="flex items-start gap-4 pr-8">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-wider mb-1">
                    <Lock className="w-3 h-3" />
                    <span>Provably Fair & Transparência Criptográfica</span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
                    Como Funciona Nossa Auditoria
                  </h3>
                </div>
              </div>

              {/* Intro Banner */}
              <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-2xl space-y-2">
                <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed">
                  No <strong>RifaMaster</strong>, os sorteios não dependem de sorteios manuais ou de sistemas ocultos. Cada resultado é gerado por um algoritmo <strong>100% determinístico e auditável</strong> por qualquer pessoa.
                </p>
              </div>

              {/* Steps Breakdown */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Os 4 Pilares da Auditoria</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Pillar 1 */}
                  <div className="bg-zinc-900/60 border border-zinc-850 p-4 rounded-2xl space-y-1.5">
                    <div className="text-amber-400 font-black text-xs uppercase flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">1</span>
                      <span>Commitment Pré-Vendas</span>
                    </div>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">
                      Antes de abrir as vendas, publicamos o HASH (SHA-256) da semente secreta. Isso impede que o resultado seja alterado posteriormente.
                    </p>
                  </div>

                  {/* Pillar 2 */}
                  <div className="bg-zinc-900/60 border border-zinc-850 p-4 rounded-2xl space-y-1.5">
                    <div className="text-amber-400 font-black text-xs uppercase flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">2</span>
                      <span>Fisher-Yates Shuffle</span>
                    </div>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">
                      Utilizamos a semente para inicializar o consagrado algoritmo de embaralhamento criptográfico Fisher-Yates, garantindo chances idênticas a todos os bilhetes.
                    </p>
                  </div>

                  {/* Pillar 3 */}
                  <div className="bg-zinc-900/60 border border-zinc-850 p-4 rounded-2xl space-y-1.5">
                    <div className="text-amber-400 font-black text-xs uppercase flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">3</span>
                      <span>Verificação Aberta</span>
                    </div>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">
                      Após o encerramento, o Seed é revelado. Qualquer participante pode copiar os dados e re-executar a auditoria na nossa página ou localmente no seu computador.
                    </p>
                  </div>

                  {/* Pillar 4 */}
                  <div className="bg-zinc-900/60 border border-zinc-850 p-4 rounded-2xl space-y-1.5">
                    <div className="text-amber-400 font-black text-xs uppercase flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px]">4</span>
                      <span>Loteria Federal</span>
                    </div>
                    <p className="text-zinc-400 text-[11px] leading-relaxed">
                      Para campanhas vinculadas à Loteria Federal, os números são extraídos diretamente do resultado oficial divulgado pela Caixa Econômica Federal.
                    </p>
                  </div>
                </div>
              </div>

              {/* Terminal Code Example */}
              <div className="bg-zinc-950 border border-zinc-850 p-3.5 rounded-2xl font-mono text-[10px] text-zinc-400 space-y-1">
                <div className="text-zinc-500">// Fórmula de Validação Pública (Hash Determinístico)</div>
                <div className="text-amber-400 font-bold">result = FisherYates(seed, totalTickets)</div>
                <div className="text-zinc-500">SHA256(seed) == HashPublicadoAntesDoSorteio</div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                <button
                  onClick={() => {
                    setIsAuditModalOpen(false);
                    window.history.pushState({}, "", "/auditoria");
                    setCurrentPath("/auditoria");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className="w-full sm:w-auto flex-1 bg-amber-500 hover:bg-amber-400 text-black font-black uppercase text-xs tracking-wider py-3.5 px-6 rounded-xl transition-all shadow-lg shadow-amber-500/15 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Acessar Painel Completo de Auditoria</span>
                </button>
                <button
                  onClick={() => setIsAuditModalOpen(false)}
                  className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold text-xs uppercase py-3.5 px-6 rounded-xl transition-all border border-zinc-800 cursor-pointer active:scale-95"
                >
                  Fechar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WINNER DETAILS MODAL */}
      <AnimatePresence>
        {selectedWinnerModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[230] flex items-center justify-center p-4 overflow-y-auto"
            onClick={() => setSelectedWinnerModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0D0D0D] border border-zinc-800 rounded-3xl overflow-hidden max-w-lg w-full shadow-2xl relative max-h-[90vh] flex flex-col"
            >
              {/* Header Image Banner */}
              <div className="relative h-56 w-full bg-zinc-950 shrink-0">
                {selectedWinnerModal.prizeImageUrl ? (
                  <img
                    src={selectedWinnerModal.prizeImageUrl}
                    alt={selectedWinnerModal.prizeTitle}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-zinc-900 text-zinc-700">
                    <Trophy className="w-16 h-16 text-amber-500/40" />
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0D0D0D] via-black/30 to-transparent" />

                {/* Close Button */}
                <button
                  onClick={() => setSelectedWinnerModal(null)}
                  className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/70 hover:bg-black border border-white/20 text-white flex items-center justify-center transition-all cursor-pointer z-10"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Winning Badge */}
                <div className="absolute top-4 left-4 z-10 bg-amber-500 text-black text-[10px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-xl flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 fill-black" />
                  <span>Contemplado Oficial</span>
                </div>

                <div className="absolute bottom-4 left-4 right-4 z-10">
                  <span className="text-zinc-400 text-[10px] uppercase font-bold tracking-widest block mb-0.5">
                    Prêmio Sorteado
                  </span>
                  <h3 className="text-xl font-black text-white leading-tight uppercase truncate">
                    {selectedWinnerModal.prizeTitle}
                  </h3>
                </div>
              </div>

              {/* Modal Content Body */}
              <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
                {/* Winner Info Box */}
                <div className="bg-zinc-950 border border-zinc-850 p-4 rounded-2xl flex items-center gap-4">
                  {selectedWinnerModal.winnerImageUrl ? (
                    <img
                      src={selectedWinnerModal.winnerImageUrl}
                      alt={selectedWinnerModal.winnerName}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-full object-cover border-2 border-amber-500 shrink-0 shadow-lg"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-full bg-amber-500/10 border-2 border-amber-500 text-amber-400 flex items-center justify-center font-black text-xl shrink-0">
                      🏆
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest block mb-0.5">
                      Ganhador(a) do Sorteio
                    </span>
                    <h4 className="text-lg font-black text-white uppercase truncate">
                      {selectedWinnerModal.winnerName || "Ganhador Anônimo"}
                    </h4>
                    <p className="text-xs text-zinc-400 font-bold uppercase truncate">
                      📍 {selectedWinnerModal.city ? `${selectedWinnerModal.city}${selectedWinnerModal.state ? ` - ${selectedWinnerModal.state}` : ''}` : "Brasil"}
                    </p>
                  </div>
                </div>

                {/* Draw Metrics Grid */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-zinc-900/70 border border-zinc-850 p-3.5 rounded-2xl text-center">
                    <span className="text-zinc-500 text-[10px] font-extrabold uppercase tracking-widest block mb-1">
                      Cota Sorteada
                    </span>
                    <span className="text-2xl font-mono font-black text-amber-400">
                      Nº {selectedWinnerModal.winnerNumber || "---"}
                    </span>
                  </div>

                  <div className="bg-zinc-900/70 border border-zinc-850 p-3.5 rounded-2xl text-center">
                    <span className="text-zinc-500 text-[10px] font-extrabold uppercase tracking-widest block mb-1">
                      Data da Apuração
                    </span>
                    <span className="text-xs font-black text-white uppercase block mt-1">
                      📅 {selectedWinnerModal.drawDate || "Recentemente"}
                    </span>
                  </div>
                </div>

                {/* Description if available */}
                {selectedWinnerModal.prizeDescription && (
                  <div className="space-y-1">
                    <span className="text-zinc-500 text-[10px] font-extrabold uppercase tracking-widest">
                      Sobre o Prêmio
                    </span>
                    <p className="text-zinc-300 text-xs leading-relaxed bg-zinc-950 p-3 rounded-xl border border-zinc-900">
                      {selectedWinnerModal.prizeDescription}
                    </p>
                  </div>
                )}

                {/* Share Button */}
                <button
                  type="button"
                  onClick={() => {
                    if (navigator.share) {
                      navigator.share({
                        title: `Ganhador: ${selectedWinnerModal.winnerName}`,
                        text: `Confira o ganhador do prêmio ${selectedWinnerModal.prizeTitle} na cota nº ${selectedWinnerModal.winnerNumber}!`,
                        url: window.location.href,
                      }).catch(() => {});
                    } else {
                      navigator.clipboard.writeText(window.location.href);
                      alert("Link copiado para a área de transferência!");
                    }
                  }}
                  className="w-full bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white font-black text-xs uppercase tracking-wider py-3 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Share2 className="w-4 h-4 text-amber-400" />
                  <span>Compartilhar Resultado</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
