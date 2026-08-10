import React, { useState, useEffect } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { 
  Search, 
  ChevronLeft, 
  Tag, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  Ban,
  Compass,
  Ticket,
  DollarSign,
  Sparkles,
  User,
  ShoppingBag,
  Hash,
  LogOut,
  Mail,
  Phone,
  Calendar,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Activity,
  Award
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MinhasCotasProps {
  currentPath: string;
  setCurrentPath: (path: string) => void;
}

export default function MinhasCotas({ currentPath, setCurrentPath }: MinhasCotasProps) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [raffleMap, setRaffleMap] = useState<Record<string, string>>({});
  const [copyState, setCopyState] = useState<Record<string, boolean>>({});
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  // Detect active tab from URL path
  const activeTab = currentPath === "/minha-conta" 
    ? "conta" 
    : currentPath === "/meus-numeros" 
      ? "numeros" 
      : "compras"; // Default to compras

  // Brazilian phone masking: (XX) XXXXX-XXXX or (XX) XXXX-XXXX
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let v = e.target.value.replace(/\D/g, "");
    if (v.length > 11) v = v.slice(0, 11);

    if (v.length > 2) {
      if (v.length > 7) {
        v = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
      } else {
        v = `(${v.slice(0, 2)}) ${v.slice(2)}`;
      }
    } else if (v.length > 0) {
      v = `(${v}`;
    }
    setPhone(v);
  };

  // Fetch raffles to map ID -> Title
  useEffect(() => {
    const fetchRaffleTitles = async () => {
      try {
        const snap = await getDocs(collection(db, "raffles"));
        const mapping: Record<string, string> = {};
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data && data.title) {
            mapping[docSnap.id] = data.title;
          }
        });
        setRaffleMap(mapping);
      } catch (err) {
        console.error("Error loading raffles map:", err);
      }
    };
    fetchRaffleTitles();
  }, []);

  // Fetch orders for a phone number using secure API route
  const fetchOrdersForPhone = async (phoneDigits: string) => {
    if (!phoneDigits) return;
    setLoading(true);
    setSearched(true);

    try {
      const canonicalPhone = phoneDigits.replace(/\D/g, "");
      if (!canonicalPhone) {
        setOrders([]);
        return;
      }

      const res = await fetch("/api/customer-history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: canonicalPhone }),
      });

      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      } else {
        console.warn("⚠️ API customer-history error:", res.status);
        setOrders([]);
      }

      localStorage.setItem("client_lookup_phone", phoneDigits);
    } catch (err) {
      console.error("Error retrieving orders from customer-history API:", err);
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto load phone if saved
  useEffect(() => {
    const savedPhone = localStorage.getItem("client_lookup_phone");
    if (savedPhone) {
      setPhone(savedPhone);
      fetchOrdersForPhone(savedPhone);
    }
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.trim()) {
      fetchOrdersForPhone(phone);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem("client_lookup_phone");
    setPhone("");
    setOrders([]);
    setSearched(false);
    // Redirect to default compras URL
    window.history.pushState(null, "", "/minhas-compras");
    setCurrentPath("/minhas-compras");
  };

  const handleTabChange = (tab: "conta" | "compras" | "numeros") => {
    const path = tab === "conta" 
      ? "/minha-conta" 
      : tab === "numeros" 
        ? "/meus-numeros" 
        : "/minhas-compras";
    window.history.pushState(null, "", path);
    setCurrentPath(path);
  };

  const copyToClipboard = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopyState((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => {
      setCopyState((prev) => ({ ...prev, [id]: false }));
    }, 2000);
  };

  const toggleOrderExpanded = (orderId: string) => {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const formatDate = (isoStr?: string) => {
    if (!isoStr) return "--/--/----";
    try {
      const date = new Date(isoStr);
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (e) {
      return "--/--/----";
    }
  };

  const getStatusBadge = (status?: string) => {
    const s = String(status || "").toLowerCase().trim();
    if (s === "pago" || s === "paid" || s === "approved") {
      return (
        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
          Pago
        </span>
      );
    }
    if (s === "pending_payment" || s === "aguardando" || s === "reserved" || s === "pendente") {
      return (
        <span className="bg-orange-500/10 text-orange-400 border border-orange-500/20 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shrink-0">
          <Clock className="w-3.5 h-3.5 animate-pulse shrink-0" />
          Pendente
        </span>
      );
    }
    return (
      <span className="bg-zinc-900 text-zinc-500 border border-zinc-800 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shrink-0">
        <Ban className="w-3.5 h-3.5 shrink-0" />
        Cancelado
      </span>
    );
  };

  // Extract client profile details from the latest order
  const latestOrder = orders.length > 0 ? orders[0] : null;
  const clientProfile = {
    name: latestOrder?.name || "Sem Nome Cadastrado",
    email: latestOrder?.email || "Sem e-mail cadastrado",
    phone: phone || latestOrder?.phone || "",
    status: orders.some(o => ["pago", "paid", "approved"].includes(String(o.status).toLowerCase())) ? "VIP Premium" : "Ativo",
  };

  // Calculate stats using only paid/approved transactions for compras/cotas
  const paidOrders = orders.filter(o => ["pago", "paid", "approved"].includes(String(o.status).toLowerCase()));
  const totalPaidOrders = paidOrders.length;
  const totalQuotasBought = paidOrders.reduce((acc, order) => {
    const totalNums = Array.isArray(order?.nums) ? order.nums.length : 0;
    return acc + totalNums;
  }, 0);
  const totalBonusQuotas = paidOrders.reduce((acc, order) => {
    const bonusNums = Array.isArray(order?.bonusNums) ? order.bonusNums.length : 0;
    return acc + bonusNums;
  }, 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-white relative flex flex-col items-center justify-start py-12 px-4 selection:bg-amber-500 selection:text-black">
      {/* Background premium performance glow effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_-10%,rgba(245,158,11,0.05),rgba(0,0,0,0))]" />
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-amber-500/3 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-2xl space-y-8 relative z-10">
        
        {/* Navigation Back Header Link */}
        <button
          onClick={() => {
            window.history.pushState({}, "", "/");
            setCurrentPath("/");
          }}
          className="group flex items-center gap-2 text-zinc-500 hover:text-amber-400 transition-all text-xs font-black uppercase tracking-widest cursor-pointer outline-none"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar para Home
        </button>

        {/* Title Presentation Block */}
        <div className="space-y-3 mt-2">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-amber-600 via-amber-500 to-amber-400 p-2.5 rounded-2xl shadow-lg shadow-amber-500/10">
              <Compass className="w-6 h-6 text-black" />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight bg-gradient-to-r from-zinc-100 via-zinc-300 to-amber-400 bg-clip-text text-transparent">
                {activeTab === "conta" ? "Minha Conta" : activeTab === "numeros" ? "Meus Números" : "Minhas Compras"}
              </h1>
              <span className="text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-full font-black uppercase tracking-widest leading-none mt-1 inline-block">
                Portal do Cliente
              </span>
            </div>
          </div>
          <p className="text-zinc-500 text-xs font-semibold leading-relaxed">
            Consulte seus dados, acompanhe o histórico detalhado de compras, visualize suas cotas bônus e administre sua participação nos sorteios de aventura.
          </p>
        </div>

        {/* 1. Phone search screen (If not identified or searched yet) */}
        {!searched && (
          <div className="bg-zinc-900/90 border border-zinc-800/80 rounded-[2rem] p-8 shadow-2xl relative overflow-hidden backdrop-blur-xl">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
            
            <form onSubmit={handleSearchSubmit} className="space-y-6">
              <div className="space-y-2 text-center max-w-sm mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-zinc-950/80 border border-zinc-800 flex items-center justify-center mx-auto text-amber-400 mb-2">
                  <User className="w-5 h-5" />
                </div>
                <h2 className="text-base font-black uppercase tracking-wider text-zinc-100">Acessar com WhatsApp</h2>
                <p className="text-[11px] text-zinc-500 font-medium">Insira o número utilizado no momento do pedido para carregar seus dados com segurança.</p>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block pl-1">
                  Telefone cadastrado
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    placeholder="(11) 99999-9999"
                    value={phone}
                    onChange={handlePhoneChange}
                    className="w-full bg-black/60 border border-zinc-800/80 focus:border-amber-500/60 rounded-2xl pl-5 pr-14 py-4 text-sm sm:text-base font-bold text-white placeholder-zinc-700 outline-none transition-all font-mono"
                  />
                  <button
                    type="submit"
                    disabled={loading || !phone}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black rounded-xl cursor-pointer transition-all flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none active:scale-95 shadow-md shadow-amber-500/10 font-bold"
                    title="Buscar compras"
                  >
                    <Search className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Loading and Results Area */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4 bg-zinc-900/40 border border-zinc-850 rounded-[2.5rem]">
            <div className="w-10 h-10 rounded-full border-2 border-zinc-850 border-t-amber-500 animate-spin" />
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 animate-pulse">
              Consultando banco de dados seguro...
            </span>
          </div>
        )}

        {!loading && searched && (
          <div className="space-y-6">
            
            {/* User Session Bar */}
            <div className="bg-zinc-900/60 border border-zinc-850/80 rounded-2xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
                <span className="text-zinc-400 font-bold">Identificado como:</span>
                <span className="font-bold font-mono text-amber-400 bg-amber-500/5 border border-amber-500/10 px-2 py-0.5 rounded-lg">{phone}</span>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                Sair / Alterar Conta
              </button>
            </div>

            {/* Segmented Tab Navigation - Matches URL Routs */}
            <div className="flex border border-zinc-850 rounded-2xl bg-zinc-950 p-1 divide-x divide-zinc-850">
              <button
                onClick={() => handleTabChange("conta")}
                className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "conta" 
                    ? "bg-zinc-900 text-amber-400 shadow-inner" 
                    : "text-zinc-400 hover:bg-zinc-900/30 hover:text-white"
                }`}
              >
                <User className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Minha Conta</span>
              </button>
              
              <button
                onClick={() => handleTabChange("compras")}
                className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "compras" 
                    ? "bg-zinc-900 text-amber-400 shadow-inner" 
                    : "text-zinc-400 hover:bg-zinc-900/30 hover:text-white"
                }`}
              >
                <ShoppingBag className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Minhas Compras</span>
              </button>

              <button
                onClick={() => handleTabChange("numeros")}
                className={`flex-1 flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  activeTab === "numeros" 
                    ? "bg-zinc-900 text-amber-400 shadow-inner" 
                    : "text-zinc-400 hover:bg-zinc-900/30 hover:text-white"
                }`}
              >
                <Hash className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Meus Números</span>
              </button>
            </div>

            {/* Tab Contents */}
            <AnimatePresence mode="wait">
              {/* TAB 1: MINHA CONTA */}
              {activeTab === "conta" && (
                <motion.div
                  key="tab-conta"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-6"
                >
                  {/* Account Profile Details Card */}
                  <div className="bg-zinc-900 border border-zinc-800/80 rounded-[2rem] p-6 shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/2 rounded-full blur-[40px] pointer-events-none" />
                    
                    <div className="flex items-center gap-4 border-b border-zinc-850 pb-5">
                      <div className="w-14 h-14 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex items-center justify-center text-amber-400 font-black text-xl shadow-inner">
                        {clientProfile.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h2 className="text-base font-black uppercase tracking-wide text-zinc-100 truncate">{clientProfile.name}</h2>
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                            {clientProfile.status}
                          </span>
                        </div>
                        <p className="text-zinc-500 text-xs font-semibold">{clientProfile.email}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5">
                      <div className="flex items-center gap-3.5 bg-zinc-950/40 p-4 rounded-xl border border-zinc-850/60">
                        <Phone className="w-4 h-4 text-zinc-500 shrink-0" />
                        <div>
                          <span className="text-[9px] uppercase tracking-widest text-zinc-500 block font-black">WhatsApp</span>
                          <span className="text-xs font-bold text-zinc-300 font-mono">{clientProfile.phone}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3.5 bg-zinc-950/40 p-4 rounded-xl border border-zinc-850/60">
                        <Calendar className="w-4 h-4 text-zinc-500 shrink-0" />
                        <div>
                          <span className="text-[9px] uppercase tracking-widest text-zinc-500 block font-black">Data do Cadastro</span>
                          <span className="text-xs font-bold text-zinc-300">
                            {latestOrder ? formatDate(latestOrder.createdAt) : "--/--/----"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Profile Stats Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div className="bg-zinc-900 border border-zinc-850/80 p-5 rounded-[1.5rem] shadow-lg flex flex-col justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Total de Pedidos</span>
                      <div className="flex items-baseline gap-1 mt-3">
                        <span className="text-2xl font-black text-white">{orders.length}</span>
                        <span className="text-[10px] text-zinc-500 font-bold">transações</span>
                      </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-850/80 p-5 rounded-[1.5rem] shadow-lg flex flex-col justify-between">
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Cotas Adquiridas</span>
                      <div className="flex items-baseline gap-1 mt-3">
                        <span className="text-2xl font-black text-amber-400">{totalQuotasBought}</span>
                        <span className="text-[10px] text-zinc-500 font-bold">cotas</span>
                      </div>
                    </div>

                    <div className="bg-zinc-900 border border-zinc-850/80 p-5 rounded-[1.5rem] shadow-lg flex flex-col justify-between col-span-2 sm:col-span-1">
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Cotas Bônus Ganhas</span>
                      <div className="flex items-baseline gap-1.5 mt-3">
                        <span className="text-2xl font-black text-pink-400 flex items-center gap-1">
                          <Sparkles className="w-4 h-4 text-pink-400 shrink-0" />
                          {totalBonusQuotas}
                        </span>
                        <span className="text-[10px] text-zinc-500 font-bold">brindes</span>
                      </div>
                    </div>
                  </div>

                  {/* Security Notice */}
                  <div className="bg-zinc-900/30 border border-zinc-850 p-4 rounded-xl flex items-start gap-3">
                    <Activity className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-zinc-500 leading-relaxed font-semibold">
                      Seu portal do cliente é atualizado em tempo real. Qualquer transação Pix aprovada reflete instantaneamente neste painel sem a necessidade de atualizar a página.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* TAB 2: MINHAS COMPRAS */}
              {activeTab === "compras" && (
                <motion.div
                  key="tab-compras"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                      Seu Histórico de Transações ({paidOrders.length})
                    </span>
                  </div>

                  {paidOrders.length === 0 ? (
                    <div className="bg-zinc-900 border border-zinc-850 p-8 text-center rounded-[2rem] space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-zinc-950 flex items-center justify-center mx-auto text-zinc-500">
                        <AlertCircle className="w-6 h-6" />
                      </div>
                      <p className="text-xs text-zinc-500 font-semibold">Nenhuma compra confirmada para este telefone.</p>
                    </div>
                  ) : (
                    paidOrders.map((item) => {
                      const totalNums = Array.isArray(item?.nums) ? item.nums.length : 0;
                      const isExpanded = !!expandedOrders[item.id];
                      const raffleTitle = raffleMap[item?.raffleId] || "Rifa Master Premium";
                      const bonusList = Array.isArray(item?.bonusNums) ? item.bonusNums : [];
                      const boughtList = Array.isArray(item?.nums) ? item.nums.filter((n: string) => !bonusList.includes(n)) : [];

                      return (
                        <div
                          key={item.id}
                          className="bg-zinc-900 border border-zinc-800/80 rounded-[2rem] p-6 space-y-4 shadow-xl transition-all hover:border-zinc-850"
                        >
                          {/* Upper Meta Row */}
                          <div className="flex items-start justify-between gap-2 border-b border-zinc-850 pb-4">
                            <div className="space-y-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-black text-amber-200 tracking-tight flex items-center gap-1.5 cursor-pointer hover:text-white" onClick={() => copyToClipboard(item.id, item.id)}>
                                  Pedido #{item.id.substring(0, 10).toUpperCase()}
                                  {copyState[item.id] ? (
                                    <Check className="w-3 h-3 text-amber-400" />
                                  ) : (
                                    <Copy className="w-3 h-3 text-zinc-500 hover:text-zinc-300" />
                                  )}
                                </span>
                                <span className="text-[9px] bg-zinc-950 text-zinc-500 border border-zinc-850 px-2 py-0.5 rounded font-bold font-mono">
                                  {formatDate(item?.createdAt)}
                                </span>
                              </div>
                              <h3 className="text-xs font-black text-amber-400 uppercase tracking-wide truncate mt-1">
                                {raffleTitle}
                              </h3>
                            </div>
                            {getStatusBadge(item?.status)}
                          </div>

                          {/* Highlights */}
                          <div className="flex items-center justify-between text-xs sm:text-sm bg-zinc-950/40 p-4 rounded-xl border border-zinc-850/60">
                            <div className="flex items-center gap-1.5 text-zinc-400 font-semibold">
                              <Ticket className="w-4 h-4 text-amber-400 shrink-0" />
                              <span>Quantidade de Cotas:</span>
                            </div>
                            <span className="font-extrabold text-zinc-200 font-mono">
                              {totalNums} {totalNums === 1 ? "cota" : "cotas"}
                            </span>
                          </div>

                          {/* Footer and Price / Action */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                            <div className="flex items-baseline gap-1.5">
                              <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Valor:</span>
                              <span className="text-base font-black text-white font-mono bg-gradient-to-r from-zinc-100 via-zinc-200 to-amber-400 bg-clip-text text-transparent">
                                R$ {Number(item?.val ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                              </span>
                            </div>

                            <button
                              onClick={() => toggleOrderExpanded(item.id)}
                              className="flex items-center gap-1 px-4 py-2 bg-zinc-950/80 hover:bg-zinc-950 border border-zinc-800 text-[10px] font-black uppercase tracking-wider text-zinc-300 rounded-xl transition-all active:scale-95 cursor-pointer"
                            >
                              <span>{isExpanded ? "Ocultar Detalhes" : "Ver Detalhes"}</span>
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>

                          {/* Collapsible details pane */}
                          {isExpanded && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="border-t border-zinc-850 pt-4 mt-4 space-y-4"
                            >
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-semibold">
                                <div className="space-y-1">
                                  <span className="text-[9px] uppercase tracking-widest text-zinc-500 block font-black">Comprador</span>
                                  <span className="text-zinc-300 block truncate">{item?.name}</span>
                                </div>
                                <div className="space-y-1">
                                  <span className="text-[9px] uppercase tracking-widest text-zinc-500 block font-black">E-mail de Contato</span>
                                  <span className="text-zinc-300 block truncate">{item?.email}</span>
                                </div>
                              </div>

                              {/* Numbers purchased */}
                              <div className="space-y-3">
                                {boughtList.length > 0 && (
                                  <div className="space-y-1.5">
                                    <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest block pl-0.5 flex items-center gap-1">
                                      <Ticket className="w-3 h-3 text-amber-400" />
                                      Cotas Adquiridas ({boughtList.length})
                                    </span>
                                    <div className="flex flex-wrap gap-1.5 font-mono">
                                      {boughtList.map((num: string) => (
                                        <span
                                          key={num}
                                          className="bg-amber-500/5 border border-amber-500/20 text-amber-400 font-bold text-xs px-2.5 py-1 rounded-lg block min-w-[34px] text-center"
                                        >
                                          {num}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {boughtList.length > 0 && bonusList.length > 0 && (
                                  <div className="border-t border-dashed border-zinc-850 my-2" />
                                )}

                                {bonusList.length > 0 && (
                                  <div className="space-y-1.5">
                                    <span className="text-[9px] text-pink-400 font-extrabold uppercase tracking-widest block pl-0.5 flex items-center gap-1">
                                      <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                      Cotas Bônus ({bonusList.length})
                                    </span>
                                    <div className="flex flex-wrap gap-1.5 font-mono">
                                      {bonusList.map((num: string) => (
                                        <span
                                          key={num}
                                          className="bg-pink-500/5 border border-pink-500/20 text-pink-400 font-bold text-xs px-2.5 py-1 rounded-lg block min-w-[34px] text-center"
                                        >
                                          {num}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Pending checkout reminder */}
                              {String(item?.status).toLowerCase() === "pending_payment" && (
                                <div className="bg-amber-500/5 border border-amber-500/20 p-3.5 rounded-xl flex items-start gap-2.5">
                                  <Clock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                                  <p className="text-[10px] text-amber-300 leading-relaxed font-semibold">
                                    Aguardando aprovação de pagamento via Pix. Se você já escaneou o QR Code, sua reserva será confirmada automaticamente em até 1 minuto.
                                  </p>
                                </div>
                              )}
                            </motion.div>
                          )}

                        </div>
                      );
                    })
                  )}
                </motion.div>
              )}

              {/* TAB 3: MEUS NÚMEROS */}
              {activeTab === "numeros" && (
                <motion.div
                  key="tab-numeros"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between px-2">
                    <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                      Cotas e Bilhetes de Aventura Adquiridos
                    </span>
                  </div>

                  {orders.filter((o) => {
                    const s = String(o.status || "").toLowerCase().trim();
                    const isExpiredTimer = o.expiresAt && Date.now() >= o.expiresAt;
                    const isCanceledOrExpired = s === "cancelado" || s === "canceled" || s === "expired" || s === "failed" || s === "falhou" || (s === "pending_payment" && isExpiredTimer) || (s === "aguardando" && isExpiredTimer);
                    const hasNumbers = Array.isArray(o.nums) && o.nums.length > 0;
                    return !isCanceledOrExpired && hasNumbers;
                  }).length === 0 ? (
                    <div className="bg-zinc-900 border border-zinc-850 p-8 text-center rounded-[2rem] space-y-3">
                      <div className="w-12 h-12 rounded-xl bg-zinc-950 flex items-center justify-center mx-auto text-zinc-500">
                        <Award className="w-6 h-6" />
                      </div>
                      <p className="text-xs text-zinc-500 font-semibold">Nenhuma cota ativa registrada para este telefone.</p>
                    </div>
                  ) : (
                    (() => {
                      // Group all active orders' numbers by raffle
                      const groupedByRaffle: Record<string, {
                        title: string;
                        orders: Array<{
                          orderId: string;
                          createdAt: string;
                          status: string;
                          nums: string[];
                          bonusNums: string[];
                        }>;
                      }> = {};

                      orders.filter((o) => {
                        const s = String(o.status || "").toLowerCase().trim();
                        const isExpiredTimer = o.expiresAt && Date.now() >= o.expiresAt;
                        const isCanceledOrExpired = s === "cancelado" || s === "canceled" || s === "expired" || s === "failed" || s === "falhou" || (s === "pending_payment" && isExpiredTimer) || (s === "aguardando" && isExpiredTimer);
                        const hasNumbers = Array.isArray(o.nums) && o.nums.length > 0;
                        return !isCanceledOrExpired && hasNumbers;
                      }).forEach((order) => {
                        const rId = order.raffleId || "current";
                        const rTitle = raffleMap[rId] || "Rifa Master Premium";
                        
                        if (!groupedByRaffle[rId]) {
                          groupedByRaffle[rId] = {
                            title: rTitle,
                            orders: []
                          };
                        }

                        groupedByRaffle[rId].orders.push({
                          orderId: order.id,
                          createdAt: order.createdAt,
                          status: order.status,
                          nums: Array.isArray(order.nums) ? order.nums : [],
                          bonusNums: Array.isArray(order.bonusNums) ? order.bonusNums : []
                        });
                      });

                      return Object.entries(groupedByRaffle).map(([raffleId, group]) => {
                        return (
                          <div key={raffleId} className="bg-zinc-900 border border-zinc-850 rounded-[2rem] p-6 space-y-5 shadow-xl">
                            <div className="flex items-center justify-between border-b border-zinc-850 pb-3">
                              <h3 className="text-sm font-black text-amber-400 uppercase tracking-wide truncate max-w-[70%]">
                                {group.title}
                              </h3>
                              <span className="text-[9px] font-black uppercase tracking-widest bg-zinc-950 text-zinc-400 border border-zinc-800 px-2 py-0.5 rounded-md">
                                {group.orders.length} {group.orders.length === 1 ? "Pedido" : "Pedidos"}
                              </span>
                            </div>

                            <div className="space-y-4">
                              {group.orders.map((ordDetail) => {
                                const bonusList = ordDetail.bonusNums;
                                const boughtList = ordDetail.nums.filter((n) => !bonusList.includes(n));
                                const statusNorm = String(ordDetail.status).toLowerCase();
                                const isPaid = ["pago", "paid", "approved"].includes(statusNorm);

                                return (
                                  <div key={ordDetail.orderId} className="space-y-3 bg-zinc-950/40 p-4 rounded-xl border border-zinc-850/60 text-xs">
                                    <div className="flex items-center justify-between flex-wrap gap-2 text-[10px] font-bold text-zinc-500">
                                      <span className="font-mono">
                                        Pedido: <strong className="text-zinc-300">#{ordDetail.orderId.substring(0, 8).toUpperCase()}</strong>
                                      </span>
                                      <span>{formatDate(ordDetail.createdAt)}</span>
                                      <span className={isPaid ? "text-emerald-400 font-extrabold uppercase" : "text-amber-400 font-extrabold uppercase animate-pulse"}>
                                        {isPaid ? "• Ativos / Confirmados" : "• Reservados (Pendente)"}
                                      </span>
                                    </div>

                                    {/* Standard quotas display */}
                                    {boughtList.length > 0 && (
                                      <div className="space-y-1">
                                        <span className="text-[8px] text-zinc-500 font-black uppercase tracking-widest block">
                                          Cotas ({boughtList.length})
                                        </span>
                                        <div className="flex flex-wrap gap-1 font-mono">
                                          {boughtList.map((num) => (
                                            <span
                                              key={num}
                                              className={`font-black text-xs px-2.5 py-1.5 rounded-lg block text-center min-w-[34px] ${
                                                isPaid 
                                                  ? "bg-amber-500/10 border border-amber-500/20 text-amber-400" 
                                                  : "bg-amber-500/5 border border-amber-500/20 text-amber-400"
                                              }`}
                                            >
                                              {num}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Bonus quotas display */}
                                    {bonusList.length > 0 && (
                                      <div className="space-y-1">
                                        <span className="text-[8px] text-pink-400 font-extrabold uppercase tracking-widest block flex items-center gap-1">
                                          <Sparkles className="w-3 h-3" />
                                          Cotas Bônus Especial ({bonusList.length})
                                        </span>
                                        <div className="flex flex-wrap gap-1 font-mono">
                                          {bonusList.map((num) => (
                                            <span
                                              key={num}
                                              className="bg-pink-500/10 border border-pink-500/20 text-pink-400 font-black text-xs px-2.5 py-1.5 rounded-lg block text-center min-w-[34px]"
                                            >
                                              {num}
                                            </span>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      });
                    })()
                  )}
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        )}

      </div>
    </div>
  );
}
