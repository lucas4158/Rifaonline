import React, { useState, useEffect, useMemo } from "react";
import { getSupabaseClient } from "../../services/supabase/supabaseClient";
import { adminService } from "../../services/adminService";
import { useRaffleConfig } from "../RaffleConfigContext";
import { db } from "../../services/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { 
  Trophy, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  Sparkles, 
  Search, 
  Award, 
  ShieldCheck, 
  RefreshCw, 
  Building2, 
  Shuffle, 
  Edit3,
  Users,
  Check,
  X,
  ExternalLink
} from "lucide-react";
import { RaffleConfig } from "../../types";

interface DrawsViewProps {
  selectedRaffleId: string | null;
  raffleConfig: RaffleConfig | null;
}

export function DrawsView({ selectedRaffleId: propSelectedRaffleId, raffleConfig: propRaffleConfig }: DrawsViewProps) {
  const { raffles, selectedRaffleId: contextRaffleId, setSelectedRaffleId, fetchRaffles } = useRaffleConfig();

  // Active selected raffle ID
  const activeRaffleId = propSelectedRaffleId || contextRaffleId || (raffles.length > 0 ? raffles[0].id : "");

  // Current raffle object
  const currentRaffle = useMemo(() => {
    return raffles.find((r) => r.id === activeRaffleId) || propRaffleConfig || (raffles.length > 0 ? raffles[0] : null);
  }, [raffles, activeRaffleId, propRaffleConfig]);

  // Orders state to calculate paid quotas statistics
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(true);

  // Draws history
  const [draws, setDraws] = useState<any[]>([]);
  const [loadingDraws, setLoadingDraws] = useState<boolean>(true);

  // Draw execution settings
  const [drawMode, setDrawMode] = useState<"automatico" | "manual" | "federal">("automatico");
  const [manualWinnerNumber, setManualWinnerNumber] = useState<string>("");
  const [federalNumber, setFederalNumber] = useState<string>("");

  // States for UI modals & feedback
  const [executing, setExecuting] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [latestWinnerModal, setLatestWinnerModal] = useState<any | null>(null);

  // Realtime subscription for Firestore orders to compute exact paid quota stats
  useEffect(() => {
    if (!activeRaffleId) {
      setOrders([]);
      setLoadingOrders(false);
      return;
    }

    setLoadingOrders(true);
    const colRef = collection(db, "orders");
    const unsub = onSnapshot(
      colRef,
      (snapshot) => {
        const list: any[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if ((data.raffleId || "current") === activeRaffleId) {
            list.push({ id: docSnap.id, ...data });
          }
        });
        setOrders(list);
        setLoadingOrders(false);
      },
      async (err) => {
        console.info("🔒 Direct orders subscription restricted. Fetching via Admin API...");
        try {
          const token = localStorage.getItem("admin_token") || localStorage.getItem("raffle_admin_token") || "";
          const res = await fetch("/api/admin-action", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({
              action: "list-orders",
              raffleId: activeRaffleId
            })
          });
          if (res.ok) {
            const data = await res.json();
            if (data.orders) setOrders(data.orders);
          }
        } catch (apiErr) {
          console.error("Failed to fetch orders via Admin API in DrawsView:", apiErr);
        } finally {
          setLoadingOrders(false);
        }
      }
    );

    return () => unsub();
  }, [activeRaffleId]);

  // Fetch draws history from Supabase / Backend
  useEffect(() => {
    fetchDrawsHistory();
  }, [activeRaffleId]);

  const fetchDrawsHistory = async () => {
    try {
      setLoadingDraws(true);
      const supabase = getSupabaseClient();
      if (!supabase) {
        setLoadingDraws(false);
        return;
      }

      let query = supabase.from("draws").select("*");
      if (activeRaffleId) {
        query = query.eq("raffle_id", activeRaffleId);
      }
      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) {
        console.warn("Erro ao buscar histórico de sorteios:", error);
      } else {
        setDraws(data || []);
      }
    } catch (err) {
      console.error("Erro em fetchDrawsHistory:", err);
    } finally {
      setLoadingDraws(false);
    }
  };

  // Quotas calculations for the active raffle
  const quotaStats = useMemo(() => {
    const totalNumbers = currentRaffle?.totalNumbers || 100;
    
    // Eligible paid orders
    const paidOrders = orders.filter((o) => 
      o.status === "Pago" || o.status === "paid" || o.status === "approved" || o.status === "pago" || o.status === "confirmed"
    );

    // Normalize number strings (e.g. "007" -> "7")
    const normalizeQuota = (q: string): string => {
      const cleaned = String(q).replace(/^0+/, "");
      return cleaned === "" ? "0" : cleaned;
    };

    const paidNumbersSet = new Set<string>();
    paidOrders.forEach((o) => {
      (o.nums || []).forEach((n: string) => paidNumbersSet.add(normalizeQuota(n)));
    });

    const paidCount = paidNumbersSet.size;
    const percentPaid = totalNumbers > 0 ? Math.min(100, Math.round((paidCount / totalNumbers) * 100)) : 0;
    const isFullyPaid = paidCount >= totalNumbers;

    return {
      totalNumbers,
      paidCount,
      paidOrdersCount: paidOrders.length,
      percentPaid,
      isFullyPaid
    };
  }, [orders, currentRaffle]);

  // Buyer lookup helper for manual or federal number
  const lookupBuyerForNumber = (numStr: string) => {
    if (!numStr.trim()) return null;

    const normalizeQuota = (q: string): string => {
      const cleaned = String(q).replace(/^0+/, "");
      return cleaned === "" ? "0" : cleaned;
    };

    const targetNorm = normalizeQuota(numStr);
    const foundOrder = orders.find((o) => 
      (o.status === "Pago" || o.status === "paid" || o.status === "approved" || o.status === "pago" || o.status === "confirmed") &&
      (o.nums || []).map(normalizeQuota).includes(targetNorm)
    );

    if (foundOrder) {
      return {
        name: foundOrder.name || "Comprador Registrado",
        phone: foundOrder.phone || "",
        orderId: foundOrder.id
      };
    }
    return null;
  };

  // Live preview for manual / federal selection
  const manualBuyerPreview = useMemo(() => {
    if (drawMode === "manual" && manualWinnerNumber) {
      return lookupBuyerForNumber(manualWinnerNumber);
    }
    if (drawMode === "federal" && federalNumber) {
      return lookupBuyerForNumber(federalNumber);
    }
    return null;
  }, [drawMode, manualWinnerNumber, federalNumber, orders]);

  // Handler to change selected raffle from dropdown
  const handleSelectRaffle = (newId: string) => {
    if (setSelectedRaffleId) {
      setSelectedRaffleId(newId);
    }
    setError("");
    setSuccess("");
    setManualWinnerNumber("");
    setFederalNumber("");
  };

  // Main Draw Execution Handler
  const handleStartDrawFlow = () => {
    setError("");
    setSuccess("");

    if (!activeRaffleId || !currentRaffle) {
      setError("Por favor, selecione uma rifa válida para sortear.");
      return;
    }

    if (currentRaffle.status === "encerrada" || currentRaffle.status === "sorteada") {
      setError("Esta rifa já foi encerrada e sorteada anteriormente.");
      return;
    }

    if (drawMode === "manual" && !manualWinnerNumber.trim()) {
      setError("Por favor, informe o número vencedor para o sorteio manual.");
      return;
    }

    if (drawMode === "federal" && !federalNumber.trim()) {
      setError("Por favor, informe o número sorteado na Loteria Federal.");
      return;
    }

    // Check if quotas are 100% paid
    if (!quotaStats.isFullyPaid) {
      setShowConfirmModal(true);
    } else {
      executeDraw();
    }
  };

  const executeDraw = async () => {
    setShowConfirmModal(false);
    setExecuting(true);
    setError("");
    setSuccess("");

    try {
      const adminToken = localStorage.getItem("admin_token") || localStorage.getItem("raffle_admin_token") || "";

      let winnerNumParam: string | undefined = undefined;
      let methodLabel = "AUTOMATIC_RIFAMASTER";

      if (drawMode === "manual") {
        winnerNumParam = manualWinnerNumber.trim();
        methodLabel = "MANUAL_INPUT";
      } else if (drawMode === "federal") {
        winnerNumParam = federalNumber.trim();
        methodLabel = "LOTERIA_FEDERAL";
      }

      // Step 1: Run Draw in backend
      const drawResult = await adminService.draw(
        adminToken, 
        activeRaffleId, 
        winnerNumParam, 
        methodLabel
      );

      if (!drawResult || (!drawResult.success && !drawResult.winnerNumber)) {
        throw new Error(drawResult?.error || "Falha ao realizar a apuração do sorteio.");
      }

      const winnerNum = drawResult.winnerNumber || winnerNumParam || "---";
      const winnerName = drawResult.winnerName || "Ganhador Identificado";

      // Step 2: Publish Draw, update status to "encerrada", and publish to Hall da Fama
      const nowIsoDate = new Date().toLocaleDateString("pt-BR");
      const nowIsoTime = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

      const configToPublish = drawResult.pendingConfig || {
        id: activeRaffleId,
        title: currentRaffle.title,
        imageUrl: currentRaffle.imageUrl || "",
        winnerNumber: winnerNum,
        winnerName: winnerName,
        winnerPhone: drawResult.winnerPhone || "",
        drawDate: nowIsoDate,
        drawTime: nowIsoTime,
        drawMethod: methodLabel,
        status: "encerrada",
        isRaffleActive: false,
        isActive: false
      };

      await adminService.publishDraw(
        adminToken,
        drawResult.drawId || "DRAW_" + Date.now(),
        configToPublish,
        activeRaffleId
      );

      // Step 3: Refresh global raffles and local draws list
      if (fetchRaffles) {
        await fetchRaffles();
      }
      await fetchDrawsHistory();

      // Step 4: Show Winner Modal Announcement
      setLatestWinnerModal({
        raffleTitle: currentRaffle.title,
        winnerNumber: winnerNum,
        winnerName: winnerName,
        drawMode: methodLabel === "AUTOMATIC_RIFAMASTER" ? "Sorteio Eletrônico Automático" : (methodLabel === "LOTERIA_FEDERAL" ? "Extração Loteria Federal" : "Sorteio Manual"),
        drawDate: `${nowIsoDate} às ${nowIsoTime}`,
        paidCount: quotaStats.paidCount,
        totalNumbers: quotaStats.totalNumbers
      });

      setSuccess(`Sorteio realizado com sucesso! O número vencedor #${winnerNum} foi publicado no Hall da Fama e a rifa foi encerrada.`);
    } catch (err: any) {
      console.error("Erro ao executar sorteio:", err);
      setError(err.message || "Ocorreu um erro ao processar o sorteio.");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER CARD */}
      <div className="bg-[#1A1F1B] rounded-2xl border border-zinc-800 p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-[#A3E635]/10 rounded-xl border border-[#A3E635]/20">
              <Trophy className="w-7 h-7 text-[#A3E635]" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-wide uppercase">Central de Sorteios</h2>
              <p className="text-xs text-zinc-400 font-medium">
                Apuração oficial, verificação de cotas, publicação no Hall da Fama e encerramento
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              if (fetchRaffles) fetchRaffles();
              fetchDrawsHistory();
            }}
            className="self-start sm:self-auto px-4 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-xl text-xs font-bold text-zinc-300 hover:text-white flex items-center gap-2 transition-all cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar Dados
          </button>
        </div>

        {/* RAFFLE SELECTOR DROPDOWN */}
        <div className="mt-6 space-y-4">
          <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">
            🎯 Selecione a Rifa para Realizar o Sorteio
          </label>

          {raffles.length === 0 ? (
            <div className="p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl text-zinc-400 text-sm flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <span>Nenhuma rifa encontrada no sistema. Crie uma rifa primeiro no Painel Principal.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="md:col-span-2">
                <select
                  value={activeRaffleId}
                  onChange={(e) => handleSelectRaffle(e.target.value)}
                  className="w-full bg-[#232924] border border-zinc-700 text-white font-bold text-sm rounded-xl p-3.5 focus:border-[#A3E635] focus:outline-none transition-all cursor-pointer"
                >
                  {raffles.map((r) => {
                    const isEnded = r.status === "encerrada" || r.status === "sorteada";
                    const statusLabel = isEnded ? " [ENCERRADA]" : r.status === "ativa" ? " [ATIVA]" : " [PAUSADA]";
                    return (
                      <option key={r.id} value={r.id}>
                        {r.title} {statusLabel} - ({r.totalNumbers} cotas)
                      </option>
                    );
                  })}
                </select>
              </div>

              {currentRaffle && (
                <div className="flex items-center justify-end gap-2 text-xs">
                  <span className={`px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider ${
                    currentRaffle.status === "encerrada" || currentRaffle.status === "sorteada"
                      ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                      : currentRaffle.status === "ativa"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}>
                    {currentRaffle.status === "encerrada" || currentRaffle.status === "sorteada" ? "🏆 Encerrada / Sorteada" : currentRaffle.status === "ativa" ? "🟢 Ativa" : "🟡 Pausada"}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* ACTIVE RAFFLE CARD DETAILS & QUOTAS PROGRESS */}
          {currentRaffle && (
            <div className="mt-4 p-5 bg-[#232924] rounded-2xl border border-zinc-700/70 space-y-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-lg font-black text-white">{currentRaffle.title}</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    ID: <code className="text-zinc-300 font-mono">{currentRaffle.id}</code> • Valor por Cota: <strong className="text-white">R$ {Number(currentRaffle.price || 0).toFixed(2)}</strong>
                  </p>
                </div>

                {/* Quotas Counter Badge */}
                <div className="flex items-center gap-3 bg-zinc-900/90 px-4 py-2.5 rounded-xl border border-zinc-800">
                  <Users className="w-4 h-4 text-[#A3E635]" />
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-bold text-zinc-400">Vendas & Cotas Pagas</p>
                    <p className="text-sm font-black text-white">
                      {loadingOrders ? "..." : `${quotaStats.paidCount} / ${quotaStats.totalNumbers}`}
                      <span className="text-xs font-bold text-[#A3E635] ml-1.5">({quotaStats.percentPaid}%)</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[11px] font-bold text-zinc-400">
                  <span>Progresso do Sorteio</span>
                  <span className={quotaStats.isFullyPaid ? "text-emerald-400 font-black" : "text-amber-400"}>
                    {quotaStats.isFullyPaid ? "✅ 100% Cotas Pagas" : `⚠️ ${quotaStats.totalNumbers - quotaStats.paidCount} cotas restantes`}
                  </span>
                </div>
                <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden p-0.5 border border-zinc-700/50">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      quotaStats.isFullyPaid
                        ? "bg-gradient-to-r from-emerald-500 to-[#A3E635]"
                        : "bg-gradient-to-r from-amber-500 to-yellow-400"
                    }`}
                    style={{ width: `${Math.max(2, quotaStats.percentPaid)}%` }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DRAW EXECUTION PANEL */}
      {currentRaffle && (
        <div className="bg-[#1A1F1B] rounded-2xl border border-zinc-800 p-6 space-y-6">
          <div className="flex items-center gap-2 pb-4 border-b border-zinc-800">
            <Sparkles className="w-5 h-5 text-[#A3E635]" />
            <h3 className="text-lg font-black text-white uppercase tracking-wider">Configurar e Executar Sorteio</h3>
          </div>

          {/* Feedback Messages */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl text-xs font-bold flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-bold flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          {/* DRAW MODE SELECTION CARDS */}
          <div className="space-y-3">
            <label className="block text-xs font-black uppercase tracking-wider text-zinc-400">
              Escolha o Método de Apuração:
            </label>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Option 1: Automatic */}
              <div
                onClick={() => setDrawMode("automatico")}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  drawMode === "automatico"
                    ? "bg-[#232924] border-[#A3E635] shadow-lg shadow-[#A3E635]/5"
                    : "bg-[#232924]/60 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-[#A3E635]/10 rounded-lg text-[#A3E635]">
                    <Shuffle className="w-5 h-5" />
                  </div>
                  <input
                    type="radio"
                    name="drawMode"
                    checked={drawMode === "automatico"}
                    onChange={() => setDrawMode("automatico")}
                    className="accent-[#A3E635] w-4 h-4 cursor-pointer"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">Sorteio Eletrônico Automático</h4>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Algoritmo criptográfico RifaMaster (Seed CSPRNG) seleciona deterministicamente um número entre as cotas pagas.
                  </p>
                </div>
              </div>

              {/* Option 2: Manual */}
              <div
                onClick={() => setDrawMode("manual")}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  drawMode === "manual"
                    ? "bg-[#232924] border-[#A3E635] shadow-lg shadow-[#A3E635]/5"
                    : "bg-[#232924]/60 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-violet-500/10 rounded-lg text-violet-400">
                    <Edit3 className="w-5 h-5" />
                  </div>
                  <input
                    type="radio"
                    name="drawMode"
                    checked={drawMode === "manual"}
                    onChange={() => setDrawMode("manual")}
                    className="accent-[#A3E635] w-4 h-4 cursor-pointer"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">Sorteio Manual</h4>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Insira manualmente o número da cota sorteada em evento presencial ou live externa.
                  </p>
                </div>
              </div>

              {/* Option 3: Loteria Federal */}
              <div
                onClick={() => setDrawMode("federal")}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  drawMode === "federal"
                    ? "bg-[#232924] border-[#A3E635] shadow-lg shadow-[#A3E635]/5"
                    : "bg-[#232924]/60 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <input
                    type="radio"
                    name="drawMode"
                    checked={drawMode === "federal"}
                    onChange={() => setDrawMode("federal")}
                    className="accent-[#A3E635] w-4 h-4 cursor-pointer"
                  />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white">Extração Loteria Federal</h4>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Utilize o 1º prêmio oficial do concurso da Loteria Federal da Caixa Econômica.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* DYNAMIC MODE INPUTS */}
          {drawMode === "manual" && (
            <div className="p-4 bg-[#232924] rounded-xl border border-zinc-700/80 space-y-3 animate-fadeIn">
              <label className="block text-xs font-bold uppercase text-zinc-300">
                Digite o Número Vencedor (Cota Sorteada):
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Ex: 042"
                  value={manualWinnerNumber}
                  onChange={(e) => setManualWinnerNumber(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-white font-mono font-bold text-base focus:border-[#A3E635] focus:outline-none"
                />
              </div>

              {manualBuyerPreview && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 flex items-center justify-between">
                  <span>👤 <strong>Comprador desta cota:</strong> {manualBuyerPreview.name} ({manualBuyerPreview.phone || "Sem telefone"})</span>
                  <span className="font-bold text-[#A3E635]">Elegível</span>
                </div>
              )}
            </div>
          )}

          {drawMode === "federal" && (
            <div className="p-4 bg-[#232924] rounded-xl border border-zinc-700/80 space-y-3 animate-fadeIn">
              <label className="block text-xs font-bold uppercase text-zinc-300">
                Número do 1º Prêmio da Loteria Federal:
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Ex: 48291"
                  value={federalNumber}
                  onChange={(e) => setFederalNumber(e.target.value)}
                  className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-white font-mono font-bold text-base focus:border-[#A3E635] focus:outline-none"
                />
              </div>
              <p className="text-[11px] text-zinc-400">
                O sistema buscará a cota correspondente entre os compradores desta rifa.
              </p>

              {manualBuyerPreview && (
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 flex items-center justify-between">
                  <span>👤 <strong>Comprador desta cota:</strong> {manualBuyerPreview.name} ({manualBuyerPreview.phone || "Sem telefone"})</span>
                  <span className="font-bold text-[#A3E635]">Elegível</span>
                </div>
              )}
            </div>
          )}

          {/* EXECUTE BUTTON */}
          <div className="pt-2">
            <button
              onClick={handleStartDrawFlow}
              disabled={executing || currentRaffle.status === "encerrada" || currentRaffle.status === "sorteada"}
              className={`w-full py-4 px-6 rounded-xl font-black text-sm uppercase tracking-wider flex items-center justify-center gap-3 transition-all cursor-pointer shadow-lg ${
                executing || currentRaffle.status === "encerrada" || currentRaffle.status === "sorteada"
                  ? "bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed"
                  : "bg-gradient-to-r from-[#A3E635] to-[#82c922] text-black hover:brightness-110 active:scale-[0.99]"
              }`}
            >
              {executing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Realizando Sorteio e Publicando no Hall da Fama...</span>
                </>
              ) : currentRaffle.status === "encerrada" || currentRaffle.status === "sorteada" ? (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  <span>Sorteio Já Concluído nesta Rifa</span>
                </>
              ) : (
                <>
                  <Trophy className="w-5 h-5" />
                  <span>Executar Sorteio e Encerrar Rifa</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* HISTORY TABLE */}
      <div className="bg-[#1A1F1B] rounded-2xl border border-zinc-800 p-6 space-y-4">
        <h3 className="text-lg font-black text-white uppercase tracking-wider flex items-center gap-2">
          <Award className="w-5 h-5 text-[#A3E635]" />
          Histórico de Sorteios e Vencedores
        </h3>

        {loadingDraws ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-7 h-7 text-[#A3E635] animate-spin" />
          </div>
        ) : draws.length === 0 ? (
          <div className="text-center py-8 text-zinc-500 bg-[#232924]/50 rounded-xl border border-zinc-800 text-sm">
            Nenhum sorteio registrado até o momento para esta rifa.
          </div>
        ) : (
          <div className="space-y-3">
            {draws.map((d) => (
              <div key={d.id} className="p-4 bg-[#232924] rounded-xl border border-zinc-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-[#A3E635]/10 text-[#A3E635] text-[10px] font-black rounded uppercase">
                      {d.status === "completed" ? "CONCLUÍDO" : "PUBLICADO"}
                    </span>
                    <span className="text-xs text-zinc-400 font-medium">
                      Método: {d.method === "AUTOMATIC_RIFAMASTER" ? "Automático" : d.method === "LOTERIA_FEDERAL" ? "Loteria Federal" : "Manual"}
                    </span>
                  </div>
                  <h4 className="text-white font-bold text-base">
                    Ganhador: {d.winner_name || d.winnerName || "Ganhador Registrado"}
                  </h4>
                  <p className="text-xs text-zinc-400">
                    Número Sorteado: <strong className="text-[#A3E635] font-mono text-sm">#{d.winner_number || d.winnerNumber}</strong>
                  </p>
                </div>

                <div className="text-left sm:text-right text-xs text-zinc-400 space-y-0.5">
                  <p>📅 Data: {new Date(d.created_at || d.timestamp || Date.now()).toLocaleString("pt-BR")}</p>
                  {d.seed && (
                    <p className="font-mono text-[10px] text-zinc-500 truncate max-w-[200px]">
                      Seed: {d.seed}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL FOR INCOMPLETE QUOTAS */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#1A1F1B] border border-amber-500/30 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-scaleIn">
            <div className="flex items-center gap-3 text-amber-400">
              <div className="p-3 bg-amber-500/10 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-black text-white uppercase">Cotas Não Totalmente Pagas</h3>
            </div>

            <div className="text-sm text-zinc-300 space-y-2">
              <p>
                Atenção: Apenas <strong className="text-amber-400">{quotaStats.paidCount} de {quotaStats.totalNumbers} cotas ({quotaStats.percentPaid}%)</strong> estão pagas.
              </p>
              <p className="text-xs text-zinc-400">
                O sorteio considerará os participantes das cotas pagas ativas. Deseja prosseguir com a apuração do vencedor mesmo assim?
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={executeDraw}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase rounded-xl transition-all cursor-pointer shadow-lg"
              >
                Confirmar e Sortear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WINNER REVEAL MODAL */}
      {latestWinnerModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#1A1F1B] border-2 border-[#A3E635] rounded-3xl max-w-lg w-full p-6 text-center space-y-6 shadow-2xl relative overflow-hidden animate-scaleIn">
            {/* Background Glow */}
            <div className="absolute -top-24 -left-24 w-48 h-48 bg-[#A3E635]/20 rounded-full blur-3xl pointer-events-none" />

            <div className="flex justify-end">
              <button
                onClick={() => setLatestWinnerModal(null)}
                className="p-1 text-zinc-400 hover:text-white bg-zinc-900 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="inline-flex p-4 bg-[#A3E635]/10 border border-[#A3E635]/30 rounded-2xl text-[#A3E635] animate-bounce">
              <Trophy className="w-12 h-12" />
            </div>

            <div className="space-y-1">
              <span className="px-3 py-1 bg-[#A3E635]/10 text-[#A3E635] border border-[#A3E635]/20 text-[10px] font-black rounded-full uppercase tracking-wider">
                🏆 Sorteio Concluído & Publicado no Hall da Fama
              </span>
              <h3 className="text-xl font-black text-white uppercase mt-2">{latestWinnerModal.raffleTitle}</h3>
              <p className="text-xs text-zinc-400">{latestWinnerModal.drawDate} • {latestWinnerModal.drawMode}</p>
            </div>

            {/* Winning Number Highlight Card */}
            <div className="p-6 bg-gradient-to-b from-[#232924] to-zinc-950 border border-zinc-700/80 rounded-2xl space-y-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">Número Vencedor</span>
              <div className="text-5xl font-black text-[#A3E635] font-mono tracking-widest drop-shadow-md">
                #{latestWinnerModal.winnerNumber}
              </div>
              <p className="text-base font-black text-white pt-2">
                👤 Ganhador: {latestWinnerModal.winnerName}
              </p>
            </div>

            <div className="p-3 bg-zinc-900/80 border border-zinc-800 rounded-xl text-xs text-zinc-400">
              ✅ A rifa foi automaticamente marcada como <strong className="text-white">Encerrada</strong> e publicada no <strong className="text-[#A3E635]">Hall da Fama (Ganhadores)</strong>.
            </div>

            <button
              onClick={() => setLatestWinnerModal(null)}
              className="w-full py-3.5 bg-[#A3E635] hover:bg-[#8bc92a] text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-lg"
            >
              Concluir e Voltar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
