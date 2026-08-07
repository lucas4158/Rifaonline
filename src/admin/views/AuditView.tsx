import React, { useState, useEffect } from "react";
import { getSupabaseClient } from "../../services/supabase/supabaseClient";
import { ShieldCheck, Loader2 } from "lucide-react";

export function AuditView({ selectedRaffleId }: { selectedRaffleId: string | null }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    fetchLogs(1, true);
  }, [selectedRaffleId]);

  const fetchLogs = async (pageNumber: number, reset: boolean = false) => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      
      setLoading(true);
      
      let query = supabase.from("audit_logs").select("*", { count: "exact" });
      
      if (selectedRaffleId) {
        query = query.eq("raffle_id", selectedRaffleId);
      }
      
      query = query.order("created_at", { ascending: false });
      
      const from = (pageNumber - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      if (reset) {
        setLogs(data || []);
      } else {
        setLogs((prev) => [...prev, ...(data || [])]);
      }
      
      setHasMore(count !== null && (from + (data?.length || 0)) < count);
      setPage(pageNumber);
    } catch (err) {
      console.error("Error fetching audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#1A1F1B] rounded-2xl border border-zinc-800 p-6">
        <div className="flex items-center gap-3 mb-6">
          <ShieldCheck className="w-6 h-6 text-[#A3E635]" />
          <h2 className="text-xl font-bold text-white">Log de Auditoria</h2>
        </div>
        
        {loading && logs.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-8 h-8 text-[#A3E635] animate-spin" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-10 text-zinc-500">
            Nenhum registro de auditoria encontrado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="text-xs uppercase bg-[#232924] text-zinc-500">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Data/Hora</th>
                  <th className="px-4 py-3">Evento</th>
                  <th className="px-4 py-3">Entidade/Ator</th>
                  <th className="px-4 py-3 rounded-tr-lg">Detalhes</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-zinc-800/50 hover:bg-[#232924]/50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{new Date(log.created_at).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3 font-medium text-[#A3E635]">{log.event_type}</td>
                    <td className="px-4 py-3">{log.actor_name || "Sistema"}</td>
                    <td className="px-4 py-3 text-xs">
                      {log.metadata ? (
                        <pre className="whitespace-pre-wrap font-mono text-zinc-500">{JSON.stringify(log.metadata, null, 2)}</pre>
                      ) : (
                        "-"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {hasMore && !loading && (
          <div className="mt-6 flex justify-center">
            <button 
              onClick={() => fetchLogs(page + 1)}
              className="px-4 py-2 bg-[#232924] text-zinc-300 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              Carregar mais
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
