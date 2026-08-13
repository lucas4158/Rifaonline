import { auth } from "../services/firebase";
import { OperationType, FirestoreErrorInfo } from "../types";

// Helper function to wrap a promise with a timeout
export const promiseWithTimeout = <T,>(
  promise: Promise<T>,
  ms: number,
  errorMsg = "Tempo limite excedido"
): Promise<T> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMsg)), ms);
    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
};

// Helper function to compress and resize images client-side before upload/Firestore reference
export const compressImage = (
  file: File,
  maxW = 1920,
  maxH = 1440,
  quality = 0.90
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        // --- 1. GENERATE HD BLOB FOR IMGBB CONVERSIONS ---
        const hdCanvas = document.createElement("canvas");
        let hdWidth = img.width;
        let hdHeight = img.height;

        // Downscale maintaining aspect ratio only if original exceeds HD bounds
        if (hdWidth > hdHeight) {
          if (hdWidth > maxW) {
            hdHeight = Math.round((hdHeight * maxW) / hdWidth);
            hdWidth = maxW;
          }
        } else {
          if (hdHeight > maxH) {
            hdWidth = Math.round((hdWidth * maxH) / hdHeight);
            hdHeight = maxH;
          }
        }

        hdCanvas.width = hdWidth;
        hdCanvas.height = hdHeight;
        const hdCtx = hdCanvas.getContext("2d");
        if (!hdCtx) {
          reject(new Error("Não foi possível obter o contexto 2D do Canvas principal."));
          return;
        }

        // Apply superior downscaling interpolation
        hdCtx.imageSmoothingEnabled = true;
        hdCtx.imageSmoothingQuality = "high";
        hdCtx.drawImage(img, 0, 0, hdWidth, hdHeight);

        // Convert the HD canvas to Blob (pristine/HD quality) for storage upload
        hdCanvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error("Erro ao converter HD canvas em blob."));
            }
          },
          "image/jpeg",
          quality
        );
      };
      img.onerror = () => reject(new Error("Erro ao carregar renderizador de imagem."));
      img.src = ev.target?.result as string;
    };
    reader.onerror = () => reject(new Error("Erro ao ler o arquivo de imagem."));
    reader.readAsDataURL(file);
  });
};

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const safeCopyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn("[Clipboard] Async clipboard write failed, attempting fallback:", err);
  }

  try {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.left = "-999999px";
    textArea.style.top = "-999999px";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand("copy");
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error("[Clipboard] Fallback copy failed:", err);
    return false;
  }
};

export const updateAppMetadata = (pathname: string = typeof window !== "undefined" ? window.location.pathname : "/") => {
  if (typeof window === "undefined") return;
  const isAdmin = pathname.startsWith("/admin");
  const title = isAdmin ? "RifaMaster Admin" : "RifaMaster";
  document.title = title;

  // Apple Mobile Web App Title
  let metaAppleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]');
  if (!metaAppleTitle) {
    metaAppleTitle = document.createElement("meta");
    metaAppleTitle.setAttribute("name", "apple-mobile-web-app-title");
    document.head.appendChild(metaAppleTitle);
  }
  metaAppleTitle.setAttribute("content", title);

  // Open Graph Title
  let metaOgTitle = document.querySelector('meta[property="og:title"]');
  if (metaOgTitle) {
    metaOgTitle.setAttribute("content", title);
  }

  // Favicon and Touch Icons
  const iconHref = isAdmin ? "/icon-maskable.png" : "/favicon.png";
  const appleIconHref = isAdmin ? "/icon-192.png" : "/apple-touch-icon.png";

  const favicons = document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"]');
  favicons.forEach((el) => {
    el.setAttribute("href", iconHref);
  });

  const appleIcons = document.querySelectorAll('link[rel="apple-touch-icon"]');
  appleIcons.forEach((el) => {
    el.setAttribute("href", appleIconHref);
  });
};

export interface RaffleStatsResult {
  paidNumbers: number;
  bonusNumbers: number;
  activeReservedNumbers: number;
  occupiedNumbers: number;
  availableNumbers: number;
  percentage: number;
  arrecadado: number;
  aEntrar: number;
}

export function calculateRaffleStats(
  raffle: {
    id?: string;
    totalNumbers?: number;
    soldCount?: number;
    price?: number;
    status?: string;
    winnerNumber?: string;
  },
  numbers: Array<{ id: string; status?: string; isBonus?: boolean }> = [],
  orders: Array<any> = [],
  selectedNumbersSet: Set<string> = new Set()
): RaffleStatsResult {
  const totalNumbers = Number(raffle.totalNumbers || 100);
  const price = Number(raffle.price || 10);
  const raffleId = raffle.id;

  const raffleOrders = raffleId
    ? orders.filter((o) => {
        const oRaffleId = String(o.raffleId || o.rifaId || "current");
        return oRaffleId === String(raffleId) || oRaffleId === "current" || !o.raffleId;
      })
    : orders;

  const paidOrders = raffleOrders.filter((o) => {
    const s = String(o.status || "").toLowerCase().trim();
    return (
      s === "pago" ||
      s === "paid" ||
      s === "approved" ||
      s === "aprovado" ||
      s === "confirmed" ||
      s === "paga" ||
      s === "pagas" ||
      s === "concluido" ||
      s === "concluído"
    );
  });

  const arrecadado = paidOrders.reduce((acc, curr) => {
    const raw = Number(curr.val || curr.amount || curr.total || curr.totalValue || 0);
    if (raw > 0) return acc + raw;
    const numCount = (Array.isArray(curr.nums) ? curr.nums : (Array.isArray(curr.purchasedNums) ? curr.purchasedNums : (Array.isArray(curr.numbers) ? curr.numbers : []))).length || 1;
    return acc + (numCount * price);
  }, 0);

  const pendingOrders = raffleOrders.filter((o) => {
    const s = String(o.status || "").toLowerCase().trim();
    return s === "aguardando" || s === "pending_payment" || s === "reserved" || s === "pendente";
  });

  const aEntrar = pendingOrders.reduce((acc, curr) => {
    const raw = Number(curr.val || curr.amount || curr.total || curr.totalValue || 0);
    if (raw > 0) return acc + raw;
    const numCount = (Array.isArray(curr.nums) ? curr.nums : (Array.isArray(curr.purchasedNums) ? curr.purchasedNums : (Array.isArray(curr.numbers) ? curr.numbers : []))).length || 1;
    return acc + (numCount * price);
  }, 0);

  const paidFromNumbers = numbers.filter(
    (n) => (n.status === "paid" || n.status === "bonus_paid") && !n.isBonus
  ).length;
  const paidFromOrders = paidOrders.reduce((acc, o) => {
    const bonusList = Array.isArray(o.bonusNums) ? o.bonusNums : [];
    const purchasedList = Array.isArray(o.purchasedNums)
      ? o.purchasedNums
      : (Array.isArray(o.nums) ? o.nums.filter((n: string) => !bonusList.includes(n)) : (Array.isArray(o.numbers) ? o.numbers.filter((n: string) => !bonusList.includes(n)) : []));
    return acc + purchasedList.length;
  }, 0);

  const soldCountDoc = Number(raffle.soldCount || 0);
  const paidNumbers = Math.min(totalNumbers, Math.max(soldCountDoc, paidFromNumbers, paidFromOrders));

  const bonusFromNumbers = numbers.filter(
    (n) => (n.status === "paid" || n.status === "bonus_paid") && n.isBonus
  ).length;
  const bonusFromOrders = paidOrders.reduce((acc, o) => {
    const bonusList = Array.isArray(o.bonusNums) ? o.bonusNums : [];
    return acc + bonusList.length;
  }, 0);
  const bonusNumbers = Math.max(bonusFromNumbers, bonusFromOrders);

  const reservedFromNumbers = numbers.filter(
    (n) =>
      n.status === "reserved" ||
      n.status === "bonus_reserved" ||
      n.status === "pending_payment" ||
      selectedNumbersSet.has(n.id)
  ).length;
  const reservedFromOrders = pendingOrders.reduce((acc, o) => {
    const numList = Array.isArray(o.nums)
      ? o.nums
      : (Array.isArray(o.purchasedNums) ? o.purchasedNums : (Array.isArray(o.numbers) ? o.numbers : []));
    return acc + numList.length;
  }, 0);
  const activeReservedNumbers = Math.max(reservedFromNumbers, reservedFromOrders, selectedNumbersSet.size);

  const occupiedNumbers = Math.min(totalNumbers, paidNumbers + bonusNumbers + activeReservedNumbers);
  const availableNumbers = Math.max(0, totalNumbers - occupiedNumbers);

  let percentage = 0;
  if (raffle.status === "encerrada" || Boolean(raffle.winnerNumber)) {
    percentage = 100;
  } else {
    percentage = totalNumbers > 0 ? Math.min(100, (occupiedNumbers / totalNumbers) * 100) : 0;
  }

  return {
    paidNumbers,
    bonusNumbers,
    activeReservedNumbers,
    occupiedNumbers,
    availableNumbers,
    percentage,
    arrecadado,
    aEntrar,
  };
}


