import React from "react";
import { ShoppingBag, Ticket, Sparkles, Check, Flame, Trophy, RefreshCw } from "lucide-react";
import { Product } from "../types";

interface ProductCardProps {
  product: Product;
  onBuyClick: (product: Product) => void;
  onNavigateToRaffle?: (raffleId: string) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onBuyClick,
  onNavigateToRaffle,
}) => {
  const isOutOfStock = product.stock <= 0 || product.isUnavailable;
  const activePrice = product.promoPrice && product.promoPrice > 0 ? product.promoPrice : product.price;

  const imageUrl =
    product.images && product.images.length > 0 && product.images[0].trim() !== ""
      ? product.images[0]
      : "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80";

  return (
    <div className="group relative bg-zinc-900/90 border border-zinc-800 hover:border-amber-500/50 rounded-2xl overflow-hidden transition-all duration-300 hover:shadow-[0_12px_35px_rgba(245,158,11,0.12)] flex flex-col justify-between">
      
      {/* CARD TOP MEDIA */}
      <div 
        className="relative aspect-square w-full bg-zinc-950 overflow-hidden flex items-center justify-center cursor-pointer"
        onClick={() => onBuyClick(product)}
      >
        <img
          src={imageUrl}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          referrerPolicy="no-referrer"
        />

        {/* GRADIENT OVERLAY */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-transparent to-transparent opacity-80" />

        {/* BADGES CONTAINER */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex flex-wrap gap-1.5 justify-between items-start pointer-events-none">
          <div className="flex flex-col gap-1 items-start">
            {product.isPromotion && (
              <span className="bg-gradient-to-r from-amber-500 to-amber-400 text-black text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-md flex items-center gap-1 font-bebas">
                <Flame className="w-3 h-3 fill-black" /> PROMOÇÃO
              </span>
            )}

            {product.isNew && (
              <span className="bg-blue-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-md flex items-center gap-1 font-bebas">
                <Sparkles className="w-3 h-3" /> LANÇAMENTO
              </span>
            )}

            {product.condition === "usado" && (
              <span className="bg-purple-600 text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-md flex items-center gap-1 font-bebas">
                <RefreshCw className="w-3 h-3" /> SEMINOVO
              </span>
            )}

            {product.isBestSeller && (
              <span className="bg-amber-500 text-black text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-md flex items-center gap-1 font-bebas">
                <Trophy className="w-3 h-3 fill-black" /> MAIS VENDIDO
              </span>
            )}
          </div>

          {/* LINKED RAFFLE BADGE */}
          {product.linkedRaffleId && (
            <span className="bg-amber-500 text-black text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-md flex items-center gap-1 border border-amber-400/60 font-bebas">
              <Ticket className="w-3 h-3" /> EM RIFA 🎟
            </span>
          )}
        </div>

        {/* OUT OF STOCK OVERLAY */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-3 text-center">
            <span className="px-3 py-1.5 bg-red-500/20 border border-red-500/40 text-red-400 font-black text-xs uppercase tracking-widest rounded-lg">
              INDISPONÍVEL
            </span>
          </div>
        )}
      </div>

      {/* CARD BODY CONTENT */}
      <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
        <div>
          {/* BRAND & CATEGORY */}
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider mb-1.5 text-zinc-400">
            <span className="text-[#F5C542] font-bebas tracking-wide">{product.category}</span>
            {product.brand && <span className="text-zinc-500">{product.brand}</span>}
          </div>

          {/* TITLE */}
          <h3 className="text-sm font-black text-white group-hover:text-amber-400 transition-colors line-clamp-2 leading-snug">
            {product.name}
          </h3>

          {/* DESCRIPTION */}
          <p className="text-xs text-zinc-400 line-clamp-2 mt-1.5 leading-relaxed font-normal">
            {product.description}
          </p>
        </div>

        {/* FOOTER & BUY ACTION */}
        <div className="space-y-3 pt-2 border-t border-zinc-800/60">
          {/* STOCK STATUS */}
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400 font-semibold">
              {product.stock > 0 ? (
                <span className="text-emerald-400 font-bold">{product.stock} em estoque</span>
              ) : (
                <span className="text-red-400 font-bold">Esgotado</span>
              )}
            </span>
            {product.sku && <span className="text-zinc-600 font-mono text-[9.5px]">SKU: {product.sku}</span>}
          </div>

          {/* PRICE DISPLAY */}
          <div className="flex items-baseline justify-between">
            <div>
              <span className="text-[9px] text-zinc-500 font-bold uppercase block">Preço</span>
              <div className="flex items-baseline gap-1.5">
                <span className="text-lg font-black text-amber-400 font-bebas tracking-wide">
                  {activePrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                </span>
                {product.promoPrice && product.promoPrice > 0 && (
                  <span className="text-xs text-zinc-500 line-through">
                    {product.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                )}
              </div>
            </div>

            {/* BUY BUTTON */}
            <button
              onClick={() => onBuyClick(product)}
              disabled={isOutOfStock}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed font-bebas"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Comprar</span>
            </button>
          </div>

          {/* LINKED RAFFLE EXTRA ACTION */}
          {product.linkedRaffleId && (
            <button
              type="button"
              onClick={() => {
                if (onNavigateToRaffle) {
                  onNavigateToRaffle(product.linkedRaffleId!);
                } else {
                  window.history.pushState(null, "", "/" + product.linkedRaffleId);
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }
              }}
              className="w-full py-1.5 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-400 hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer font-bebas"
            >
              <Ticket className="w-3.5 h-3.5" />
              <span>Comprar Rifa</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
