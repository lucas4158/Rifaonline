import React, { useState, useEffect } from "react";
import { getSupabaseClient } from "../../services/supabase/supabaseClient";
import { Bell, CheckCircle2, Loader2, DollarSign } from "lucide-react";

export function NotificationsView() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    fetchNotifications(1, true);
  }, []);

  const fetchNotifications = async (pageNumber: number, reset: boolean = false) => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error("Supabase is not configured.");
      
      setLoading(true);
      
      let query = supabase.from("admin_notifications").select("*", { count: "exact" });
      query = query.order("created_at", { ascending: false });
      
      const from = (pageNumber - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      query = query.range(from, to);
      
      const { data, error, count } = await query;
      
      if (error) throw error;
      
      if (reset) {
        setNotifications(data || []);
      } else {
        setNotifications((prev) => [...prev, ...(data || [])]);
      }
      
      setHasMore(count !== null && (from + (data?.length || 0)) < count);
      setPage(pageNumber);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      
      const { error } = await supabase
        .from("admin_notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("id", id);
        
      if (!error) {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      }
    } catch (err) {
      console.error("Failed to mark as read", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) return;
      
      const { error } = await supabase
        .from("admin_notifications")
        .update({ read: true, read_at: new Date().toISOString() })
        .eq("read", false);
        
      if (!error) {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      }
    } catch (err) {
      console.error("Failed to mark all as read", err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">Notificações</h2>
          <p className="text-zinc-400">Eventos e alertas administrativos importantes</p>
        </div>
        <button 
          onClick={markAllAsRead}
          className="flex items-center gap-2 px-4 py-2 bg-[#232924] text-zinc-300 rounded-lg hover:bg-zinc-800 hover:text-white transition-colors"
        >
          <CheckCircle2 className="w-4 h-4" />
          Marcar todas como lidas
        </button>
      </div>

      <div className="bg-[#1A1F1B] rounded-2xl border border-zinc-800 p-6">
        {loading && notifications.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-8 h-8 text-[#A3E635] animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-10 flex flex-col items-center">
            <Bell className="w-12 h-12 text-zinc-700 mb-3" />
            <p className="text-zinc-500">Nenhuma notificação encontrada.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notifications.map((notif) => (
              <div 
                key={notif.id} 
                className={`p-4 rounded-xl border ${notif.read ? 'bg-[#232924]/30 border-zinc-800/50' : 'bg-[#232924] border-[#A3E635]/30'}`}
                onClick={() => !notif.read && markAsRead(notif.id)}
              >
                <div className="flex gap-4">
                  <div className={`p-3 rounded-lg flex-shrink-0 h-fit ${notif.read ? 'bg-zinc-800/50 text-zinc-500' : 'bg-[#A3E635]/10 text-[#A3E635]'}`}>
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className={`font-semibold ${notif.read ? 'text-zinc-300' : 'text-white'}`}>{notif.title}</h4>
                      <span className="text-xs text-zinc-500 whitespace-nowrap ml-2">
                        {new Date(notif.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </span>
                    </div>
                    <div className="text-sm text-zinc-400 space-y-1">
                      <p><span className="text-zinc-300">Cliente:</span> {notif.customer_name}</p>
                      {notif.amount && <p><span className="text-zinc-300">Valor:</span> R$ {Number(notif.amount).toFixed(2).replace('.', ',')}</p>}
                      {notif.raffle_id && <p><span className="text-zinc-300">Rifa:</span> {notif.raffle_id}</p>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {hasMore && !loading && (
          <div className="mt-6 flex justify-center">
            <button 
              onClick={() => fetchNotifications(page + 1)}
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
