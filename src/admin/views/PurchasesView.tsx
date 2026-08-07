import React, { useState, useEffect } from "react";
import { getSupabaseClient } from "../../services/supabase/supabaseClient";
import { Calendar, Search, DollarSign, Smartphone, Loader2 } from "lucide-react";

export function PurchasesView({ selectedRaffleId, limit, compact }: { selectedRaffleId: string | null, limit?: number, compact?: boolean }) {
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = limit || 20;

  useEffect(() => {
    fetchPurchases(1, true);
  }, [selectedRaffleId]);

  const fetchPurchases = async (pageNumber: number, reset: boolean = false) => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      
      setLoading(true);
      let query = supabase.from("purchase_history").select("*", { count: "exact" });
      
      if (selectedRaffleId) {
        query = query.eq("raffle_id", selectedRaffleId);
      }
      
      // Order by created_at DESC
      query = query.order("created_at", { ascending: false });
      
      // Pagination
      const from = (pageNumber - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      if (reset) {
        setPurchases(data || []);
      } else {
        setPurchases((prev) => [...prev, ...(data || [])]);
      }
      
      setHasMore(count !== null && (from + (data?.length || 0)) < count);
      setPage(pageNumber);
    } catch (err) {
      console.error("Error fetching purchases:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#1A1F1B] rounded-2xl border border-zinc-800 p-6">
        <h2 className={`${compact ? 'text-sm text-zinc-400 uppercase tracking-wider' : 'text-xl text-white'} font-bold mb-6`}>
          {compact ? 'Últimas Compras' : 'Histórico de Compras'}
        </h2>
        
        {loading && purchases.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-8 h-8 text-[#A3E635] animate-spin" />
          </div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-10 text-zinc-500">
            Nenhuma compra encontrada.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="text-xs uppercase bg-[#232924] text-zinc-500">
                <tr>
                  <th className="px-4 py-3 rounded-tl-lg">Cliente</th>
                  <th className="px-4 py-3">Telefone</th>
                  <th className="px-4 py-3">Valor</th>
                  <th className="px-4 py-3">Data</th>
                  <th className="px-4 py-3 rounded-tr-lg">Rifa</th>
                </tr>
              </thead>
              <tbody>
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="border-b border-zinc-800/50 hover:bg-[#232924]/50 transition-colors">
                    <td className="px-4 py-3 font-medium text-white">{purchase.customer_name}</td>
                    <td className="px-4 py-3">{purchase.customer_phone || "-"}</td>
                    <td className="px-4 py-3 text-[#A3E635]">R$ {Number(purchase.amount).toFixed(2).replace('.', ',')}</td>
                    <td className="px-4 py-3">{new Date(purchase.created_at).toLocaleString('pt-BR')}</td>
                    <td className="px-4 py-3">{purchase.raffle_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {!compact && hasMore && !loading && (
          <div className="mt-6 flex justify-center">
            <button 
              onClick={() => fetchPurchases(page + 1)}
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
