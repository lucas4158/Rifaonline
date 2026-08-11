import React, { useState, useEffect, useMemo } from "react";
import { adminService } from "../../services/adminService";
import {
  ClipboardList,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  AlertTriangle,
  Loader2,
  Phone,
  MessageCircle,
  ExternalLink,
  ShieldAlert,
  DollarSign,
  Ticket,
  User,
  Filter,
  RefreshCw,
  Layers,
  TrendingUp,
  ArrowRightLeft,
  X,
  Send,
  HelpCircle
} from "lucide-react";

export function PurchasesView({
  selectedRaffleId,
  orders: propOrders,
  raffles: propRaffles,
  onSelectRaffle,
  limit,
  compact
}: {
  selectedRaffleId: string | null;
  orders?: any[];
  raffles?: any[];
  onSelectRaffle?: (id: string) => void;
  limit?: number;
  compact?: boolean;
}) {
  const [apiFetchedOrders, setApiFetchedOrders] = useState<any[]>([]);
  const [fetchedRaffles, setFetchedRaffles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"Todos" | "Pendentes" | "Pagos" | "Cancelados">("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Combine orders from props (realtime/parent) or API fetch
  const orders = useMemo(() => {
    if (Array.isArray(propOrders) && propOrders.length > 0) {
      return propOrders;
    }
    return apiFetchedOrders;
  }, [propOrders, apiFetchedOrders]);

  // Active Raffle Filter state inside PurchasesView (default to passed selectedRaffleId or 'all')
  const [activeRaffleFilter, setActiveRaffleFilter] = useState<string>(selectedRaffleId || "all");

  // Synchronize with parent's selectedRaffleId if it changes
  useEffect(() => {
    setActiveRaffleFilter(selectedRaffleId || "all");
  }, [selectedRaffleId]);

  // Modals & Action States
  const [selectedOrderForApproval, setSelectedOrderForApproval] = useState<any | null>(null);
  const [selectedOrderForRefund, setSelectedOrderForRefund] = useState<any | null>(null);
  const [selectedOrderForCancel, setSelectedOrderForCancel] = useState<any | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const getAdminToken = () => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("raffle_admin_token") ||
        ""
      );
    }
    return "";
  };

  // Combine raffles from props or API
  const allRaffles = useMemo(() => {
    if (Array.isArray(propRaffles) && propRaffles.length > 0) {
      return propRaffles;
    }
    return fetchedRaffles;
  }, [propRaffles, fetchedRaffles]);

  // Fetch raffles if not provided
  useEffect(() => {
    if (!propRaffles || propRaffles.length === 0) {
      const fetchRafflesList = async () => {
        try {
          const token = getAdminToken();
          const headers: Record<string, string> = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          const res = await fetch("/api/admin-action", {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({ action: "list-raffles" })
          });
          if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data.raffles)) {
              setFetchedRaffles(data.raffles);
            }
          } else if (res.status === 401 || res.status === 403) {
            console.warn("🚨 [Admin] Sessão expirada ou inválida ao listar rifas. É necessário fazer login novamente.");
          }
        } catch (e) {
          console.error("Failed to fetch raffles list for PurchasesView:", e);
        }
      };
      fetchRafflesList();
    }
  }, [propRaffles]);

  // Fetch orders helper via Admin API
  const fetchOrdersFromApi = async (isManual = false) => {
    if (isManual) setLoading(true);
    try {
      const adminToken = getAdminToken();
      const targetRaffle = activeRaffleFilter === "all" ? null : activeRaffleFilter;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (adminToken) headers["Authorization"] = `Bearer ${adminToken}`;
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          action: "list-orders",
          raffleId: targetRaffle,
          limitCount: limit || 1000
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.orders)) {
          setApiFetchedOrders(data.orders);
        }
      } else if (res.status === 401 || res.status === 403) {
        console.warn("🚨 [Admin] Sessão expirada ou inválida ao listar pedidos. É necessário fazer login novamente.");
      }
    } catch (apiErr) {
      console.error("Failed to fetch orders via Admin API:", apiErr);
    } finally {
      setLoading(false);
    }
  };

  // Background polling for live orders sync via Admin API
  useEffect(() => {
    setLoading(true);
    fetchOrdersFromApi();

    const intervalId = setInterval(() => {
      fetchOrdersFromApi();
    }, 4000);

    return () => {
      clearInterval(intervalId);
    };
  }, [activeRaffleFilter, limit]);

  // Normalize order status
  const getNormalizedStatus = (rawStatus: string): "pago" | "pendente" | "cancelado" => {
    const s = String(rawStatus || "").toLowerCase().trim();
    if (
      s === "pago" ||
      s === "paid" ||
      s === "approved" ||
      s === "aprovado" ||
      s === "confirmed" ||
      s === "paga" ||
      s === "pagas" ||
      s === "concluido" ||
      s === "concluído"
    ) {
      return "pago";
    }
    if (s === "cancelado" || s === "canceled" || s === "cancelled" || s === "expired" || s === "reembolsado" || s === "refunded") {
      return "cancelado";
    }
    return "pendente";
  };

  // Switch raffle filter handler
  const handleRaffleChange = (newRaffleId: string) => {
    setActiveRaffleFilter(newRaffleId);
    if (onSelectRaffle) {
      onSelectRaffle(newRaffleId);
    }
  };

  // Orders matching selected raffle filter
  const raffleMatchedOrders = useMemo(() => {
    return orders.filter((ord) => {
      if (activeRaffleFilter && activeRaffleFilter !== "all") {
        const orderRaffleId = ord.raffleId || "current";
        const matchesRaffle =
          orderRaffleId === activeRaffleFilter ||
          orderRaffleId === "current" ||
          !ord.raffleId ||
          activeRaffleFilter === "current" ||
          allRaffles.length <= 1;
        if (!matchesRaffle) return false;
      }
      return true;
    });
  }, [orders, activeRaffleFilter, allRaffles.length]);

  // Filtered orders computation based on search query & status tabs
  const filteredOrders = useMemo(() => {
    return raffleMatchedOrders.filter((ord) => {
      const normStatus = getNormalizedStatus(ord.status);

      // Status filter
      if (statusFilter === "Pendentes" && normStatus !== "pendente") return false;
      if (statusFilter === "Pagos" && normStatus !== "pago") return false;
      if (statusFilter === "Cancelados" && normStatus !== "cancelado") return false;

      // Text search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const clientName = ord.name || ord.customerName || ord.userName || ord.buyerName || "";
        const nameMatch = String(clientName).toLowerCase().includes(q);
        const phoneMatch = String(ord.phone || ord.customerPhone || ord.whatsapp || "").includes(q);
        const idMatch = String(ord.id || "").toLowerCase().includes(q);
        const payIdMatch = String(ord.paymentId || "").toLowerCase().includes(q);

        const allNums = [
          ...(Array.isArray(ord.nums) ? ord.nums : []),
          ...(Array.isArray(ord.purchasedNums) ? ord.purchasedNums : []),
          ...(Array.isArray(ord.bonusNums) ? ord.bonusNums : []),
          ...(Array.isArray(ord.numbers) ? ord.numbers : []),
        ];
        const numsMatch = allNums.some((n: any) => String(n).includes(q));

        if (!nameMatch && !phoneMatch && !idMatch && !payIdMatch && !numsMatch) {
          return false;
        }
      }

      return true;
    });
  }, [raffleMatchedOrders, statusFilter, searchQuery]);

  // Comprehensive KPI computations (Valores Pagos vs A Entrar no Caixa)
  const stats = useMemo(() => {
    let totalPaidVal = 0;
    let totalPendingVal = 0;
    let paidCount = 0;
    let pendingCount = 0;
    let cancelledCount = 0;
    let paidCotasCount = 0;
    let pendingCotasCount = 0;

    raffleMatchedOrders.forEach((o) => {
      const st = getNormalizedStatus(o.status);
      const rawVal = Number(o.val || o.amount || o.total || o.totalValue || o.valAmount || 0);
      const numsList = Array.isArray(o.nums)
        ? o.nums
        : (Array.isArray(o.purchasedNums) ? o.purchasedNums : (Array.isArray(o.numbers) ? o.numbers : []));
      const cotaQty = numsList.length || 1;

      const orderRaffle = allRaffles.find((r) => r.id === o.raffleId) || currentRaffleObj;
      const itemPrice = orderRaffle?.price || 10;
      const val = rawVal > 0 ? rawVal : cotaQty * itemPrice;

      if (st === "pago") {
        paidCount++;
        totalPaidVal += val;
        paidCotasCount += cotaQty;
      } else if (st === "pendente") {
        pendingCount++;
        totalPendingVal += val;
        pendingCotasCount += cotaQty;
      } else {
        cancelledCount++;
      }
    });

    const totalPotentialVal = totalPaidVal + totalPendingVal;
    const conversionRate = totalPotentialVal > 0 ? (totalPaidVal / totalPotentialVal) * 100 : 0;

    return {
      totalOrders: raffleMatchedOrders.length,
      paidCount,
      pendingCount,
      cancelledCount,
      totalPaidVal,
      totalPendingVal,
      totalPotentialVal,
      paidCotasCount,
      pendingCotasCount,
      conversionRate
    };
  }, [raffleMatchedOrders]);

  // Execute manual approval
  const handleConfirmApproval = async () => {
    if (!selectedOrderForApproval) return;

    setIsProcessingAction(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const token = getAdminToken();
      const res = await adminService.manualApprovePayment(
        token,
        selectedOrderForApproval.id,
        selectedOrderForApproval.raffleId || activeRaffleFilter
      );

      if (res.alreadyPaid) {
        setActionSuccess("Este pedido já constava como Pago!");
      } else {
        setActionSuccess("Pagamento aprovado com sucesso! As cotas foram confirmadas no caixa.");
      }

      await fetchOrdersFromApi(true);

      setTimeout(() => {
        setSelectedOrderForApproval(null);
        setActionSuccess(null);
      }, 1500);
    } catch (err: any) {
      console.error("Erro na aprovação manual:", err);
      setActionError(err.message || "Falha ao aprovar pagamento. Verifique e tente novamente.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Execute refund / estorno of a paid order
  const handleConfirmRefund = async () => {
    if (!selectedOrderForRefund) return;

    setIsProcessingAction(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const token = getAdminToken();
      await adminService.orderAction(
        token,
        selectedOrderForRefund.id,
        "refund",
        selectedOrderForRefund.raffleId || activeRaffleFilter
      );

      setActionSuccess("Pagamento estornado com sucesso! O pedido foi cancelado e as cotas liberadas.");
      await fetchOrdersFromApi(true);

      setTimeout(() => {
        setSelectedOrderForRefund(null);
        setActionSuccess(null);
      }, 1500);
    } catch (err: any) {
      console.error("Erro ao estornar pagamento:", err);
      setActionError(err.message || "Falha ao estornar pagamento. Tente novamente.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Execute cancellation of a pending order
  const handleConfirmCancel = async () => {
    if (!selectedOrderForCancel) return;

    setIsProcessingAction(true);
    setActionError(null);
    setActionSuccess(null);

    try {
      const token = getAdminToken();
      await adminService.orderAction(
        token,
        selectedOrderForCancel.id,
        "cancel",
        selectedOrderForCancel.raffleId || activeRaffleFilter
      );

      setActionSuccess("Reserva cancelada com sucesso! As cotas foram liberadas.");
      await fetchOrdersFromApi(true);

      setTimeout(() => {
        setSelectedOrderForCancel(null);
        setActionSuccess(null);
      }, 1500);
    } catch (err: any) {
      console.error("Erro ao cancelar pedido:", err);
      setActionError(err.message || "Falha ao cancelar reserva. Tente novamente.");
    } finally {
      setIsProcessingAction(false);
    }
  };

  // Active Raffle object info
  const currentRaffleObj = useMemo(() => {
    if (activeRaffleFilter === "all" || !allRaffles.length) return null;
    return allRaffles.find((r) => r.id === activeRaffleFilter) || null;
  }, [allRaffles, activeRaffleFilter]);

  return (
    <div className="space-y-6">
      {/* 🎯 SELETOR DE RIFA DESEJADA (CAMPAIGN SELECTOR BAR) */}
      {!compact && (
        <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-4 sm:p-5 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider block">
                Seletor de Campanha Desejada
              </span>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                {currentRaffleObj ? currentRaffleObj.title : "Todas as Campanhas (Visão Geral)"}
              </h2>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative min-w-[260px] sm:min-w-[320px]">
              <select
                value={activeRaffleFilter}
                onChange={(e) => handleRaffleChange(e.target.value)}
                className="w-full pl-4 pr-10 py-3 bg-black border border-zinc-800 text-white rounded-xl text-xs font-bold outline-none focus:border-amber-500/80 transition-colors appearance-none cursor-pointer shadow-inner"
              >
                <option value="all">✨ TODAS AS CAMPANHAS (Geral)</option>
                {allRaffles.map((r) => (
                  <option key={r.id} value={r.id}>
                    🏆 {r.title || "Rifa Sem Título"} — R$ {(r.price || 0).toFixed(2).replace(".", ",")} / cota
                  </option>
                ))}
              </select>
              <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none text-xs font-bold">
                ▼
              </div>
            </div>

            {currentRaffleObj && (
              <div className="hidden lg:flex items-center gap-2 bg-zinc-900/80 border border-zinc-800/80 px-3 py-2 rounded-xl text-xs font-mono">
                <span className="text-zinc-400">Preço:</span>
                <span className="text-emerald-400 font-bold">R$ {(currentRaffleObj.price || 0).toFixed(2).replace(".", ",")}</span>
                <span className="text-zinc-600">|</span>
                <span className="text-zinc-400">Total:</span>
                <span className="text-amber-400 font-bold">{currentRaffleObj.totalNumbers || 100} cotas</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 📊 SUMMARY KPIs (VALORES PAGOS vs A ENTRAR NO CAIXA) */}
      {!compact && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* VALORES JÁ PAGOS (CAIXA CONFIRMADO) */}
          <div className="bg-zinc-950 border border-emerald-900/40 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-emerald-500/50 transition-all shadow-lg">
            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-emerald-500/5 rounded-full blur-xl group-hover:bg-emerald-500/10 transition-all" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Já Pagos (Caixa)
              </span>
              <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold rounded-full">
                {stats.paidCount} pedidos
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-2 font-mono">
              R$ {stats.totalPaidVal.toFixed(2).replace('.', ',')}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1 font-mono">
              {stats.paidCotasCount} cotas confirmadas
            </p>
          </div>

          {/* A ENTRAR NO CAIXA (PENDENTES EM ABERTO) */}
          <div className="bg-zinc-950 border border-amber-900/40 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-amber-500/50 transition-all shadow-lg">
            <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all" />
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-amber-400 tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" /> A Entrar no Caixa
              </span>
              <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[10px] font-mono font-bold rounded-full">
                {stats.pendingCount} pendentes
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-2 font-mono">
              R$ {stats.totalPendingVal.toFixed(2).replace('.', ',')}
            </div>
            <p className="text-[11px] text-zinc-500 mt-1 font-mono">
              {stats.pendingCotasCount} cotas reservadas Pix
            </p>
          </div>

          {/* RECEITA POTENCIAL TOTAL */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 sm:p-5 relative overflow-hidden group hover:border-zinc-700 transition-all shadow-lg">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-zinc-400" /> Receita Potencial
              </span>
              <span className="text-[10px] font-mono text-zinc-500 font-bold">
                {stats.conversionRate.toFixed(0)}% Pago
              </span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-2 font-mono">
              R$ {stats.totalPotentialVal.toFixed(2).replace('.', ',')}
            </div>
            {/* Conversion Progress Bar */}
            <div className="w-full bg-zinc-900 h-1.5 rounded-full mt-2.5 overflow-hidden">
              <div
                className="bg-gradient-to-r from-emerald-500 to-amber-400 h-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, stats.conversionRate))}%` }}
              />
            </div>
          </div>

          {/* TOTAL DE PEDIDOS & STATUS BREAKDOWN */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-lg">
            <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider block">
              Total de Pedidos
            </span>
            <div className="text-2xl sm:text-3xl font-black text-white mt-2 font-mono">
              {stats.totalOrders} <span className="text-xs text-zinc-500 font-normal">reservas</span>
            </div>
            <div className="flex items-center gap-3 mt-2 text-[10px] font-mono">
              <span className="text-emerald-400 font-bold">🟢 {stats.paidCount} Pagos</span>
              <span className="text-amber-400 font-bold">🟡 {stats.pendingCount} Pendentes</span>
              <span className="text-zinc-500">🔴 {stats.cancelledCount} Canc.</span>
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ ALERTA DE CLIENTES COM PAGAMENTO PENDENTE */}
      {!compact && stats.pendingCount > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-amber-300 uppercase tracking-wider">
                {stats.pendingCount} Cliente(s) com Pagamento Pendente
              </h4>
              <p className="text-xs text-amber-200/80 font-mono mt-0.5">
                Há R$ {stats.totalPendingVal.toFixed(2).replace('.', ',')} aguardando confirmação de Pix que ainda podem entrar no caixa.
              </p>
            </div>
          </div>

          <button
            onClick={() => setStatusFilter("Pendentes")}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase rounded-xl transition-all cursor-pointer whitespace-nowrap shadow-md flex items-center gap-1.5"
          >
            <Filter className="w-3.5 h-3.5" />
            Ver Somente Pendentes
          </button>
        </div>
      )}

      {/* 📋 MAIN CONTAINER: PEDIDOS */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-4 sm:p-6 space-y-4 shadow-xl">
        {/* TOP BAR: SEARCH & STATUS FILTERS */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-zinc-900 pb-4">
          <h3 className={`${compact ? 'text-sm text-zinc-400 uppercase tracking-wider' : 'text-lg sm:text-xl text-white'} font-bold flex items-center gap-2`}>
            <ClipboardList className="w-5 h-5 text-emerald-400" />
            {compact ? 'Últimos Pedidos' : 'Gerenciamento de Pedidos'}
          </h3>

          {!compact && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* REFRESH BUTTON */}
              <button
                type="button"
                onClick={() => fetchOrdersFromApi(true)}
                disabled={loading}
                className="px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title="Atualizar lista de pedidos"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
                <span>Atualizar</span>
              </button>

              {/* SEARCH INPUT */}
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar por nome, telefone, cota..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 pl-9 pr-3 py-2 bg-black border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 outline-none focus:border-emerald-500/50 transition-colors"
                />
              </div>

              {/* STATUS FILTER BUTTONS */}
              <div className="flex items-center gap-1 bg-black p-1 rounded-xl border border-zinc-800 overflow-x-auto">
                {(["Todos", "Pendentes", "Pagos", "Cancelados"] as const).map((tab) => {
                  let badgeCount = 0;
                  if (tab === "Todos") badgeCount = stats.totalOrders;
                  if (tab === "Pendentes") badgeCount = stats.pendingCount;
                  if (tab === "Pagos") badgeCount = stats.paidCount;
                  if (tab === "Cancelados") badgeCount = stats.cancelledCount;

                  return (
                    <button
                      key={tab}
                      onClick={() => setStatusFilter(tab)}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                        statusFilter === tab
                          ? "bg-zinc-800 text-white border border-zinc-700 shadow-sm"
                          : "text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <span>{tab}</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                        statusFilter === tab ? "bg-zinc-700 text-amber-300" : "bg-zinc-900 text-zinc-500"
                      }`}>
                        {badgeCount}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ORDERS TABLE */}
        {loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500 space-y-2">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <span className="text-xs uppercase font-mono font-bold">Carregando pedidos do caixa...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 font-mono text-xs uppercase space-y-2">
            <ClipboardList className="w-8 h-8 text-zinc-700 mx-auto" />
            <div>Nenhum pedido encontrado para o filtro selecionado.</div>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-zinc-900 bg-black/40">
            <table className="w-full text-left text-xs">
              <thead className="bg-zinc-900/80 text-[10px] text-zinc-400 uppercase font-black tracking-wider border-b border-zinc-800">
                <tr>
                  <th className="p-3.5">Pedido / Data</th>
                  <th className="p-3.5">Cliente</th>
                  <th className="p-3.5">Cotas</th>
                  <th className="p-3.5">Valor</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Ações do Caixa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60">
                {filteredOrders.map((ord) => {
                  const normStatus = getNormalizedStatus(ord.status);
                  const isPaid = normStatus === "pago";
                  const isPending = normStatus === "pendente";
                  const isCancelled = normStatus === "cancelado";

                  const numsList = Array.from(new Set([
                    ...(Array.isArray(ord.nums) ? ord.nums : []),
                    ...(Array.isArray(ord.purchasedNums) ? ord.purchasedNums : []),
                    ...(Array.isArray(ord.bonusNums) ? ord.bonusNums : []),
                    ...(Array.isArray(ord.numbers) ? ord.numbers : []),
                  ]));

                  const clientName = ord.name || ord.customerName || ord.userName || ord.buyerName || "Cliente sem nome";
                  const rawPhone = ord.phone || ord.customerPhone || ord.whatsapp || "";
                  const cleanPhone = String(rawPhone).replace(/\D/g, "");

                  // Pre-filled WhatsApp message for payment reminders
                  const orderRaffle = allRaffles.find(r => r.id === ord.raffleId) || currentRaffleObj;
                  const raffleTitle = orderRaffle?.title || "Rifa";
                  const itemPrice = orderRaffle?.price || 10;
                  const rawOrdVal = Number(ord.val || ord.amount || ord.total || ord.totalValue || 0);
                  const computedOrdVal = rawOrdVal > 0 ? rawOrdVal : (numsList.length || 1) * itemPrice;
                  const totalValFormatted = computedOrdVal.toFixed(2).replace(".", ",");
                  const cotasStr = numsList.slice(0, 5).join(", ") + (numsList.length > 5 ? ` e +${numsList.length - 5}` : "");

                  const whatsappMessage = encodeURIComponent(
                    `Olá ${clientName}! Tudo bem?\n\nVi que você reservou ${numsList.length} cota(s) (${cotasStr}) na campanha "${raffleTitle}" no valor total de R$ ${totalValFormatted}.\n\nVocê precisa de ajuda ou da chave Pix para confirmar o pagamento do seu pedido #${ord.id}?`
                  );

                  const whatsappUrl = cleanPhone ? `https://wa.me/55${cleanPhone}?text=${whatsappMessage}` : null;

                  return (
                    <tr
                      key={ord.id}
                      className={`transition-colors ${
                        isPending
                          ? "bg-amber-500/5 hover:bg-amber-500/10 border-l-2 border-l-amber-500"
                          : "hover:bg-zinc-900/40"
                      }`}
                    >
                      {/* PEDIDO / DATA */}
                      <td className="p-3.5 font-mono">
                        <div className="font-bold text-white text-[11px] truncate max-w-[120px]" title={ord.id}>
                          #{ord.id}
                        </div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">
                          {ord.createdAt
                            ? new Date(ord.createdAt).toLocaleString("pt-BR", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit"
                              })
                            : "—"}
                        </div>
                      </td>

                      {/* CLIENTE */}
                      <td className="p-3.5">
                        <div className="font-bold text-zinc-200 uppercase text-xs truncate max-w-[160px]" title={clientName}>
                          {clientName}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {rawPhone && (
                            <span className="text-[10px] text-zinc-400 font-mono">
                              {rawPhone}
                            </span>
                          )}
                          {whatsappUrl && (
                            <a
                              href={whatsappUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-[10px] text-emerald-400 hover:text-emerald-300 font-mono rounded hover:bg-emerald-500/20 transition-all"
                              title="Lembrar pagamento no WhatsApp"
                            >
                              <MessageCircle className="w-3 h-3 text-emerald-400" />
                              Lembrar
                            </a>
                          )}
                        </div>
                      </td>

                      {/* COTAS */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-1.5 flex-wrap max-w-[180px]">
                          <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 rounded text-[10px] font-mono font-bold text-zinc-300">
                            {numsList.length} cotas
                          </span>
                          {numsList.slice(0, 3).map((n: string) => (
                            <span
                              key={n}
                              className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded text-[9px] font-mono"
                            >
                              {n}
                            </span>
                          ))}
                          {numsList.length > 3 && (
                            <span className="text-[9px] text-zinc-500 font-mono">+{numsList.length - 3}</span>
                          )}
                        </div>
                      </td>

                      {/* VALOR */}
                      <td className="p-3.5 font-mono font-bold text-xs whitespace-nowrap">
                        <span className={isPaid ? "text-emerald-400" : isPending ? "text-amber-400" : "text-zinc-500 line-through"}>
                          R$ {totalValFormatted}
                        </span>
                      </td>

                      {/* STATUS */}
                      <td className="p-3.5 whitespace-nowrap">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-black uppercase">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-[10px] font-black uppercase shadow-sm animate-pulse">
                            <Clock className="w-3.5 h-3.5 text-amber-400" /> Pendente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-[10px] font-black uppercase">
                            <XCircle className="w-3.5 h-3.5" /> Cancelado
                          </span>
                        )}
                      </td>

                      {/* AÇÕES DO CAIXA (CONFIRMAR OU ESTORNAR / CANCELAR) */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <>
                              {/* APPROVE PENDING PAYMENT */}
                              <button
                                onClick={() => {
                                  setSelectedOrderForApproval(ord);
                                  setActionError(null);
                                  setActionSuccess(null);
                                }}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-black font-black text-[10px] uppercase rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1"
                                title="Aprovar pagamento e confirmar no caixa"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Confirmar
                              </button>

                              {/* CANCEL PENDING RESERVATION */}
                              <button
                                onClick={() => {
                                  setSelectedOrderForCancel(ord);
                                  setActionError(null);
                                  setActionSuccess(null);
                                }}
                                className="px-2.5 py-1.5 bg-zinc-900 hover:bg-red-500/20 border border-zinc-800 hover:border-red-500/40 text-zinc-400 hover:text-red-400 font-black text-[10px] uppercase rounded-xl transition-all cursor-pointer flex items-center gap-1"
                                title="Cancelar reserva e liberar cotas"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                Cancelar
                              </button>
                            </>
                          )}

                          {isPaid && (
                            /* REFUND / ESTORNAR PAID PAYMENT */
                            <button
                              onClick={() => {
                                setSelectedOrderForRefund(ord);
                                setActionError(null);
                                setActionSuccess(null);
                              }}
                              className="px-2.5 py-1.5 bg-zinc-900 hover:bg-amber-500/20 border border-zinc-800 hover:border-amber-500/40 text-zinc-400 hover:text-amber-400 font-bold text-[10px] uppercase rounded-xl transition-all cursor-pointer flex items-center gap-1"
                              title="Estornar/Reembolsar pagamento e cancelar pedido"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                              Estornar
                            </button>
                          )}

                          {isCancelled && (
                            <span className="text-[10px] font-mono text-zinc-600 italic">Reserva Inativa</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🟢 MODAL DE CONFIRMAÇÃO / APROVAÇÃO MANUAL */}
      {selectedOrderForApproval && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => {
            if (!isProcessingAction) {
              setSelectedOrderForApproval(null);
              setActionError(null);
              setActionSuccess(null);
            }
          }}
        >
          <div
            className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    Confirmar Pagamento no Caixa
                  </h3>
                  <p className="text-[11px] text-zinc-400">Dar baixa manual na cota do cliente</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isProcessingAction) {
                    setSelectedOrderForApproval(null);
                    setActionError(null);
                    setActionSuccess(null);
                  }
                }}
                disabled={isProcessingAction}
                className="text-zinc-500 hover:text-zinc-300 text-lg font-bold p-1 cursor-pointer disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {actionError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-400 font-bold flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <div>{actionError}</div>
              </div>
            )}

            {actionSuccess && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-400 font-bold flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <div>{actionSuccess}</div>
              </div>
            )}

            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-black block">Código do Pedido</span>
                  <span className="font-mono font-bold text-white text-xs truncate block">
                    #{selectedOrderForApproval.id}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-black block">Status Atual</span>
                  <span className="font-mono font-bold text-amber-400 text-xs uppercase block">
                    {selectedOrderForApproval.status || "Pendente"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/60">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-black block">Cliente</span>
                  <span className="font-bold text-zinc-200 uppercase text-xs block">
                    {selectedOrderForApproval.name || selectedOrderForApproval.customerName || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-black block">Telefone</span>
                  <span className="font-mono font-bold text-zinc-300 text-xs block">
                    {selectedOrderForApproval.phone || "N/A"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/60">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-black block">Valor Total</span>
                  <span className="font-mono font-bold text-emerald-400 text-sm block">
                    R$ {Number(selectedOrderForApproval.val || selectedOrderForApproval.amount || 0).toFixed(2).replace(".", ",")}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-black block">Transação</span>
                  <span className="font-mono text-zinc-400 text-[11px] truncate block">
                    {selectedOrderForApproval.paymentId || "Pix Manual"}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/90 leading-relaxed font-medium">
                Esta ação dará baixa manual neste pagamento e confirmará a receita no caixa.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedOrderForApproval(null);
                  setActionError(null);
                  setActionSuccess(null);
                }}
                disabled={isProcessingAction}
                className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold text-xs uppercase rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={isProcessingAction || !!actionSuccess}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-black font-black text-xs uppercase rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-950/50"
              >
                {isProcessingAction ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-black" />
                    Confirmar Pagamento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🟠 MODAL DE ESTORNO / REEMBOLSO */}
      {selectedOrderForRefund && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => {
            if (!isProcessingAction) {
              setSelectedOrderForRefund(null);
              setActionError(null);
              setActionSuccess(null);
            }
          }}
        >
          <div
            className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    Estornar Pagamento
                  </h3>
                  <p className="text-[11px] text-zinc-400">Reembolsar valor e cancelar pedido</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isProcessingAction) {
                    setSelectedOrderForRefund(null);
                    setActionError(null);
                    setActionSuccess(null);
                  }
                }}
                disabled={isProcessingAction}
                className="text-zinc-500 hover:text-zinc-300 text-lg font-bold p-1 cursor-pointer disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {actionError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-400 font-bold flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <div>{actionError}</div>
              </div>
            )}

            {actionSuccess && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-400 font-bold flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <div>{actionSuccess}</div>
              </div>
            )}

            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-black block">Código do Pedido</span>
                  <span className="font-mono font-bold text-white text-xs truncate block">
                    #{selectedOrderForRefund.id}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-black block">Valor a Estornar</span>
                  <span className="font-mono font-bold text-amber-400 text-sm block">
                    R$ {Number(selectedOrderForRefund.val || selectedOrderForRefund.amount || 0).toFixed(2).replace(".", ",")}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800/60">
                <span className="text-[10px] text-zinc-500 uppercase font-black block">Cliente</span>
                <span className="font-bold text-zinc-200 uppercase text-xs block">
                  {selectedOrderForRefund.name || selectedOrderForRefund.customerName || "N/A"} ({selectedOrderForRefund.phone || "N/A"})
                </span>
              </div>
            </div>

            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-xs text-red-200/90 leading-relaxed font-medium">
                Atenção: Ao estornar, o pedido será cancelado, as cotas serão devolvidas ao estoque disponível da rifa e o Pix será estornado/invalidado no gateway.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedOrderForRefund(null);
                  setActionError(null);
                  setActionSuccess(null);
                }}
                disabled={isProcessingAction}
                className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold text-xs uppercase rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={handleConfirmRefund}
                disabled={isProcessingAction || !!actionSuccess}
                className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-amber-950/50"
              >
                {isProcessingAction ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    Processando...
                  </>
                ) : (
                  <>
                    <ArrowRightLeft className="w-4 h-4 text-black" />
                    Confirmar Estorno
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔴 MODAL DE CANCELAMENTO DE RESERVA */}
      {selectedOrderForCancel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => {
            if (!isProcessingAction) {
              setSelectedOrderForCancel(null);
              setActionError(null);
              setActionSuccess(null);
            }
          }}
        >
          <div
            className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
                  <XCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    Cancelar Reserva
                  </h3>
                  <p className="text-[11px] text-zinc-400">Liberar cotas reservadas para outros clientes</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isProcessingAction) {
                    setSelectedOrderForCancel(null);
                    setActionError(null);
                    setActionSuccess(null);
                  }
                }}
                disabled={isProcessingAction}
                className="text-zinc-500 hover:text-zinc-300 text-lg font-bold p-1 cursor-pointer disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {actionError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-400 font-bold flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <div>{actionError}</div>
              </div>
            )}

            {actionSuccess && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-400 font-bold flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <div>{actionSuccess}</div>
              </div>
            )}

            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-black block">Código do Pedido</span>
                  <span className="font-mono font-bold text-white text-xs truncate block">
                    #{selectedOrderForCancel.id}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-black block">Cliente</span>
                  <span className="font-bold text-zinc-200 uppercase text-xs block truncate">
                    {selectedOrderForCancel.name || selectedOrderForCancel.customerName || "N/A"}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Deseja realmente cancelar este pedido pendente? As cotas serão imediatamente liberadas para novos compradores.
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedOrderForCancel(null);
                  setActionError(null);
                  setActionSuccess(null);
                }}
                disabled={isProcessingAction}
                className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold text-xs uppercase rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Voltar
              </button>

              <button
                type="button"
                onClick={handleConfirmCancel}
                disabled={isProcessingAction || !!actionSuccess}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-black text-xs uppercase rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-red-950/50"
              >
                {isProcessingAction ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    Processando...
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-white" />
                    Confirmar Cancelamento
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
