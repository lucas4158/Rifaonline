import React, { useState, useEffect, useMemo } from "react";
import {
  Search,
  Filter,
  ShoppingBag,
  Flame,
  Sparkles,
  Trophy,
  ShieldCheck,
  Truck,
  CreditCard,
  MessageCircle,
  Package,
  RefreshCw,
  Compass,
  ArrowRight,
  ChevronRight,
} from "lucide-react";
import { Product, ProductCategory } from "../types";
import { storeService } from "../services/storeService";
import { ProductCard } from "./ProductCard";
import { ProductBuyModal } from "./ProductBuyModal";
import { useRaffleConfig } from "../admin/RaffleConfigContext";

interface StorePageProps {
  currentPath?: string;
  setCurrentPath?: (path: string) => void;
}

const CATEGORIES: ProductCategory[] = [
  "Carretilhas",
  "Molinetes",
  "Varas",
  "Linhas",
  "Iscas",
  "Camping",
  "Acessórios",
  "Promoções",
  "Seminovos",
];

export const StorePage: React.FC<StorePageProps> = ({ currentPath = "/loja", setCurrentPath }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("Todos");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedProductForBuy, setSelectedProductForBuy] = useState<Product | null>(null);

  const { raffleConfig } = useRaffleConfig();
  const adminWhatsApp = raffleConfig.pixPhone || raffleConfig.pixReceiver || "5563999659203";

  const handleSelectProductForBuy = (product: Product | null) => {
    setSelectedProductForBuy(product);
    if (product) {
      const newUrl = `/loja?produto=${product.id}`;
      window.history.pushState(null, "", newUrl);
    } else {
      if (window.location.search.includes("produto=")) {
        window.history.pushState(null, "", "/loja");
      }
    }
  };

  // Realtime subscription to store_products
  useEffect(() => {
    setLoading(true);
    const unsubscribe = storeService.subscribeProducts((updatedProducts) => {
      setProducts(updatedProducts);
      setLoading(false);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  // Sync URL parameter "produto" on initial load / when products change
  useEffect(() => {
    if (products.length === 0) return;

    const searchParams = new URLSearchParams(window.location.search);
    const produtoId = searchParams.get("produto");

    if (produtoId) {
      const found = products.find((p) => p.id === produtoId);
      if (found) {
        setSelectedProductForBuy(found);
      }
    }
  }, [products]);

  // Handle browser back/forward buttons (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const searchParams = new URLSearchParams(window.location.search);
      const produtoId = searchParams.get("produto");

      if (produtoId && products.length > 0) {
        const found = products.find((p) => p.id === produtoId);
        setSelectedProductForBuy(found || null);
      } else {
        setSelectedProductForBuy(null);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [products]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      if (!p.isActive) return false;

      // Category filter
      if (selectedCategory !== "Todos") {
        if (selectedCategory === "Promoções") {
          if (!p.isPromotion && (!p.promoPrice || p.promoPrice <= 0)) return false;
        } else if (selectedCategory === "Seminovos") {
          if (p.category !== "Seminovos" && p.condition !== "usado") return false;
        } else if (p.category !== selectedCategory) {
          return false;
        }
      }

      // Search term filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        const matchesName = p.name.toLowerCase().includes(q);
        const matchesBrand = (p.brand || "").toLowerCase().includes(q);
        const matchesDesc = p.description.toLowerCase().includes(q);
        const matchesCat = (p.category || "").toLowerCase().includes(q);

        return matchesName || matchesBrand || matchesDesc || matchesCat;
      }

      return true;
    });
  }, [products, selectedCategory, searchTerm]);

  // Featured lists
  const highlightProducts = useMemo(() => {
    return products.filter((p) => p.isActive && p.isHighlight);
  }, [products]);

  const promoProducts = useMemo(() => {
    return products.filter((p) => p.isActive && (p.isPromotion || (p.promoPrice && p.promoPrice > 0)));
  }, [products]);

  const handleNavigateToRaffle = (raffleId: string) => {
    const targetPath = "/" + raffleId;
    if (setCurrentPath) {
      setCurrentPath(targetPath);
    }
    window.history.pushState(null, "", targetPath);
    window.dispatchEvent(new PopStateEvent("popstate"));
  };

  return (
    <div className="min-h-screen bg-[#0B0F0C] text-white pb-32 pt-8 font-inter">
      
      <main className="max-w-7xl mx-auto px-4 py-8 space-y-10">
        
        {/* SEARCH & CATEGORIES BAR */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Search Box */}
            <div className="relative w-full md:w-96">
              <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar equipamentos, marcas, varas, iscas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-[#111513] border border-[#1A1F1B] rounded-xl pl-10 pr-4 py-3 text-xs text-white placeholder-zinc-500 outline-none focus:border-[#A3E635] transition-all shadow-inner"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-white"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Total Results Count */}
            <div className="text-xs text-zinc-400 font-bold flex items-center gap-2">
              <Package className="w-4 h-4 text-[#A3E635]" />
              <span>
                Mostrando <strong className="text-white font-bebas tracking-wide">{filteredProducts.length}</strong> produtos
              </span>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              onClick={() => setSelectedCategory("Todos")}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                selectedCategory === "Todos"
                  ? "bg-[#A3E635] text-black shadow-md shadow-[#A3E635]/20 font-bebas"
                  : "bg-[#111513] text-zinc-400 hover:text-white border border-[#1A1F1B]"
              }`}
            >
              🔥 Todos
            </button>

            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-[#A3E635] text-black shadow-md shadow-[#A3E635]/20 font-bebas"
                    : "bg-[#111513] text-zinc-400 hover:text-white border border-[#1A1F1B]"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* HIGHLIGHTED SECTION IF ON "TODOS" CATEGORY AND NO SEARCH */}
        {selectedCategory === "Todos" && !searchTerm && highlightProducts.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#1A1F1B] pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#F5C542]" />
                <h2 className="text-lg font-black uppercase tracking-tight font-bebas text-white">
                  Destaques da Semana
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {highlightProducts.slice(0, 3).map((prod) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  onBuyClick={handleSelectProductForBuy}
                  onNavigateToRaffle={handleNavigateToRaffle}
                />
              ))}
            </div>
          </section>
        )}

        {/* MAIN PRODUCT GRID */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-[#1A1F1B] pb-3">
            <h2 className="text-lg font-black uppercase tracking-tight font-bebas text-white flex items-center gap-2">
              <span>Vitrine de Equipamentos</span>
              {selectedCategory !== "Todos" && (
                <span className="text-[#A3E635] text-sm">({selectedCategory})</span>
              )}
            </h2>
          </div>

          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
              <RefreshCw className="w-8 h-8 text-[#A3E635] animate-spin" />
              <p className="text-xs text-zinc-500 font-black uppercase tracking-widest animate-pulse font-bebas">
                Carregando catálogo da Loja Premium...
              </p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-16 bg-[#111513] border border-[#1A1F1B] rounded-3xl text-center p-8 space-y-3">
              <Compass className="w-10 h-10 text-zinc-600 mx-auto" />
              <h3 className="text-base font-black uppercase text-white font-bebas">
                Nenhum produto encontrado
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto">
                Não encontramos produtos para a categoria ou filtro selecionado. Tente buscar por outros termos ou categorias.
              </p>
              <button
                onClick={() => {
                  setSelectedCategory("Todos");
                  setSearchTerm("");
                }}
                className="px-5 py-2.5 bg-[#A3E635] text-black font-black text-xs uppercase rounded-xl cursor-pointer font-bebas"
              >
                Ver Todos os Produtos
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {filteredProducts.map((prod) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  onBuyClick={handleSelectProductForBuy}
                  onNavigateToRaffle={handleNavigateToRaffle}
                />
              ))}
            </div>
          )}
        </section>

        {/* PROMOTIONS BANNER CALLOUT */}
        {promoProducts.length > 0 && (
          <section className="relative rounded-3xl overflow-hidden bg-gradient-to-r from-[#111513] via-[#1A1F1B] to-[#111513] border border-[#A3E635]/30 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-2xl">
            <div className="space-y-2 text-center sm:text-left">
              <span className="px-3 py-1 bg-[#A3E635]/15 border border-[#A3E635]/30 text-[#F5C542] text-[10px] font-black uppercase tracking-widest rounded-full inline-block font-bebas">
                🔥 Ofertas Especiais
              </span>
              <h3 className="text-2xl sm:text-3xl font-black uppercase text-white font-bebas">
                Aproveite os Descontos Exclusivos
              </h3>
              <p className="text-xs text-zinc-400 max-w-lg">
                Produtos selecionados com preços promocionais por tempo limitado. Garanta já o seu equipamento de alta performance!
              </p>
            </div>

            <button
              onClick={() => {
                setSelectedCategory("Promoções");
                setSearchTerm("");
              }}
              className="px-6 py-3.5 bg-[#A3E635] hover:bg-[#bef264] text-black font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-[#A3E635]/15 transition-all active:scale-95 cursor-pointer shrink-0 font-bebas flex items-center gap-2"
            >
              <span>Ver Promoções</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </section>
        )}
      </main>

      {/* BUY MODAL */}
      <ProductBuyModal
        product={selectedProductForBuy}
        onClose={() => handleSelectProductForBuy(null)}
        adminWhatsApp={adminWhatsApp}
        onNavigateToRaffle={handleNavigateToRaffle}
      />
    </div>
  );
};
