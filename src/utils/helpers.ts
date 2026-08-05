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

