import React, { useState } from "react";
import { X, ShoppingBag, MessageCircle, ShieldCheck, Ticket, Plus, Minus, Lock, Share2, Copy, Check } from "lucide-react";
import { Product } from "../types";
import { safeCopyToClipboard } from "../utils/helpers";

interface ProductBuyModalProps {
  product: Product | null;
  onClose: () => void;
  adminWhatsApp?: string;
  onNavigateToRaffle?: (raffleId: string) => void;
}

export const ProductBuyModal: React.FC<ProductBuyModalProps> = ({
  product,
  onClose,
  adminWhatsApp = "5563999659203",
  onNavigateToRaffle,
}) => {
  if (!product) return null;

  const activePrice = product.promoPrice && product.promoPrice > 0 ? product.promoPrice : product.price;
  const [quantity, setQuantity] = useState<number>(1);
  const [customerName, setCustomerName] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [selectedImgIndex, setSelectedImgIndex] = useState<number>(0);
  const [copiedToast, setCopiedToast] = useState<boolean>(false);

  const maxQuantity = product.stock > 0 ? product.stock : 1;
  const totalPrice = activePrice * quantity;

  const handleShareProduct = async () => {
    try {
      if (!product) return;
      const shareUrl = `${window.location.origin}/loja?produto=${product.id}`;
      const shareText = `Confira ${product.name} na nossa Loja Premium!`;

      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        try {
          await navigator.share({
            title: product.name,
            text: shareText,
            url: shareUrl,
          });
          return;
        } catch (err: any) {
          if (err?.name === "AbortError") return;
          console.warn("[Share API Error]:", err);
        }
      }

      const copied = await safeCopyToClipboard(shareUrl);
      if (copied) {
        setCopiedToast(true);
        setTimeout(() => setCopiedToast(false), 3000);
      } else {
        alert("Link copiado: " + shareUrl);
      }
    } catch (err) {
      console.warn("[Share Product Error]:", err);
    }
  };

  const handleIncrement = () => {
    if (quantity < maxQuantity) setQuantity((prev) => prev + 1);
  };

  const handleDecrement = () => {
    if (quantity > 1) setQuantity((prev) => prev - 1);
  };

  const handleBuyWhatsApp = (e: React.FormEvent) => {
    e.preventDefault();

    if (!customerName.trim()) {
      alert("Por favor, preencha o seu nome para continuar.");
      return;
    }

    if (!customerPhone.trim()) {
      alert("Por favor, preencha o seu telefone para contato.");
      return;
    }

    const cleanPhone = adminWhatsApp.replace(/\D/g, "") || "5563999659203";
    const formattedPrice = totalPrice.toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });

    const messageLines = [
      `Olá!`,
      `Tenho interesse no seguinte produto:`,
      ``,
      `*Produto:* ${product.name}`,
      `*Quantidade:* ${quantity}`,
      `*Valor Total:* ${formattedPrice}`,
      ``,
      `*Meu nome é:* ${customerName.trim()}`,
      `*Meu telefone é:* ${customerPhone.trim()}`,
      ``,
      `Gostaria de finalizar a compra.`,
    ];

    const encodedMessage = encodeURIComponent(messageLines.join("\n"));
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
    onClose();
  };

  const mainImage =
    product.images && product.images.length > 0
      ? product.images[selectedImgIndex] || product.images[0]
      : "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[#0B0B0E] border border-[#2B2B38] rounded-2xl sm:rounded-3xl p-5 sm:p-7 shadow-[0_25px_80px_rgba(0,0,0,0.9)] text-white my-auto">
        
        {/* Glow background */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-[#FF8A00]/20 rounded-full blur-[90px] pointer-events-none" />

        {/* ACTION BUTTONS (SHARE & CLOSE) */}
        <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
          <button
            type="button"
            onClick={handleShareProduct}
            className="p-2 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/60 hover:border-[#FF8A00]/40 rounded-xl text-zinc-400 hover:text-white transition-all cursor-pointer flex items-center justify-center"
            title="Compartilhar produto"
          >
            {copiedToast ? <Check className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 bg-zinc-900/90 hover:bg-zinc-800 border border-zinc-700/60 rounded-xl text-zinc-400 hover:text-white transition-all cursor-pointer flex items-center justify-center"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* COPIED TOAST POPUP */}
        {copiedToast && (
          <div className="absolute top-16 right-4 z-20 bg-emerald-500/90 text-zinc-950 px-3 py-1.5 rounded-xl text-xs font-black shadow-lg flex items-center gap-1.5 border border-emerald-300">
            <Check className="w-3.5 h-3.5" />
            <span>Link copiado!</span>
          </div>
        )}

        {/* HEADER */}
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[#FF8A00]/20 border border-[#FF8A00]/40 flex items-center justify-center text-[#FF8A00]">
            <ShoppingBag className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-[#FFC247]">
              Finalizar Pedido • Loja Premium
            </span>
            <h3 className="text-lg sm:text-xl font-extrabold uppercase font-montserrat text-white leading-tight">
              {product.name}
            </h3>
          </div>
        </div>

        {/* PRODUCT DETAILS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-4 mb-5">
          {/* IMAGE PREVIEW */}
          <div className="sm:col-span-2 flex flex-col gap-2">
            <div className="relative aspect-square w-full rounded-xl bg-black border border-zinc-800 overflow-hidden flex items-center justify-center">
              <img
                src={mainImage}
                alt={product.name}
                className="w-full h-full object-cover"
              />
              {product.promoPrice && product.promoPrice > 0 && (
                <span className="absolute top-2 left-2 bg-gradient-to-r from-[#FF8A00] to-[#FFC247] text-[#070709] text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md shadow-md">
                  PROMOÇÃO
                </span>
              )}
            </div>

            {/* Thumbnails if multiple images */}
            {product.images && product.images.length > 1 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedImgIndex(idx)}
                    className={`w-11 h-11 rounded-lg border overflow-hidden shrink-0 transition-all ${
                      selectedImgIndex === idx
                        ? "border-[#FF8A00] ring-1 ring-[#FF8A00]"
                        : "border-zinc-800 opacity-60 hover:opacity-100"
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PRODUCT SPECS & PRICE */}
          <div className="sm:col-span-3 flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-2 mb-1.5">
                {product.brand && (
                  <span className="px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-300 text-[10px] font-black uppercase tracking-wider rounded">
                    {product.brand}
                  </span>
                )}
                <span className="px-2 py-0.5 bg-[#FF8A00]/10 border border-[#FF8A00]/30 text-[#FFC247] text-[10px] font-black uppercase tracking-wider rounded">
                  {product.category}
                </span>
              </div>

              <p className="text-xs text-zinc-400 line-clamp-3 leading-relaxed mb-3">
                {product.description}
              </p>

              {/* Stock Badge */}
              <div className="text-xs font-semibold text-zinc-300">
                Estoque:{" "}
                {product.stock > 0 ? (
                  <span className="text-emerald-400 font-bold">{product.stock} unidades disponíveis</span>
                ) : (
                  <span className="text-red-400 font-bold">Esgotado</span>
                )}
              </div>
            </div>

            {/* Price Box */}
            <div className="bg-[#121218] border border-zinc-800 rounded-xl p-3 flex items-center justify-between">
              <div>
                <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                  Valor Unitário
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-black text-white font-montserrat">
                    {activePrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                  </span>
                  {product.promoPrice && product.promoPrice > 0 && (
                    <span className="text-xs text-zinc-500 line-through">
                      {product.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  )}
                </div>
              </div>

              {/* QUANTITY COUNTER */}
              <div className="flex items-center gap-2 bg-black border border-zinc-800 rounded-lg p-1">
                <button
                  type="button"
                  onClick={handleDecrement}
                  disabled={quantity <= 1}
                  className="w-7 h-7 rounded bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="w-7 text-center font-black text-sm text-white">{quantity}</span>
                <button
                  type="button"
                  onClick={handleIncrement}
                  disabled={quantity >= maxQuantity}
                  className="w-7 h-7 rounded bg-zinc-900 hover:bg-zinc-800 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* LINKED RAFFLE CALLOUT */}
        {product.linkedRaffleId && (
          <div className="mb-4 bg-gradient-to-r from-[#181108] to-[#120D0A] border border-[#FF8A00]/40 rounded-xl p-3.5 flex items-center justify-between gap-3 shadow-md">
            <div className="flex items-center gap-2.5">
              <Ticket className="w-5 h-5 text-[#FF8A00] shrink-0 animate-bounce" />
              <div>
                <span className="text-xs font-black text-white uppercase block">
                  🎟 Este produto também está em Rifa!
                </span>
                <span className="text-[11px] text-zinc-400 leading-tight block">
                  Quer tentar a sorte por um valor menor?
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                if (onNavigateToRaffle) {
                  onNavigateToRaffle(product.linkedRaffleId!);
                } else {
                  window.history.pushState(null, "", "/" + product.linkedRaffleId);
                  window.dispatchEvent(new PopStateEvent("popstate"));
                }
              }}
              className="px-3 py-2 bg-[#FF8A00] hover:bg-[#FF9C1A] text-[#070709] font-black text-xs uppercase rounded-lg shrink-0 transition-all cursor-pointer font-montserrat shadow-sm"
            >
              Participar da Rifa
            </button>
          </div>
        )}

        {/* CUSTOMER INFO FORM */}
        <form onSubmit={handleBuyWhatsApp} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-black uppercase text-zinc-300 mb-1">
                Seu Nome
              </label>
              <input
                type="text"
                placeholder="Ex: João da Silva"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
                className="w-full bg-black/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#FF8A00] transition-all"
              />
            </div>

            <div>
              <label className="block text-[11px] font-black uppercase text-zinc-300 mb-1">
                Seu WhatsApp / Telefone
              </label>
              <input
                type="text"
                placeholder="Ex: (11) 99999-9999"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                required
                className="w-full bg-black/80 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-600 outline-none focus:border-[#FF8A00] transition-all"
              />
            </div>
          </div>

          {/* TOTAL & BUY BUTTON */}
          <div className="pt-2 border-t border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <span className="text-[10px] text-zinc-400 font-bold uppercase block">
                Valor Total do Pedido
              </span>
              <span className="text-2xl font-black text-[#FFC247] font-montserrat">
                {totalPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </span>
            </div>

            <button
              type="submit"
              disabled={product.stock <= 0}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#22c35e] hover:to-[#0f7a6e] text-white font-black uppercase tracking-wider text-sm py-3.5 px-6 rounded-xl shadow-[0_8px_25px_rgba(37,211,102,0.35)] transition-all active:scale-98 cursor-pointer font-montserrat disabled:opacity-50"
            >
              <MessageCircle className="w-5 h-5 fill-white" />
              <span>Comprar pelo WhatsApp</span>
            </button>
          </div>
        </form>

        <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500 text-center font-medium">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>Atendimento direto com nossa equipe via WhatsApp. Compra 100% segura.</span>
        </div>
      </div>
    </div>
  );
};
