import React, { useState } from "react";
import { collection, getDocs, query } from "firebase/firestore";
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
  Sparkles
} from "lucide-react";
import { motion } from "motion/react";

interface MinhasCotasProps {
  currentPath: string;
  setCurrentPath: (path: string) => void;
}

export default function MinhasCotas({ setCurrentPath }: MinhasCotasProps) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);

  // Enforces Brazilian phone masking: (XX) XXXXX-XXXX or (XX) XXXX-XXXX dynamically
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

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phone.trim();
    if (!cleanPhone) return;

    setLoading(true);
    setSearched(true);

    try {
      console.log(`[CUSTOMER_ORDER_LOOKUP] Querying orders in real-time for phone: "${cleanPhone}"`);
      const normalizedDigits = cleanPhone.replace(/\D/g, "");

      const q = query(collection(db, "orders"));
      const snap = await getDocs(q);
      
      const found: any[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        if (data && data.phone) {
          const orderPhoneDigits = String(data.phone || "").replace(/\D/g, "");
          // Strict normalizations comparison
          if (
            (normalizedDigits && orderPhoneDigits === normalizedDigits) || 
            String(data.phone).trim() === cleanPhone
          ) {
            found.push({
              id: docSnap.id,
              ...data,
            });
          }
        }
      });

      // Sort by date descending
      found.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });

      setOrders(found);
    } catch (err) {
      console.error("Error retrieving orders from Firestore:", err);
    } finally {
      setLoading(false);
    }
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
          <Clock className="w-3.5 h-3.5 animate-pulse shrink-0 text-orange-400" />
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

  return (
    <div className="min-h-screen bg-zinc-950 text-white relative flex flex-col items-center justify-start py-12 px-4 selection:bg-orange-500 selection:text-white">
      {/* Background premium performance glow effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_60%_at_50%_-10%,rgba(249,115,22,0.08),rgba(0,0,0,0))]" />
      <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-orange-500/5 rounded-full blur-[140px] pointer-events-none" />

      <div className="w-full max-w-xl space-y-8 relative z-10">
        
        {/* Navigation Back Header Link */}
        <button
          onClick={() => {
            window.history.pushState({}, "", "/");
            setCurrentPath("/");
          }}
          className="group flex items-center gap-2 text-zinc-500 hover:text-orange-400 transition-all text-xs font-black uppercase tracking-widest cursor-pointer outline-none"
        >
          <ChevronLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          Voltar para Home
        </button>

        {/* Title Presentation Block */}
        <div className="space-y-3 mt-2">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-orange-600 via-orange-500 to-amber-500 p-2.5 rounded-2xl shadow-lg shadow-orange-500/20">
              <Compass className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight bg-gradient-to-r from-orange-200 via-orange-400 to-amber-500 bg-clip-text text-transparent break-words max-w-full">
                Meus Números
              </h1>
              <span className="text-[9px] bg-orange-500/10 text-orange-400 border border-orange-500/20 px-2.5 py-1 rounded-full font-black uppercase tracking-widest leading-none mt-1 inline-block">
                Portal do Cliente
              </span>
            </div>
          </div>
          <p className="text-zinc-500 text-xs font-semibold leading-relaxed break-words max-w-full">
            Insira o telefone cadastrado no momento da reserva para visualizar e acompanhar instantaneamente seus números comprados, bônus recebidos e status de faturamento.
          </p>
        </div>

        {/* Search Panel Card */}
        <div className="bg-zinc-900 border border-zinc-800/80 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl shadow-orange-500/5">
          <form onSubmit={handleSearch} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block pl-1">
                Número de Telefone (WhatsApp)
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="(11) 99999-9999"
                  value={phone}
                  onChange={handlePhoneChange}
                  className="w-full bg-black/60 border border-zinc-800/80 focus:border-orange-500/60 rounded-2xl pl-5 pr-14 py-4 text-sm sm:text-base font-bold text-white placeholder-zinc-700 outline-none transition-all font-mono"
                />
                <button
                  type="submit"
                  disabled={loading || !phone}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white rounded-xl cursor-pointer transition-all flex items-center justify-center disabled:opacity-50 disabled:pointer-events-none active:scale-95 shadow-md shadow-orange-500/20 font-bold"
                  title="Buscar compras"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Dynamic List Render Area */}
        <div className="space-y-5">
          {loading && (
            <div className="flex flex-col items-center justify-center py-16 space-y-4">
              <div className="w-10 h-10 rounded-full border-2 border-zinc-900 border-t-orange-500 animate-spin" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-500 animate-pulse">
                Consultando banco de dados seguro...
              </span>
            </div>
          )}

          {!loading && searched && orders.length === 0 && (
            <div className="bg-zinc-900 border border-zinc-800/80 rounded-[2.5rem] p-8 text-center space-y-4 shadow-xl">
              <div className="w-14 h-14 rounded-2xl bg-zinc-950 border border-zinc-850 flex items-center justify-center mx-auto text-zinc-500 shadow-inner">
                <AlertCircle className="w-7 h-7 text-orange-500" />
              </div>
              <div className="space-y-2">
                <h3 className="text-sm font-black uppercase tracking-wider text-zinc-200">
                  Nenhum pedido localizado
                </h3>
                <p className="text-xs text-zinc-500 max-w-sm mx-auto font-semibold leading-relaxed break-words">
                  Não localizamos compras correspondentes ao telefone <strong className="text-zinc-400 font-bold">{phone}</strong>. Certifique-se de preencher o mesmo número de contato informado no carrinho.
                </p>
              </div>
            </div>
          )}

          {!loading && searched && orders.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between px-2">
                <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                  Reservas Encontradas ({orders.length})
                </span>
                <span className="text-[10px] text-zinc-650 font-extrabold font-mono flex items-center gap-1">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  Banco Real-Time
                </span>
              </div>

              {orders.map((item, idx) => {
                const totalNums = Array.isArray(item?.nums) ? item.nums.length : 0;
                const bonusNumsCount = Array.isArray(item?.bonusNums) ? item.bonusNums.length : 0;
                const paidNumsCount = totalNums - bonusNumsCount;

                // Use pre-calculated order total value from database, fallback safely
                const orderTotal = typeof item?.val === "number" ? item.val : Number(item?.val ?? (paidNumsCount * Number(item?.price || 10)));

                // Isolate bought and bonus arrays for structured render
                const bonusList = Array.isArray(item?.bonusNums) ? item.bonusNums : [];
                const boughtList = Array.isArray(item?.nums) ? item.nums.filter((n: string) => !bonusList.includes(n)) : [];

                return (
                  <div
                    key={item?.id || idx}
                    className="bg-zinc-90 w-full bg-zinc-900 border border-zinc-800/80 rounded-[2rem] p-6 space-y-5 relative overflow-hidden shadow-xl"
                  >
                    {/* Upper Meta Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-black text-orange-200 tracking-tight truncate">
                            Código #{item?.id ? item.id.substring(0, 10).toUpperCase() : "REGISTRY"}
                          </span>
                          <span className="text-[9px] bg-zinc-950 text-zinc-500 border border-zinc-850 px-2 py-0.5 rounded font-bold font-mono">
                            {formatDate(item?.createdAt)}
                          </span>
                        </div>
                        <div className="text-[11px] text-zinc-400 font-bold flex items-center gap-1.5 truncate">
                          <Tag className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                          <span className="truncate">Titular: {item?.name || "Sem Nome"}</span>
                        </div>
                      </div>
                      {getStatusBadge(item?.status)}
                    </div>

                    {/* Numbers lists visualizer */}
                    <div className="space-y-4 pt-1">
                      {/* Standard Bought list */}
                      {boughtList.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[9px] text-zinc-500 font-black uppercase tracking-widest block pl-0.5 flex items-center gap-1.5">
                            <Ticket className="w-3.5 h-3.5 text-orange-400/80" />
                            Cotas Compradas ({boughtList.length})
                          </span>
                          <div className="flex flex-wrap gap-1.5 font-mono">
                            {boughtList.map((num: string) => (
                              <span
                                key={num}
                                className="bg-orange-500/10 border border-orange-500/25 text-orange-400 font-bold text-xs px-2.5 py-1.5 rounded-xl block min-w-[34px] text-center"
                              >
                                {num}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Divider */}
                      {boughtList.length > 0 && bonusList.length > 0 && (
                        <div className="border-t border-dashed border-zinc-800 my-1" />
                      )}

                      {/* Special Special Bonus list */}
                      {bonusList.length > 0 && (
                        <div className="space-y-2">
                          <span className="text-[9px] text-pink-400 font-extrabold uppercase tracking-widest block pl-0.5 flex items-center gap-1.5 animate-pulse">
                            <Sparkles className="w-3.5 h-3.5" />
                            Cotas Bônus Especial ({bonusList.length})
                          </span>
                          <div className="flex flex-wrap gap-1.5 font-mono">
                            {bonusList.map((num: string) => (
                              <span
                                key={num}
                                className="bg-pink-500/10 border border-pink-500/25 text-pink-400 font-bold text-xs px-2.5 py-1.5 rounded-xl block min-w-[34px] text-center"
                                title="Cota bônus especial adicionada pelo administrador!"
                              >
                                {num}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Order Financial value trailer block */}
                    <div className="flex items-center justify-between pt-4 border-t border-zinc-850 text-xs sm:text-sm">
                      <div className="flex items-center gap-1 text-zinc-500 font-semibold">
                        <DollarSign className="w-4 h-4 text-orange-400" />
                        <span>Valor Total do Pedido:</span>
                      </div>
                      <span className="text-base sm:text-lg font-black text-white font-mono bg-gradient-to-r from-orange-200 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                        R$ {Number(orderTotal ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
