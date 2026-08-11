import React, { useState, useEffect, useMemo } from "react";
import { collection, query, where, onSnapshot, orderBy, limit as limitQuery } from "firebase/firestore";
import { db } from "../../services/firebase";
import { getSupabaseClient } from "../../services/supabase/supabaseClient";
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
  Filter
} from "lucide-react";

export function PurchasesView({
  selectedRaffleId,
  limit,
  compact
}: {
  selectedRaffleId: string | null;
  limit?: number;
  compact?: boolean;
}) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"Todos" | "Pendentes" | "Pagos" | "Cancelados">("Todos");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedOrderForApproval, setSelectedOrderForApproval] = useState<any | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [approvalSuccess, setApprovalSuccess] = useState<string | null>(null);

  const getAdminToken = () => {
    if (typeof window !== "undefined") {
      return (
        localStorage.getItem("admin_token") ||
        localStorage.getItem("raffle_admin_token") ||
        ""
      );
    }
    return "";
  };

  // Realtime subscription to Firestore orders
  useEffect(() => {
    setLoading(true);
    const colRef = collection(db, "orders");
    const q = query(colRef, orderBy("createdAt", "desc"), limitQuery(limit || 200));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedOrders: any[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          loadedOrders.push({
            id: docSnap.id,
            ...data
          });
        });

        loadedOrders.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        setOrders(loadedOrders);
        setLoading(false);
      },
      async (err) => {
        console.info("🔒 Firestore direct orders access restricted or query fallback. Fetching via secure Admin API...");
        try {
          const adminToken = getAdminToken();
          const res = await fetch("/api/admin-action", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${adminToken}`
            },
            body: JSON.stringify({
              action: "list-orders",
              raffleId: selectedRaffleId,
              limitCount: limit || 200
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.orders) {
              setOrders(data.orders);
            }
          }
        } catch (apiErr) {
          console.error("Failed to fetch orders via Admin API:", apiErr);
        } finally {
          setLoading(false);
        }
      }
    );

    return () => unsubscribe();
  }, [selectedRaffleId, limit]);

  // Normalize order status
  const getNormalizedStatus = (rawStatus: string): "pago" | "pendente" | "cancelado" => {
    const s = String(rawStatus || "").toLowerCase();
    if (s === "pago" || s === "paid" || s === "approved" || s === "confirmed" || s === "paga" || s === "pagas") {
      return "pago";
    }
    if (s === "cancelado" || s === "canceled" || s === "expired" || s === "reembolsado" || s === "refunded") {
      return "cancelado";
    }
    return "pendente";
  };

  // Filtered orders computation
  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      // Flexible raffle filter
      if (selectedRaffleId && selectedRaffleId !== "all") {
        const orderRaffleId = ord.raffleId || "current";
        const matchesRaffle =
          orderRaffleId === selectedRaffleId ||
          orderRaffleId === "current" ||
          !ord.raffleId ||
          selectedRaffleId === "current";
        if (!matchesRaffle) return false;
      }

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
  }, [orders, selectedRaffleId, statusFilter, searchQuery]);

  // KPI computations
  const stats = useMemo(() => {
    let totalPaidVal = 0;
    let totalPendingVal = 0;
    let paidCount = 0;
    let pendingCount = 0;

    orders.forEach((o) => {
      const st = getNormalizedStatus(o.status);
      const val = Number(o.val || o.amount || 0);
      if (st === "pago") {
        paidCount++;
        totalPaidVal += val;
      } else if (st === "pendente") {
        pendingCount++;
        totalPendingVal += val;
      }
    });

    return {
      totalOrders: orders.length,
      paidCount,
      pendingCount,
      totalPaidVal,
      totalPendingVal
    };
  }, [orders]);

  // Execute manual approval
  const handleConfirmApproval = async () => {
    if (!selectedOrderForApproval) return;

    setIsApproving(true);
    setApprovalError(null);
    setApprovalSuccess(null);

    try {
      const token = getAdminToken();
      const res = await adminService.manualApprovePayment(
        token,
        selectedOrderForApproval.id,
        selectedOrderForApproval.raffleId
      );

      if (res.alreadyPaid) {
        setApprovalSuccess("Este pedido já constava como Pago!");
      } else {
        setApprovalSuccess("Pagamento aprovado manualmente com sucesso! As cotas foram confirmadas.");
      }

      setTimeout(() => {
        setSelectedOrderForApproval(null);
        setApprovalSuccess(null);
      }, 1500);
    } catch (err: any) {
      console.error("Erro na aprovação manual:", err);
      setApprovalError(err.message || "Falha ao aprovar pagamento. Verifique e tente novamente.");
    } finally {
      setIsApproving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER & SUMMARY KPIs */}
      {!compact && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4">
            <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Total de Pedidos</span>
            <div className="text-xl sm:text-2xl font-black text-white mt-1 font-mono">{stats.totalOrders}</div>
          </div>
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4">
            <span className="text-[10px] font-black uppercase text-emerald-500 tracking-wider">Pagos</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 font-mono">
              {stats.paidCount} <span className="text-xs text-zinc-500 font-normal">(R$ {stats.totalPaidVal.toFixed(2).replace('.', ',')})</span>
            </div>
          </div>
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4">
            <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider">Pendentes</span>
            <div className="text-xl sm:text-2xl font-black text-amber-400 mt-1 font-mono">
              {stats.pendingCount} <span className="text-xs text-zinc-500 font-normal">(R$ {stats.totalPendingVal.toFixed(2).replace('.', ',')})</span>
            </div>
          </div>
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4">
            <span className="text-[10px] font-black uppercase text-zinc-500 tracking-wider">Total Arrecadado</span>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 mt-1 font-mono">
              R$ {stats.totalPaidVal.toFixed(2).replace('.', ',')}
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] p-4 sm:p-6 space-y-4">
        {/* TOP BAR: SEARCH & STATUS FILTERS */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <h2 className={`${compact ? 'text-sm text-zinc-400 uppercase tracking-wider' : 'text-lg sm:text-xl text-white'} font-bold flex items-center gap-2`}>
            <ClipboardList className="w-5 h-5 text-emerald-400" />
            {compact ? 'Últimos Pedidos' : 'Gerenciamento de Pedidos'}
          </h2>

          {!compact && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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
                {(["Todos", "Pendentes", "Pagos", "Cancelados"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className={`px-3 py-1.5 text-[10px] font-black uppercase rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                      statusFilter === tab
                        ? "bg-zinc-800 text-white border border-zinc-700"
                        : "text-zinc-500 hover:text-zinc-300"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ORDERS TABLE */}
        {loading && orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-zinc-500 space-y-2">
            <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
            <span className="text-xs uppercase font-mono font-bold">Carregando pedidos...</span>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-zinc-500 font-mono text-xs uppercase">
            Nenhum pedido encontrado.
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
                  <th className="p-3.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/60">
                {filteredOrders.map((ord) => {
                  const normStatus = getNormalizedStatus(ord.status);
                  const isPaid = normStatus === "pago";
                  const isPending = normStatus === "pendente";
                  const numsList = Array.from(new Set([
                    ...(Array.isArray(ord.nums) ? ord.nums : []),
                    ...(Array.isArray(ord.purchasedNums) ? ord.purchasedNums : []),
                    ...(Array.isArray(ord.bonusNums) ? ord.bonusNums : []),
                    ...(Array.isArray(ord.numbers) ? ord.numbers : []),
                  ]));
                  const clientName = ord.name || ord.customerName || ord.userName || ord.buyerName || "Cliente sem nome";
                  const rawPhone = ord.phone || ord.customerPhone || ord.whatsapp || "";
                  const cleanPhone = String(rawPhone).replace(/\D/g, "");
                  const whatsappUrl = cleanPhone ? `https://wa.me/55${cleanPhone}` : null;

                  return (
                    <tr key={ord.id} className="hover:bg-zinc-900/30 transition-colors">
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
                        <div className="font-bold text-zinc-200 uppercase text-xs truncate max-w-[150px]">
                          {clientName}
                        </div>
                        {whatsappUrl && (
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-mono mt-0.5 hover:underline"
                          >
                            <Phone className="w-3 h-3 text-emerald-500" />
                            {rawPhone}
                          </a>
                        )}
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
                      <td className="p-3.5 font-mono font-bold text-emerald-400 text-xs whitespace-nowrap">
                        R$ {Number(ord.val || ord.amount || 0).toFixed(2).replace(".", ",")}
                      </td>

                      {/* STATUS */}
                      <td className="p-3.5 whitespace-nowrap">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-black uppercase">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                          </span>
                        ) : isPending ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-lg text-[10px] font-black uppercase">
                            <Clock className="w-3.5 h-3.5" /> Pendente
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-[10px] font-black uppercase">
                            <XCircle className="w-3.5 h-3.5" /> Cancelado
                          </span>
                        )}
                      </td>

                      {/* AÇÃO */}
                      <td className="p-3.5 text-right whitespace-nowrap">
                        {!isPaid ? (
                          <button
                            onClick={() => {
                              setSelectedOrderForApproval(ord);
                              setApprovalError(null);
                              setApprovalSuccess(null);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-black font-black text-[10px] uppercase rounded-xl transition-all cursor-pointer shadow-sm flex items-center gap-1 ml-auto"
                            title="Aprovar pagamento manualmente"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Aprovar
                          </button>
                        ) : (
                          <span className="text-[10px] font-mono text-zinc-500 italic">Concluído</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL DE APROVAÇÃO MANUAL */}
      {selectedOrderForApproval && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto"
          onClick={() => {
            if (!isApproving) {
              setSelectedOrderForApproval(null);
              setApprovalError(null);
              setApprovalSuccess(null);
            }
          }}
        >
          <div
            className="bg-zinc-950 border border-zinc-800 rounded-3xl p-5 sm:p-6 max-w-lg w-full shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase tracking-wider">
                    Aprovação Manual de Pagamento
                  </h3>
                  <p className="text-[11px] text-zinc-400">Confirmação administrativa de pedido</p>
                </div>
              </div>
              <button
                onClick={() => {
                  if (!isApproving) {
                    setSelectedOrderForApproval(null);
                    setApprovalError(null);
                    setApprovalSuccess(null);
                  }
                }}
                disabled={isApproving}
                className="text-zinc-500 hover:text-zinc-300 text-lg font-bold p-1 cursor-pointer disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            {/* ERROR / SUCCESS ALERTS */}
            {approvalError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-400 font-bold flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                <div>{approvalError}</div>
              </div>
            )}

            {approvalSuccess && (
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-xs text-emerald-400 font-bold flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                <div>{approvalSuccess}</div>
              </div>
            )}

            {/* ORDER DETAILS GRID */}
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
                    {selectedOrderForApproval.status || "Aguardando"}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-800/60">
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase font-black block">Comprador</span>
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
                  <span className="text-[10px] text-zinc-500 uppercase font-black block">ID Transação Mercado Pago</span>
                  <span className="font-mono text-zinc-400 text-[11px] truncate block">
                    {selectedOrderForApproval.paymentId || "Nenhum (Manual)"}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-zinc-800/60">
                <span className="text-[10px] text-zinc-500 uppercase font-black block mb-1">
                  Cotas Selecionadas ({Array.isArray(selectedOrderForApproval.nums) ? selectedOrderForApproval.nums.length : 0})
                </span>
                <div className="max-h-24 overflow-y-auto flex flex-wrap gap-1 p-2 bg-black/50 border border-zinc-800 rounded-xl">
                  {Array.isArray(selectedOrderForApproval.nums) && selectedOrderForApproval.nums.length > 0 ? (
                    selectedOrderForApproval.nums.map((num: string) => (
                      <span key={num} className="px-2 py-0.5 bg-violet-500/10 border border-violet-500/20 text-violet-300 text-[10px] font-mono font-bold rounded">
                        {num}
                      </span>
                    ))
                  ) : (
                    <span className="text-zinc-500 text-[10px]">Nenhuma cota registrada</span>
                  )}
                </div>
              </div>
            </div>

            {/* WARNING NOTICE BOX */}
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-200/90 leading-relaxed font-medium">
                Esta ação confirma manualmente o pagamento e liberará as cotas. Confirme somente após verificar que o pagamento foi realmente recebido.
              </p>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedOrderForApproval(null);
                  setApprovalError(null);
                  setApprovalSuccess(null);
                }}
                disabled={isApproving}
                className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-bold text-xs uppercase rounded-xl transition-all cursor-pointer disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleConfirmApproval}
                disabled={isApproving || !!approvalSuccess}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-black font-black text-xs uppercase rounded-xl transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-950/50"
              >
                {isApproving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                    Processando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-black" />
                    Confirmar Aprovação Manual
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
