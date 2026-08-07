import {
  collection,
  doc,
  setDoc,
  addDoc,
  deleteDoc,
  updateDoc,
  getDocs,
  onSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";
import { Product } from "../types";

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
    name: "Carretilha Shimano Curado K 200HG",
    category: "Carretilhas",
    brand: "Shimano",
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
    sku: "SHI-CUR200HG",
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
      const colRef = collection(db, COLLECTION_NAME);
      const snap = await getDocs(colRef);
      if (snap.empty) {
        for (const prod of DEFAULT_PRODUCTS) {
          const { id, ...data } = prod;
          await setDoc(doc(db, COLLECTION_NAME, id), {
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }
    } catch (e) {
      console.warn("Error seeding initial products to Firestore:", e);
      this.setLocalProducts(DEFAULT_PRODUCTS);
    }
  }

  public async saveProduct(productData: Partial<Product>): Promise<string> {
    const isEdit = Boolean(productData.id);
    const id = productData.id || `prod_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const now = new Date().toISOString();
    const finalProduct = {
      adminToken: localStorage.getItem("raffle_admin_token") || localStorage.getItem("admin_token") || "",
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
      createdAt: productData.createdAt || now,
      updatedAt: now,
    };

    // Update local cache
    const current = this.getLocalProducts();
    const existingIndex = current.findIndex((p) => p.id === id);
    let updatedList: Product[];
    if (existingIndex >= 0) {
      updatedList = [...current];
      updatedList[existingIndex] = finalProduct;
    } else {
      updatedList = [finalProduct, ...current];
    }
    this.setLocalProducts(updatedList);

    // Sync to Firestore
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const { id: _, ...payload } = finalProduct;
      
      // Firestore does not allow undefined values
      const cleanPayload = Object.fromEntries(
        Object.entries(payload).filter(([_, v]) => v !== undefined)
      );
      
      await setDoc(docRef, cleanPayload, { merge: true });
    } catch (e) {
      console.warn("Error saving product to Firestore:", e);
    }

    return id;
  }

  public async deleteProduct(id: string): Promise<void> {
    const current = this.getLocalProducts();
    const updated = current.filter((p) => p.id !== id);
    this.setLocalProducts(updated);

    try {
      await deleteDoc(doc(db, COLLECTION_NAME, id));
    } catch (e) {
      console.warn("Error deleting product from Firestore:", e);
    }
  }

  public async toggleProductStatus(id: string, isActive: boolean): Promise<void> {
    const current = this.getLocalProducts();
    const updated = current.map((p) => (p.id === id ? { ...p, isActive } : p));
    this.setLocalProducts(updated);

    try {
      await updateDoc(doc(db, COLLECTION_NAME, id), {
        adminToken: localStorage.getItem("raffle_admin_token") || localStorage.getItem("admin_token") || "",
        isActive,
        updatedAt: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("Error toggling product status in Firestore:", e);
    }
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
    const newConfig: StoreConfig & { adminToken?: string } = {
      adminToken: localStorage.getItem("raffle_admin_token") || localStorage.getItem("admin_token") || "",
      isEnabled,
      updatedAt: new Date().toISOString(),
    };
    this.setLocalStoreConfig(newConfig);

    try {
      const docRef = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC_ID);
      await setDoc(docRef, newConfig, { merge: true });
    } catch (e) {
      console.warn("Error syncing store configuration to Firestore:", e);
    }
  }
}

export const storeService = new StoreService();
