import React, { useState, useEffect } from "react";
import { getSupabaseClient } from "../../services/supabase/supabaseClient";
import { Trophy, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { RaffleConfig } from "../../types";

interface DrawsViewProps {
  selectedRaffleId: string | null;
  raffleConfig: RaffleConfig | null;
}

export function DrawsView({ selectedRaffleId, raffleConfig }: DrawsViewProps) {
  const [draws, setDraws] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    fetchDraws();
  }, [selectedRaffleId]);

  const fetchDraws = async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      
      setLoading(true);
      let query = supabase.from("draws").select("*");
      if (selectedRaffleId) {
        query = query.eq("raffle_id", selectedRaffleId);
      }
      query = query.order("created_at", { ascending: false });
      
      const { data, error } = await query;
      if (error) throw error;
      
      setDraws(data || []);
    } catch (err) {
      console.error("Error fetching draws:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteDraw = async () => {
    if (!selectedRaffleId || !raffleConfig) {
      setError("Selecione uma rifa válida.");
      return;
    }
    
    // Check if draw is already completed
    if (raffleConfig.status === "sorteada" || draws.some(d => d.status === "completed")) {
      setError("Esta rifa já possui um sorteio concluído.");
      return;
    }

    if (raffleConfig.drawMode === "federal") {
      setError("Esta rifa utiliza sorteio pela Loteria Federal. A apuração deve ser feita no painel principal ou aguardando o resultado oficial.");
      return;
    }

    try {
      setExecuting(true);
      setError("");
      setSuccess("");

      const adminToken = localStorage.getItem("admin_token") || localStorage.getItem("raffle_admin_token") || "";

      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "draw",
          raffleId: selectedRaffleId,
          adminToken,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess(`Sorteio realizado com sucesso! Número vencedor: ${data.winnerNumber}`);
        fetchDraws();
      } else {
        throw new Error(data.error || "Erro ao executar sorteio");
      }
    } catch (err: any) {
      setError(err.message || "Erro desconhecido ao executar sorteio");
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#1A1F1B] rounded-2xl border border-zinc-800 p-6">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-[#A3E635]" />
          Central de Sorteios
        </h2>

        {!selectedRaffleId ? (
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg text-yellow-500 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p>Selecione uma rifa no menu superior para visualizar ou executar sorteios.</p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="p-4 bg-[#232924] rounded-xl border border-zinc-700">
              <h3 className="text-lg font-semibold text-white mb-2">Executar Novo Sorteio</h3>
              <p className="text-sm text-zinc-400 mb-4">
                O sorteio automático seleciona aleatoriamente e de forma determinística um número entre todas as cotas PAGAS desta rifa.
              </p>
              
              {error && (
                <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-lg text-sm">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {success}
                </div>
              )}
              
              <button
                onClick={handleExecuteDraw}
                disabled={executing || raffleConfig?.status === "sorteada"}
                className={`px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${
                  executing || raffleConfig?.status === "sorteada"
                    ? "bg-zinc-700 text-zinc-500 cursor-not-allowed"
                    : "bg-[#A3E635] text-black hover:bg-[#8bc92a]"
                }`}
              >
                {executing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Executando Sorteio...
                  </>
                ) : (
                  <>
                    <Trophy className="w-5 h-5" />
                    Sortear Agora
                  </>
                )}
              </button>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Histórico de Sorteios</h3>
              
              {loading ? (
                <div className="flex items-center justify-center h-24">
                  <Loader2 className="w-6 h-6 text-[#A3E635] animate-spin" />
                </div>
              ) : draws.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 bg-[#232924]/50 rounded-xl border border-zinc-800">
                  Nenhum sorteio registrado para esta rifa.
                </div>
              ) : (
                <div className="space-y-4">
                  {draws.map((draw) => (
                    <div key={draw.id} className="p-4 bg-[#232924] rounded-xl border border-zinc-700/50">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div>
                          <span className="inline-block px-2 py-1 bg-[#A3E635]/10 text-[#A3E635] text-xs font-bold rounded mb-2">
                            {draw.status === 'completed' ? 'CONCLUÍDO' : draw.status.toUpperCase()}
                          </span>
                          <h4 className="text-white font-medium">Ganhador: {draw.winner_name || "Desconhecido"}</h4>
                          <p className="text-zinc-400 text-sm">Número Sorteado: <strong className="text-white">{draw.winner_number}</strong></p>
                        </div>
                        <div className="text-left sm:text-right text-sm text-zinc-500">
                          <p>Data: {new Date(draw.created_at).toLocaleString('pt-BR')}</p>
                          <p>Método: {draw.method === 'historical_manual' ? 'Manual Histórico' : draw.method}</p>
                        </div>
                      </div>
                      {draw.seed && (
                        <div className="mt-4 pt-4 border-t border-zinc-800">
                          <p className="text-xs text-zinc-500 font-mono break-all">
                            <span className="text-zinc-400">Seed:</span> {draw.seed}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
