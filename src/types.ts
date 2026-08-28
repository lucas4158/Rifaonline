export type Status =
  | "available"
  | "paid"
  | "reserved"
  | "selected"
  | "pending_payment"
  | "expired"
  | "cancelled"
  | "bonus_reserved"
  | "bonus_paid";

export interface NumberItem {
  id: string;
  status: Status;
  isGhost?: boolean;
}

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export interface UploadCallbacks {
  onProgress?: (pct: number) => void;
  onSuccess?: (url: string) => void;
  onError?: (err: Error) => void;
}

export interface RaffleConfig {
  soldCount?: number;
  id?: string;
  slug?: string;
  title: string;
  description: string;
  price: number;
  totalNumbers: number;
  isActive: boolean;
  imageUrl: string;
  pixKey: string;
  pixReceiver: string;
  pixBank: string;
  pixPhone: string;
  winnerNumber: string;
  winnerName: string;
  isRaffleActive?: boolean;
  promotionEnabled?: boolean;
  promotionBuy?: number;
  promotionBonus?: number;
  lucroDesejado?: number;
  custoPremio?: number;
  taxaMP?: number;
  status?: "ativa" | "pausada" | "encerrada" | "arquivada" | "sorteada";
  drawDate?: string;
  drawTime?: string;
  whatsappGroupUrl?: string;
  purchaseMode?: "manual" | "aleatorio";
  paymentMode?: "automatic" | "manual";
  paymentGateway?: "pagbank" | "mercadopago" | "manual";
  drawMode?: "automatico" | "federal";
  federalConcurso?: string;
  federalData?: string;
  federalRegra?: string;
  pixKeyType?: string;
  pixBankLogo?: string;
  isDestaque?: boolean;
  isFeatured?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type ProductCategory =
  | "Carretilhas"
  | "Molinetes"
  | "Varas"
  | "Linhas"
  | "Iscas"
  | "Camping"
  | "Acessórios"
  | "Promoções"
  | "Seminovos";

export interface Product {
  id: string;
  name: string;
  category: ProductCategory | string;
  brand?: string;
  description: string;
  price: number;
  promoPrice?: number | null;
  stock: number;
  images: string[];
  isHighlight?: boolean;
  isBestSeller?: boolean;
  isNew?: boolean;
  isPromotion?: boolean;
  isUnavailable?: boolean;
  isActive?: boolean;
  condition?: "novo" | "usado";
  sku?: string;
  weight?: string;
  linkedRaffleId?: string;
  createdAt?: string;
  updatedAt?: string;
}
