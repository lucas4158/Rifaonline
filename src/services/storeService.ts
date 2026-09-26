import {
  collection,
  doc,
  onSnapshot,
} from "firebase/firestore";
import { db, auth } from "./firebase";
import { Product } from "../types";
import { adminService } from "./adminService";

export interface StoreConfig {
  isEnabled: boolean;
  isInitialized?: boolean;
  updatedAt?: string;
}

const COLLECTION_NAME = "store_products";
const SETTINGS_COLLECTION = "store_settings";
const SETTINGS_DOC_ID = "config";
const LOCAL_STORAGE_KEY = "rifamaster_store_products";
const LOCAL_STORAGE_CONFIG_KEY = "rifamaster_store_config";
const LOCAL_STORAGE_INIT_KEY = "rifamaster_store_initialized";

// Default seed products for initial showcase
export const DEFAULT_PRODUCTS: Product[] = [
  {
    id: "prod-1",
    name: "Carretilha Pro Carbon 200HG",
    category: "Carretilhas",
    brand: "Pro Fishing",
    description: "Carretilha de alta performance com drag carbon cross, sistema MicroModule Gear e SVS Infinity para arremessos ultra precisos.",
    price: 1290.0,
    promoPrice: 1099.0,
    stock: 8,
    images: [
      "https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80",
    ],
    isHighlight: true,
    isBestSeller: true,
    isNew: false,
    isPromotion: true,
    isUnavailable: false,
    isActive: true,
    sku: "PRO-CAR200HG",
    weight: "215g",
  },
  {
    id: "prod-2",
    name: "Molinete Daiwa BG 4000 Heavy Duty",
    category: "Molinetes",
    brand: "Daiwa",
    description: "Corpo em alumínio usinado anodizado rígido, engrenagens Digigear e carretel ABS de grande capacidade para grandes peixes.",
    price: 890.0,
    promoPrice: 799.0,
    stock: 5,
    images: [
      "https://images.unsplash.com/photo-1517649763962-0c623266010b?auto=format&fit=crop&w=800&q=80",
    ],
    isHighlight: true,
    isBestSeller: true,
    isNew: true,
    isPromotion: true,
    isUnavailable: false,
    isActive: true,
    sku: "DAI-BG4000",
    weight: "400g",
  },
  {
    id: "prod-3",
    name: "Vara Marine Sports Venator SE 17lbs 5'6\"",
    category: "Varas",
    brand: "Marine Sports",
    description: "Vara assinada por Nelson Nakamura. Blank de carbono IM10, passadores Fuji K-Guide e cabo ergonômico em EVA de alta densidade.",
    price: 650.0,
    stock: 12,
    images: [
      "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=800&q=80",
    ],
    isHighlight: true,
    isBestSeller: false,
    isNew: true,
    isPromotion: false,
    isUnavailable: false,
    isActive: true,
    sku: "MS-VEN5617",
    weight: "110g",
  },
  {
    id: "prod-4",
    name: "Linha Multifilamento YGK G-Soul X8 0.28mm 40lb",
    category: "Linhas",
    brand: "YGK",
    description: "Linha multifilamento 8 fios fabricada no Japão. Altíssima resistência à tração, maciez extrema e zero absorção de água.",
    price: 240.0,
    promoPrice: 199.0,
    stock: 25,
    images: [
      "https://images.unsplash.com/photo-1534447677768-be436bb09401?auto=format&fit=crop&w=800&q=80",
    ],
    isHighlight: false,
    isBestSeller: true,
    isNew: false,
    isPromotion: true,
    isUnavailable: false,
    isActive: true,
    sku: "YGK-X8-300M",
    weight: "150g",
  },
  {
    id: "prod-5",
    name: "Isca Artificial Nelson Nakamura Zig Zarinha 90",
    category: "Iscas",
    brand: "Lucky Moldes",
    description: "Isca de superfície com trabalho de 'Zigue-Zague' irresistível para Tucunarés, Robalos e Traíras.",
    price: 58.0,
    stock: 40,
    images: [
      "https://images.unsplash.com/photo-1520690214124-2405c5217036?auto=format&fit=crop&w=800&q=80",
    ],
    isHighlight: false,
    isBestSeller: true,
    isNew: false,
    isPromotion: false,
    isUnavailable: false,
    isActive: true,
    sku: "NN-ZIG90",
    weight: "12g",
  },
  {
    id: "prod-6",
    name: "Barraca Camping Coleman WeatherTec 4 Pessoas",
    category: "Camping",
    brand: "Coleman",
    description: "Estrutura impermeável patenteada WeatherTec. Montagem rápida em menos de 10 minutos e proteção UV contra elementos.",
    price: 980.0,
    promoPrice: 849.0,
    stock: 3,
    images: [
      "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?auto=format&fit=crop&w=800&q=80",
    ],
    isHighlight: true,
    isBestSeller: false,
    isNew: false,
    isPromotion: true,
    isUnavailable: false,
    isActive: true,
    sku: "COL-WT4P",
    weight: "4.8kg",
  },
];

class StoreService {
  private isStoreInitialized(): boolean {
    try {
      return localStorage.getItem(LOCAL_STORAGE_INIT_KEY) === "true";
    } catch {
      return false;
    }
  }

  private setStoreInitialized(initialized = true) {
    try {
      localStorage.setItem(LOCAL_STORAGE_INIT_KEY, initialized ? "true" : "false");
    } catch (e) {
      console.warn("Failed saving store initialized state:", e);
    }
  }

  private getLocalProducts(): Product[] {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored !== null) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed to load local store products:", e);
    }
    return [];
  }

  private setLocalProducts(products: Product[]) {
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(products));
      this.setStoreInitialized(true);
    } catch (e) {
      console.warn("Failed to save local store products:", e);
    }
  }

  public subscribeProducts(onUpdate: (products: Product[]) => void) {
    try {
      const colRef = collection(db, COLLECTION_NAME);
      return onSnapshot(
        colRef,
        (snapshot) => {
          if (snapshot.empty) {
            this.setStoreInitialized(true);
            this.setLocalProducts([]);
            onUpdate([]);
            return;
          }

          const products: Product[] = [];
          snapshot.forEach((docSnap) => {
            products.push({
              id: docSnap.id,
              ...docSnap.data(),
            } as Product);
          });

          // Mark as initialized and save copy locally
          this.setStoreInitialized(true);
          this.setLocalProducts(products);
          onUpdate(products);
        },
        (error) => {
          console.warn("Firestore store_products subscription fallback to local:", error);
          onUpdate(this.getLocalProducts());
        }
      );
    } catch (err) {
      console.warn("Error setting up store_products listener:", err);
      onUpdate(this.getLocalProducts());
      return () => {};
    }
  }

  public async seedInitialProducts() {
    if (this.isStoreInitialized()) return;
    try {
      this.setStoreInitialized(true);
      const token = auth.currentUser ? await auth.currentUser.getIdToken() : (localStorage.getItem("raffle_admin_token") || "");
      if (token) {
        for (const prod of DEFAULT_PRODUCTS) {
          await adminService.saveProduct(token, prod);
        }
      }
    } catch (e) {
      console.warn("Error seeding initial products:", e);
      this.setLocalProducts(DEFAULT_PRODUCTS);
    }
  }

  public async saveProduct(productData: Partial<Product>): Promise<string> {
    const id = productData.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const cleanProduct: Product = {
      id,
      name: productData.name?.trim() || "Produto sem nome",
      category: productData.category || "Carretilhas",
      brand: productData.brand?.trim() || "",
      description: productData.description?.trim() || "",
      price: Number(productData.price) || 0,
      promoPrice: productData.promoPrice ? Number(productData.promoPrice) : null,
      stock: Number(productData.stock) ?? 1,
      images: Array.isArray(productData.images) && productData.images.length > 0
        ? productData.images
        : ["https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&w=800&q=80"],
      isHighlight: Boolean(productData.isHighlight),
      isBestSeller: Boolean(productData.isBestSeller),
      isNew: Boolean(productData.isNew),
      isPromotion: Boolean(productData.isPromotion),
      isUnavailable: Boolean(productData.isUnavailable),
      isActive: productData.isActive !== undefined ? productData.isActive : true,
      condition: productData.condition || "novo",
      sku: productData.sku?.trim() || "",
      weight: productData.weight?.trim() || "",
      linkedRaffleId: productData.linkedRaffleId || "",
      isAffiliate: Boolean(productData.isAffiliate),
      affiliateLink: productData.affiliateLink?.trim() || "",
      createdAt: productData.createdAt || now,
      updatedAt: now,
    };

    // Obtain authenticated admin token from Firebase Auth or fallback
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : (localStorage.getItem("raffle_admin_token") || "");
    if (!token) {
      throw new Error("Não autorizado: Faça login no painel para salvar produtos.");
    }

    // Persist via server Admin SDK action
    const serverResult = await adminService.saveProduct(token, cleanProduct);
    const persisted = serverResult?.product || cleanProduct;

    // Only update local cache after confirmed server write
    const current = this.getLocalProducts();
    const existingIndex = current.findIndex((p) => p.id === id);
    let updatedList: Product[];
    if (existingIndex >= 0) {
      updatedList = [...current];
      updatedList[existingIndex] = persisted;
    } else {
      updatedList = [persisted, ...current];
    }
    this.setLocalProducts(updatedList);

    return id;
  }

  public async deleteProduct(id: string): Promise<void> {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : (localStorage.getItem("raffle_admin_token") || "");
    if (!token) {
      throw new Error("Não autorizado: Faça login no painel para excluir produtos.");
    }

    // Persist deletion on server via Admin SDK
    await adminService.deleteProduct(token, id);

    // Update local cache after server confirmation
    const current = this.getLocalProducts();
    const updated = current.filter((p) => p.id !== id);
    this.setLocalProducts(updated);
  }

  public async toggleProductStatus(id: string, isActive: boolean): Promise<void> {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : (localStorage.getItem("raffle_admin_token") || "");
    if (!token) {
      throw new Error("Não autorizado: Faça login no painel para alterar status.");
    }

    // Persist status toggle on server via Admin SDK
    await adminService.toggleProductStatus(token, id, isActive);

    // Update local cache after server confirmation
    const current = this.getLocalProducts();
    const updated = current.map((p) => (p.id === id ? { ...p, isActive } : p));
    this.setLocalProducts(updated);
  }

  public async duplicateProduct(id: string): Promise<string> {
    const current = this.getLocalProducts();
    const original = current.find((p) => p.id === id);
    if (!original) {
      throw new Error("Produto não encontrado para duplicação.");
    }

    const newProduct: Partial<Product> = {
      ...original,
      id: undefined,
      name: `${original.name} (Cópia)`,
      sku: original.sku ? `${original.sku}-COPY` : "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return await this.saveProduct(newProduct);
  }

  // Store Enable/Disable Configuration Management
  public getLocalStoreConfig(): StoreConfig {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_CONFIG_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Failed loading local store config:", e);
    }
    // DEFAULT IS DISABLED
    return { isEnabled: false };
  }

  public setLocalStoreConfig(config: StoreConfig) {
    try {
      localStorage.setItem(LOCAL_STORAGE_CONFIG_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn("Failed saving local store config:", e);
    }
  }

  public subscribeStoreConfig(onUpdate: (config: StoreConfig) => void) {
    try {
      const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
      return onSnapshot(
        docRef,
        (docSnap) => {
          let config: StoreConfig = { isEnabled: false };
          if (docSnap.exists()) {
            config = { isEnabled: false, ...docSnap.data() } as StoreConfig;
          }
          this.setLocalStoreConfig(config);
          onUpdate(config);
        },
        (error) => {
          console.warn("Firestore store_settings listener fallback to local:", error);
          onUpdate(this.getLocalStoreConfig());
        }
      );
    } catch (err) {
      console.warn("Error setting up store_settings listener:", err);
      onUpdate(this.getLocalStoreConfig());
      return () => {};
    }
  }

  public async setStoreEnabled(isEnabled: boolean): Promise<void> {
    const token = auth.currentUser ? await auth.currentUser.getIdToken() : (localStorage.getItem("raffle_admin_token") || "");
    if (!token) {
      throw new Error("Não autorizado: Faça login no painel para alterar configuração da loja.");
    }

    // Persist store configuration via Admin SDK action
    await adminService.setStoreEnabled(token, isEnabled);

    // Update local cache after server confirmation
    const newConfig: StoreConfig = {
      isEnabled,
      updatedAt: new Date().toISOString(),
    };
    this.setLocalStoreConfig(newConfig);
  }
}

export const storeService = new StoreService();

// ============================================================================
// BUY REDIRECTION & DESTINATION DECISION HELPERS (CENTRALIZED LOGIC)
// ============================================================================

export type ProductBuyDestination = "mercadolivre" | "whatsapp" | "invalid_affiliate";

export interface ProductBuyAction {
  destination: ProductBuyDestination;
  buttonLabel: string;
  targetUrl: string | null;
  canBuy: boolean;
  isAffiliate: boolean;
  errorMessage?: string;
  infoNotice?: string;
}

/**
 * Validates if a URL is an authorized HTTPS Mercado Livre/meli.la affiliate URL.
 * Strictly blocks non-HTTPS, javascript:, data:, and unauthorized domains to prevent SSRF and phishing.
 */
export function isValidMercadoLivreAffiliateUrl(url?: string | null): boolean {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();

  // Must strictly start with https://
  if (!trimmed.toLowerCase().startsWith("https://")) {
    return false;
  }

  try {
    const parsed = new URL(trimmed);

    // Protocol must strictly be https:
    if (parsed.protocol !== "https:") {
      return false;
    }

    const host = parsed.hostname.toLowerCase();

    // Whitelist official Mercado Livre / Mercado Libre domains and shortener
    // 1. Shortener: meli.la or subdomains
    if (host === "meli.la" || host.endsWith(".meli.la")) {
      return true;
    }

    // 2. Official Mercado Livre Brazil domains
    if (
      host === "mercadolivre.com.br" ||
      host.endsWith(".mercadolivre.com.br") ||
      host === "mercadolivre.com" ||
      host.endsWith(".mercadolivre.com")
    ) {
      return true;
    }

    // 3. Official Mercado Libre domains (international / regional)
    if (
      host === "mercadolibre.com" ||
      host.endsWith(".mercadolibre.com") ||
      /^([a-z0-9-]+\.)?mercadoli[bv]re\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host)
    ) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

/**
 * Generates the canonical URL for a product in Loja Premium.
 */
export function getProductCanonicalUrl(productId: string): string {
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return `${window.location.origin}/loja?produto=${encodeURIComponent(productId)}`;
  }
  return `/loja?produto=${encodeURIComponent(productId)}`;
}

/**
 * Builds the WhatsApp buy URL with the pre-filled message required for own products:
 *
 * “Olá! Tenho interesse neste produto da Loja Premium do RifaMaster:
 *
 * Produto: [nome]
 * Preço: R$ [valor]
 * Link: [endereço do produto]
 *
 * Gostaria de saber como comprar.”
 */
export function buildWhatsAppBuyUrl(product: Product, adminPhone?: string): string {
  const cleanPhone = (adminPhone || "").replace(/\D/g, "");
  if (!cleanPhone) {
    return "";
  }

  const activePrice =
    product.promoPrice && product.promoPrice > 0 ? product.promoPrice : product.price;
  const formattedPrice = activePrice.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

  const productUrl = getProductCanonicalUrl(product.id);

  const message = [
    "Olá! Tenho interesse neste produto da Loja Premium do RifaMaster:",
    "",
    `Produto: ${product.name}`,
    `Preço: ${formattedPrice}`,
    `Link: ${productUrl}`,
    "",
    "Gostaria de saber como comprar.",
  ].join("\n");

  return `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Centralized decision function for product buy action.
 * Determines whether a product is:
 * 1. An affiliate Mercado Livre product -> "Comprar no Mercado Livre" (opens affiliate link directly)
 * 2. An affiliate with an invalid link -> "Link Indisponível" (disabled, never forwards to WhatsApp)
 * 3. An own/WhatsApp product -> "Comprar pelo WhatsApp" (opens admin WhatsApp with prefilled message)
 */
export function getProductBuyAction(product: Product, adminPhone?: string): ProductBuyAction {
  if (product.isAffiliate) {
    const rawLink = product.affiliateLink?.trim() || "";
    const isValid = isValidMercadoLivreAffiliateUrl(rawLink);

    if (!isValid || !rawLink) {
      return {
        destination: "invalid_affiliate",
        buttonLabel: "Link Indisponível",
        targetUrl: null,
        canBuy: false,
        isAffiliate: true,
        errorMessage: "O link de afiliado do Mercado Livre deste produto está inválido ou indisponível.",
        infoNotice: "Produto de afiliado sem link válido configurado.",
      };
    }

    return {
      destination: "mercadolivre",
      buttonLabel: "Comprar no Mercado Livre",
      targetUrl: rawLink,
      canBuy: true,
      isAffiliate: true,
      infoNotice: "Venda, pagamento e entrega realizados pelo Mercado Livre.",
    };
  }

  // Own product or other origin
  const isOutOfStock = product.stock <= 0 || Boolean(product.isUnavailable);
  const cleanPhone = (adminPhone || "").replace(/\D/g, "");
  const whatsAppUrl = cleanPhone ? buildWhatsAppBuyUrl(product, cleanPhone) : "";

  return {
    destination: "whatsapp",
    buttonLabel: "Comprar pelo WhatsApp",
    targetUrl: whatsAppUrl || null,
    canBuy: !isOutOfStock && Boolean(whatsAppUrl),
    isAffiliate: false,
    errorMessage: isOutOfStock
      ? "Produto esgotado ou indisponível."
      : !whatsAppUrl
      ? "Telefone administrativo do WhatsApp não configurado no sistema."
      : undefined,
    infoNotice: "Atendimento direto com a equipe via WhatsApp.",
  };
}

/**
 * Centralized executor for product buy.
 * Performs the exact destination redirect based on the product type.
 */
export function executeProductBuy(product: Product, adminPhone?: string): boolean {
  const action = getProductBuyAction(product, adminPhone);

  if (action.destination === "invalid_affiliate") {
    alert(action.errorMessage || "Este produto é afiliado do Mercado Livre, mas o link de afiliado está inválido ou indisponível.");
    return false;
  }

  if (action.destination === "mercadolivre") {
    if (action.targetUrl) {
      window.open(action.targetUrl, "_blank", "noopener,noreferrer");
      return true;
    }
    alert("Link do Mercado Livre não encontrado.");
    return false;
  }

  // destination === "whatsapp"
  if (!action.canBuy) {
    alert(action.errorMessage || "Não foi possível iniciar o atendimento via WhatsApp.");
    return false;
  }

  if (action.targetUrl) {
    window.open(action.targetUrl, "_blank", "noopener,noreferrer");
    return true;
  }

  return false;
}

