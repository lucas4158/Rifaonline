import React, { useState, useEffect, useMemo } from "react";
import {
  PlusCircle,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  Copy,
  Power,
  Image as ImageIcon,
  Loader2,
  Package,
  ShoppingBag,
  Flame,
  Sparkles,
  Trophy,
  Ticket,
  Upload,
  X,
  Plus,
  Check,
  AlertTriangle,
} from "lucide-react";
import { Product, ProductCategory, RaffleConfig } from "../types";
import { storeService, StoreConfig } from "../services/storeService";
import { performRobustImageUpload } from "../services/uploadService";
import { useRaffleConfig } from "./RaffleConfigContext";

interface AdminProductsProps {
  raffles?: RaffleConfig[];
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

export const AdminProducts: React.FC<AdminProductsProps> = () => {
  const { raffles } = useRaffleConfig();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("todas");
  const [statusFilter, setStatusFilter] = useState<"todos" | "ativos" | "inativos">("todos");

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [uploadingImage, setUploadingImage] = useState<boolean>(false);

  // Form Fields State
  const [formName, setFormName] = useState<string>("");
  const [formCategory, setFormCategory] = useState<string>("Carretilhas");
  const [formBrand, setFormBrand] = useState<string>("");
  const [formDescription, setFormDescription] = useState<string>("");
  const [formPrice, setFormPrice] = useState<string>("");
  const [formPromoPrice, setFormPromoPrice] = useState<string>("");
  const [formStock, setFormStock] = useState<string>("10");
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formNewImageUrl, setFormNewImageUrl] = useState<string>("");
  const [formIsHighlight, setFormIsHighlight] = useState<boolean>(false);
  const [formIsBestSeller, setFormIsBestSeller] = useState<boolean>(false);
  const [formIsNew, setFormIsNew] = useState<boolean>(false);
  const [formIsPromotion, setFormIsPromotion] = useState<boolean>(false);
  const [formIsUnavailable, setFormIsUnavailable] = useState<boolean>(false);
  const [formIsActive, setFormIsActive] = useState<boolean>(true);
  const [formCondition, setFormCondition] = useState<"novo" | "usado">("novo");
  const [formSku, setFormSku] = useState<string>("");
  const [formWeight, setFormWeight] = useState<string>("");
  const [formLinkedRaffleId, setFormLinkedRaffleId] = useState<string>("");

  // Store Status State
  const [storeConfig, setStoreConfig] = useState<StoreConfig>({ isEnabled: false });
  const [togglingStore, setTogglingStore] = useState<boolean>(false);

  // Realtime store config subscription
  useEffect(() => {
    const unsub = storeService.subscribeStoreConfig((cfg) => {
      setStoreConfig(cfg);
    });
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

  // Realtime products subscription
  useEffect(() => {
    setLoading(true);
    const unsubscribe = storeService.subscribeProducts((updated) => {
      setProducts(updated);
      setLoading(false);
    });

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, []);

  const handleToggleStoreActivation = async () => {
    const newStatus = !storeConfig.isEnabled;
    const confirmMsg = newStatus
      ? "Deseja ATIVAR a Loja Virtual para os clientes?\n\nA aba 'Loja Premium' passará a ser exibida publicamente no site."
      : "Deseja DESATIVAR a Loja Virtual?\n\nA aba 'Loja Premium' será oculta de todos os clientes, economizando recursos e banco de dados.";

    if (window.confirm(confirmMsg)) {
      try {
        setTogglingStore(true);
        await storeService.setStoreEnabled(newStatus);
      } catch (err: any) {
        alert("Erro ao alterar status da loja: " + err.message);
      } finally {
        setTogglingStore(false);
      }
    }
  };

  const handleOpenCreateModal = () => {
    setEditingProduct(null);
    setFormName("");
    setFormCategory("Carretilhas");
    setFormBrand("");
    setFormDescription("");
    setFormPrice("100");
    setFormPromoPrice("");
    setFormStock("10");
    setFormImages([]);
    setFormNewImageUrl("");
    setFormIsHighlight(false);
    setFormIsBestSeller(false);
    setFormIsNew(true);
    setFormIsPromotion(false);
    setFormIsUnavailable(false);
    setFormIsActive(true);
    setFormCondition("novo");
    setFormSku("");
    setFormWeight("");
    setFormLinkedRaffleId("");
    setShowModal(true);
  };

  const handleOpenEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setFormName(prod.name);
    setFormCategory(prod.category || "Carretilhas");
    setFormBrand(prod.brand || "");
    setFormDescription(prod.description || "");
    setFormPrice(String(prod.price));
    setFormPromoPrice(prod.promoPrice ? String(prod.promoPrice) : "");
    setFormStock(String(prod.stock ?? 0));
    setFormImages(prod.images || []);
    setFormNewImageUrl("");
    setFormIsHighlight(Boolean(prod.isHighlight));
    setFormIsBestSeller(Boolean(prod.isBestSeller));
    setFormIsNew(Boolean(prod.isNew));
    setFormIsPromotion(Boolean(prod.isPromotion));
    setFormIsUnavailable(Boolean(prod.isUnavailable));
    setFormIsActive(prod.isActive !== false);
    setFormCondition(prod.condition || "novo");
    setFormSku(prod.sku || "");
    setFormWeight(prod.weight || "");
    setFormLinkedRaffleId(prod.linkedRaffleId || "");
    setShowModal(true);
  };

  const handleAddImageUrl = () => {
    if (!formNewImageUrl.trim()) return;
    setFormImages((prev) => [...prev, formNewImageUrl.trim()]);
    setFormNewImageUrl("");
  };

  const handleRemoveImage = (index: number) => {
    setFormImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUploadImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const uploadedUrl = await performRobustImageUpload(file);
      if (uploadedUrl) {
        setFormImages((prev) => [...prev, uploadedUrl]);
      }
    } catch (err: any) {
      alert("Erro ao fazer upload da imagem: " + (err.message || "Falha ao enviar"));
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formName.trim()) {
      alert("Informe o nome do produto.");
      return;
    }

    try {
      setSubmitting(true);
      await storeService.saveProduct({
        id: editingProduct?.id,
        name: formName.trim(),
        category: formCategory,
        brand: formBrand.trim(),
        description: formDescription.trim(),
        price: parseFloat(formPrice.replace(",", ".")) || 0,
        promoPrice: formPromoPrice ? (parseFloat(formPromoPrice.replace(",", ".")) || null) : null,
        stock: parseInt(formStock, 10) || 0,
        images: formImages,
        isHighlight: formIsHighlight,
        isBestSeller: formIsBestSeller,
        isNew: formIsNew,
        isPromotion: formIsPromotion,
        isUnavailable: formIsUnavailable,
        isActive: formIsActive,
        condition: formCondition,
        sku: formSku.trim(),
        weight: formWeight.trim(),
        linkedRaffleId: formLinkedRaffleId,
      });

      setShowModal(false);
    } catch (err: any) {
      alert("Erro ao salvar produto: " + (err.message || "Erro desconhecido"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (id: string, currentActive?: boolean) => {
    try {
      await storeService.toggleProductStatus(id, !currentActive);
    } catch (err: any) {
      alert("Erro ao alterar status: " + err.message);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await storeService.duplicateProduct(id);
    } catch (err: any) {
      alert("Erro ao duplicar produto: " + err.message);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Deseja realmente excluir o produto "${name}"?`)) {
      try {
        await storeService.deleteProduct(id);
      } catch (err: any) {
        alert("Erro ao excluir produto: " + err.message);
      }
    }
  };

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Status filter
      if (statusFilter === "ativos" && !p.isActive) return false;
      if (statusFilter === "inativos" && p.isActive) return false;

      // Category filter
      if (categoryFilter !== "todas" && p.category !== categoryFilter) return false;

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim();
        return (
          p.name.toLowerCase().includes(q) ||
          (p.brand || "").toLowerCase().includes(q) ||
          (p.category || "").toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [products, statusFilter, categoryFilter, searchTerm]);

  return (
    <div className="space-y-6">
      
      {/* HEADER & ACTION BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-zinc-950 border border-zinc-900 rounded-[2rem] p-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#FFC247] flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5 text-[#FF8A00]" /> Módulo Loja Premium
            </span>

            {/* STATUS BADGE */}
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border ${
                storeConfig.isEnabled
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                  : "bg-red-500/10 text-red-400 border-red-500/30"
              }`}
            >
              <Power className="w-3 h-3" />
              {storeConfig.isEnabled ? "Loja Ativa (Visível no Site)" : "Loja Desativada (Oculta dos Clientes)"}
            </span>
          </div>

          <h2 className="text-2xl font-black uppercase tracking-tight text-white mt-1">
            Gestão de Equipamentos
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            Cadastre, edite e gerencie o catálogo de produtos de pesca e camping.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* ATIVAR / DESATIVAR LOJA BUTTON */}
          <button
            onClick={handleToggleStoreActivation}
            disabled={togglingStore}
            className={`px-5 py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 cursor-pointer shadow-lg active:scale-98 font-montserrat ${
              storeConfig.isEnabled
                ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50"
                : "bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20"
            }`}
          >
            {togglingStore ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Power className="w-4 h-4" />
            )}
            <span>{storeConfig.isEnabled ? "Desativar Loja" : "Ativar Loja"}</span>
          </button>

          <button
            onClick={handleOpenCreateModal}
            className="px-6 py-3.5 bg-gradient-to-r from-[#FF8A00] to-[#FF6200] hover:from-[#FFA333] hover:to-[#FF731A] text-[#070709] rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-[#FF8A00]/20 flex items-center gap-2 cursor-pointer transition-all transform active:scale-98 font-montserrat"
          >
            <PlusCircle className="w-4.5 h-4.5" />
            Adicionar Produto
          </button>
        </div>
      </div>

      {/* FILTERS BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-zinc-950/60 border border-zinc-900 rounded-2xl p-3.5">
        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Buscar por produto ou marca..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-black/80 border border-zinc-800 rounded-xl pl-10 pr-3 py-2 text-xs text-white outline-none focus:border-[#FF8A00] transition-all"
          />
        </div>

        {/* Category */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="bg-black/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-[#FF8A00] transition-all"
        >
          <option value="todas">Todas as Categorias</option>
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        {/* Status */}
        <div className="flex items-center gap-1 bg-black/80 border border-zinc-800 rounded-xl p-1">
          <button
            onClick={() => setStatusFilter("todos")}
            className={`flex-1 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${
              statusFilter === "todos" ? "bg-zinc-800 text-white" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Todos ({products.length})
          </button>
          <button
            onClick={() => setStatusFilter("ativos")}
            className={`flex-1 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${
              statusFilter === "ativos" ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Ativos
          </button>
          <button
            onClick={() => setStatusFilter("inativos")}
            className={`flex-1 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${
              statusFilter === "inativos" ? "bg-red-500/20 text-red-400" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Inativos
          </button>
        </div>
      </div>

      {/* PRODUCTS TABLE / CARDS */}
      {loading ? (
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-[#FF8A00] animate-spin mx-auto" />
          <p className="text-xs text-zinc-500 font-bold uppercase tracking-widest mt-4">
            Carregando produtos...
          </p>
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="p-12 bg-zinc-950 border border-zinc-900 rounded-3xl text-center space-y-3">
          <Package className="w-10 h-10 text-zinc-600 mx-auto" />
          <h3 className="text-base font-black uppercase text-white">Nenhum produto cadastrado</h3>
          <p className="text-xs text-zinc-500">
            Clique no botão acima para cadastrar seu primeiro equipamento.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((prod) => {
            const img =
              prod.images && prod.images.length > 0
                ? prod.images[0]
                : "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80";

            return (
              <div
                key={prod.id}
                className={`bg-zinc-950 border rounded-2xl p-4 flex flex-col justify-between transition-all ${
                  prod.isActive ? "border-zinc-800 hover:border-[#FF8A00]/40" : "border-red-900/40 opacity-60"
                }`}
              >
                <div>
                  {/* MEDIA & STATUS */}
                  <div className="flex gap-3 mb-3">
                    <img
                      src={img}
                      alt={prod.name}
                      className="w-20 h-20 rounded-xl object-cover bg-black border border-zinc-800 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-black uppercase text-[#FFC247]">
                          {prod.category}
                        </span>
                        <button
                          onClick={() => handleToggleStatus(prod.id, prod.isActive)}
                          className={`px-2 py-0.5 rounded text-[9px] font-black uppercase flex items-center gap-1 ${
                            prod.isActive
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                              : "bg-red-500/10 text-red-400 border border-red-500/30"
                          }`}
                        >
                          <Power className="w-3 h-3" />
                          {prod.isActive ? "Ativo" : "Inativo"}
                        </button>
                      </div>

                      <h3 className="text-sm font-black text-white truncate mt-1">{prod.name}</h3>
                      {prod.brand && <p className="text-[11px] text-zinc-400 font-bold">{prod.brand}</p>}

                      <div className="flex items-baseline gap-2 mt-1.5">
                        <span className="text-sm font-black text-[#FFC247]">
                          {(prod.promoPrice && prod.promoPrice > 0 ? prod.promoPrice : prod.price).toLocaleString(
                            "pt-BR",
                            { style: "currency", currency: "BRL" }
                          )}
                        </span>
                        {prod.promoPrice && prod.promoPrice > 0 && (
                          <span className="text-[10px] text-zinc-500 line-through">
                            {prod.price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* INFO TAGS & STOCK */}
                  <div className="flex flex-wrap items-center gap-1.5 my-2">
                    <span className="text-[10px] px-2 py-0.5 bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold rounded">
                      Estoque: {prod.stock}
                    </span>
                    {prod.isHighlight && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/20 text-amber-300 font-black rounded uppercase">
                        Destaque
                      </span>
                    )}
                    {prod.isPromotion && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-orange-500/20 text-orange-300 font-black rounded uppercase">
                        Promoção
                      </span>
                    )}
                    {prod.linkedRaffleId && (
                      <span className="text-[9px] px-1.5 py-0.5 bg-[#FF8A00]/20 text-[#FFC247] font-black rounded uppercase flex items-center gap-0.5">
                        <Ticket className="w-2.5 h-2.5" /> Rifa Vinculada
                      </span>
                    )}
                  </div>
                </div>

                {/* ACTIONS */}
                <div className="pt-3 border-t border-zinc-900 flex items-center justify-between gap-2 mt-2">
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleOpenEditModal(prod)}
                      className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-bold border border-zinc-800 flex items-center gap-1 cursor-pointer"
                      title="Editar"
                    >
                      <Edit3 className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button
                      onClick={() => handleDuplicate(prod.id)}
                      className="p-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs font-bold border border-zinc-800 flex items-center gap-1 cursor-pointer"
                      title="Duplicar"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    onClick={() => handleDelete(prod.id, prod.name)}
                    className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg border border-red-500/20 cursor-pointer"
                    title="Excluir"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="relative w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl text-white overflow-hidden my-auto space-y-4">
            
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-base font-black uppercase text-white font-montserrat flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#FF8A00]" />
                {editingProduct ? "Editar Produto" : "Novo Produto - Loja Premium"}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 bg-zinc-900 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* NAME */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black uppercase text-zinc-300 mb-1">
                    Nome do Produto *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Carretilha Shimano Curado K 200HG"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#FF8A00]"
                  />
                </div>

                {/* CATEGORY */}
                <div>
                  <label className="block text-xs font-black uppercase text-zinc-300 mb-1">
                    Categoria *
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#FF8A00]"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* BRAND */}
                <div>
                  <label className="block text-xs font-black uppercase text-zinc-300 mb-1">
                    Marca / Fabricante
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Shimano, Daiwa, Marine Sports"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#FF8A00]"
                  />
                </div>

                {/* PRICE */}
                <div>
                  <label className="block text-xs font-black uppercase text-zinc-300 mb-1">
                    Preço Original (R$) *
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 1290.00"
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    required
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#FF8A00]"
                  />
                </div>

                {/* PROMO PRICE */}
                <div>
                  <label className="block text-xs font-black uppercase text-zinc-300 mb-1">
                    Preço Promocional (R$) (Opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: 1099.00"
                    value={formPromoPrice}
                    onChange={(e) => setFormPromoPrice(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#FF8A00]"
                  />
                </div>

                {/* STOCK */}
                <div>
                  <label className="block text-xs font-black uppercase text-zinc-300 mb-1">
                    Estoque Disponível *
                  </label>
                  <input
                    type="number"
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    required
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#FF8A00]"
                  />
                </div>

                {/* SKU */}
                <div>
                  <label className="block text-xs font-black uppercase text-zinc-300 mb-1">
                    Código SKU
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: SHI-CUR200"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#FF8A00]"
                  />
                </div>

                {/* DESCRIPTION */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black uppercase text-zinc-300 mb-1">
                    Descrição Detalhada
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Especifique características técnicas, drag, passadores, etc."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-[#FF8A00]"
                  />
                </div>

                {/* LINKED RAFFLE */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-black uppercase text-zinc-300 mb-1">
                    Vincular a uma Rifa Ativa (Opcional)
                  </label>
                  <select
                    value={formLinkedRaffleId}
                    onChange={(e) => setFormLinkedRaffleId(e.target.value)}
                    className="w-full bg-black border border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:border-[#FF8A00]"
                  >
                    <option value="">Nenhuma Rifa Vinculada</option>
                    {raffles &&
                      raffles.map((r) => (
                        <option key={r.id} value={r.id}>
                          🎟 {r.title} (ID: {r.id})
                        </option>
                      ))}
                  </select>
                </div>

                {/* IMAGES MANAGEMENT */}
                <div className="sm:col-span-2 space-y-2 border-t border-zinc-800/80 pt-3">
                  <label className="block text-xs font-black uppercase text-zinc-300">
                    Fotos do Produto
                  </label>

                  <div className="flex gap-2">
                    <input
                      type="url"
                      placeholder="Cole a URL da imagem da foto..."
                      value={formNewImageUrl}
                      onChange={(e) => setFormNewImageUrl(e.target.value)}
                      className="flex-1 bg-black border border-zinc-800 rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleAddImageUrl}
                      className="px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl text-xs font-bold shrink-0"
                    >
                      Adicionar URL
                    </button>

                    <label className="px-3 py-2 bg-[#FF8A00] hover:bg-[#FF9C1A] text-[#070709] font-black rounded-xl text-xs flex items-center gap-1 cursor-pointer shrink-0 font-montserrat">
                      {uploadingImage ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Upload className="w-3.5 h-3.5" />
                      )}
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadImageFile}
                        disabled={uploadingImage}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {/* IMAGES PREVIEW LIST */}
                  {formImages.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-2">
                      {formImages.map((img, idx) => (
                        <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-zinc-800 group">
                          <img src={img} alt="" className="w-full h-full object-cover" />
                          <button
                            type="button"
                            onClick={() => handleRemoveImage(idx)}
                            className="absolute top-1 right-1 p-0.5 bg-red-600 text-white rounded-full opacity-80 hover:opacity-100"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* TOGGLES */}
                <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-2 border-t border-zinc-800/80 pt-3">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-300">
                    <input
                      type="checkbox"
                      checked={formIsHighlight}
                      onChange={(e) => setFormIsHighlight(e.target.checked)}
                      className="accent-[#FF8A00] w-4 h-4 rounded"
                    />
                    <span>Destaque</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-300">
                    <input
                      type="checkbox"
                      checked={formIsPromotion}
                      onChange={(e) => setFormIsPromotion(e.target.checked)}
                      className="accent-[#FF8A00] w-4 h-4 rounded"
                    />
                    <span>Promoção</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-300">
                    <input
                      type="checkbox"
                      checked={formIsNew}
                      onChange={(e) => setFormIsNew(e.target.checked)}
                      className="accent-[#FF8A00] w-4 h-4 rounded"
                    />
                    <span>Lançamento (Novo)</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-300">
                    <input
                      type="checkbox"
                      checked={formCondition === "usado"}
                      onChange={(e) => setFormCondition(e.target.checked ? "usado" : "novo")}
                      className="accent-[#FF8A00] w-4 h-4 rounded"
                    />
                    <span>Seminovo</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-300">
                    <input
                      type="checkbox"
                      checked={formIsBestSeller}
                      onChange={(e) => setFormIsBestSeller(e.target.checked)}
                      className="accent-[#FF8A00] w-4 h-4 rounded"
                    />
                    <span>Mais Vendido</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-zinc-300">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="accent-[#FF8A00] w-4 h-4 rounded"
                    />
                    <span>Ativo na Loja</span>
                  </label>
                </div>
              </div>

              {/* SUBMIT BUTTON */}
              <div className="pt-3 border-t border-zinc-800 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 font-bold text-xs uppercase rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#FF8A00] to-[#FF6200] text-[#070709] font-black text-xs uppercase rounded-xl font-montserrat flex items-center gap-2"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Salvar Produto</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
