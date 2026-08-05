import React, { useState, useEffect, useCallback } from "react";
import { collection, onSnapshot, query, where, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";
import { 
  ChevronLeft, 
  Trophy, 
  Calendar, 
  Clock, 
  Gift,
  Share2,
  X
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import useEmblaCarousel from 'embla-carousel-react';
import AutoScroll from 'embla-carousel-autoplay';

interface WinnerHistoryProps {
  currentPath: string;
  setCurrentPath: (path: string) => void;
}

export default function WinnerHistory({ setCurrentPath }: WinnerHistoryProps) {
  const [loading, setLoading] = useState(true);
  const [winners, setWinners] = useState<any[]>([]);
  const [selectedWinner, setSelectedWinner] = useState<any | null>(null);

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [AutoScroll({ delay: 5000 })]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "winners_history"),
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

        setWinners(historyList);
        setLoading(false);
      },
      (err) => {
        console.error("Erro no listener de winners_history:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const totalWinners = winners.length;
  const totalRaffles = new Set(winners.map(w => w.raffleId)).size;
  const totalPrizes = winners.length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white py-12 px-4 selection:bg-orange-500 selection:text-white">
      <div className="max-w-7xl mx-auto space-y-12">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => { setCurrentPath("/"); }}
            className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 text-zinc-300 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all hover:border-orange-500/40"
          >
            <ChevronLeft className="w-4 h-4" /> Voltar
          </button>
          <h1 className="text-2xl font-black uppercase tracking-tight text-white">Hall da Fama</h1>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 max-w-2xl mx-auto">
          {[
            { label: "Rifas Finalizadas", val: totalRaffles, icon: "🏆" },
            { label: "Prêmios Entregues", val: totalPrizes, icon: "🎁" },
            { label: "Ganhadores", val: totalWinners, icon: "👥" }
          ].map((s, i) => (
            <div key={i} className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl text-center">
              <div className="text-2xl font-black text-orange-400">{s.icon} {s.val}</div>
              <div className="text-[10px] text-zinc-400 uppercase font-bold mt-1">{s.label}</div>
            </div>
          ))}
        </div>
             {/* Carousel */}
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-6">
            {winners.map((w, index) => {
              const isDestaque = w.status === "Destaque";
              return (
                <div key={w.id || index} className="flex-[0_0_85%] sm:flex-[0_0_40%] md:flex-[0_0_30%] min-w-0" onClick={() => setSelectedWinner(w)}>
                  <div className={`relative rounded-3xl p-6 shadow-2xl cursor-pointer transition-all border ${
                    isDestaque 
                      ? "bg-gradient-to-b from-[#181510] to-[#0c0c0c] border-amber-500/50 hover:border-amber-400" 
                      : "bg-[#0D0D0D] border-zinc-800 hover:border-orange-500/50"
                  }`}>
                    {isDestaque && (
                      <span className="absolute top-3 right-3 bg-gradient-to-r from-yellow-500 to-amber-600 text-black text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1 shadow-md z-10">
                        <Trophy className="w-2.5 h-2.5" /> Destaque
                      </span>
                    )}
                    {w.prizeImageUrl ? (
                      <img src={w.prizeImageUrl} alt={w.prizeTitle} className="w-full h-48 object-cover rounded-2xl mb-4" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-48 bg-zinc-900 rounded-2xl mb-4 flex items-center justify-center text-zinc-700 font-bold">Sem imagem</div>
                    )}
                    <h3 className="font-black text-lg text-white mb-1 line-clamp-1">{w.prizeTitle}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      {w.winnerImageUrl ? (
                        <img src={w.winnerImageUrl} alt={w.winnerName} className="w-6 h-6 rounded-full object-cover border border-orange-500" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-zinc-850 flex items-center justify-center text-[10px] text-zinc-500 font-black">🏆</div>
                      )}
                      <p className="text-orange-400 font-bold truncate text-sm">{w.winnerName}</p>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-400">
                      <span>🎟️ {w.winnerNumber}</span>
                      <span>{w.drawDate}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
 
      {/* Modal */}
      <AnimatePresence>
        {selectedWinner && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setSelectedWinner(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="bg-zinc-900 border border-zinc-800 p-8 rounded-3xl max-w-md w-full relative" onClick={e => e.stopPropagation()}>
              <button onClick={() => setSelectedWinner(null)} className="absolute top-4 right-4 text-zinc-400"><X /></button>
              {selectedWinner.prizeImageUrl ? (
                <img src={selectedWinner.prizeImageUrl} className="w-full h-64 object-cover rounded-2xl mb-6" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-full h-64 bg-zinc-850 rounded-2xl mb-6 flex items-center justify-center text-zinc-700 font-bold">Sem imagem</div>
              )}
              <h2 className="text-2xl font-black mb-1">{selectedWinner.prizeTitle}</h2>
              {selectedWinner.prizeDescription && (
                <p className="text-zinc-400 text-xs mt-1 mb-3">{selectedWinner.prizeDescription}</p>
              )}
              {selectedWinner.prizeValue && (
                <div className="text-xs text-emerald-400 font-black font-mono mb-3">Valor Estimado: R$ {selectedWinner.prizeValue}</div>
              )}
              
              <div className="flex items-center gap-3.5 bg-black/30 border border-zinc-800/40 p-3 rounded-2xl mb-4">
                {selectedWinner.winnerImageUrl ? (
                  <img src={selectedWinner.winnerImageUrl} alt={selectedWinner.winnerName} className="w-12 h-12 rounded-full object-cover border-2 border-orange-500 shadow-md" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-750 flex items-center justify-center text-zinc-500 font-black">🏆</div>
                )}
                <div>
                  <p className="text-sm font-black text-white uppercase">{selectedWinner.winnerName}</p>
                  {selectedWinner.instagram && (
                    <a 
                      href={`https://instagram.com/${selectedWinner.instagram.replace("@", "")}`} 
                      target="_blank" 
                      rel="noreferrer" 
                      className="text-xs text-orange-400 hover:text-orange-300 font-mono"
                    >
                      @{selectedWinner.instagram.replace("@", "")}
                    </a>
                  )}
                </div>
              </div>
              
              <div className="space-y-2 text-sm text-zinc-300">
                <p>Cota: <strong className="text-white font-mono">{selectedWinner.winnerNumber}</strong></p>
                <p>Data: <strong className="text-white">{selectedWinner.drawDate} {selectedWinner.drawTime || ""}</strong></p>
                {(selectedWinner.city || selectedWinner.state) && (
                  <p>Local: <strong className="text-white uppercase">{selectedWinner.city}{selectedWinner.city && selectedWinner.state ? ` - ${selectedWinner.state}` : selectedWinner.state}</strong></p>
                )}
              </div>
              
              {selectedWinner.videoLink && (
                <a 
                  href={selectedWinner.videoLink} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="w-full mt-4 bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 text-sm transition-all"
                >
                  🎥 Assistir Vídeo do Sorteio
                </a>
              )}
              <a 
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`Confira o ganhador do sorteio ${selectedWinner.prizeTitle}! O felizardo foi ${selectedWinner.winnerName} com a cota ${selectedWinner.winnerNumber}! 🏆`)}`}
                target="_blank" 
                rel="noreferrer"
                className="w-full mt-3 bg-green-600 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-500 text-sm text-center text-white cursor-pointer"
              >
                <Share2 className="w-5 h-5" /> Compartilhar no WhatsApp
              </a>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
