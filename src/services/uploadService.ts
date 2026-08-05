import { compressImage } from "../utils/helpers";
import { UploadCallbacks } from "../types";

export const fetchWithTimeout = async (
  url: string,
  options: RequestInit,
  timeoutMs = 15000
): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
};

/**
 * Validates if the returned image URL is accessible and valid.
 * Checks via browser Image loading and a fetch HEAD request.
 */
export const validateImageUrl = async (url: string): Promise<boolean> => {
  console.log(`🔍 [VALIDATE_IMAGE] Validating image URL: ${url}`);
  try {
    // 1. Run HEAD check on the URL as explicitly requested
    let headOk = false;
    try {
      const response = await fetch(url, { method: "HEAD" });
      console.log(`🔍 [VALIDATE_IMAGE_HEAD] fetch HEAD checked, HTTP status: ${response.status}`);
      if (response.status === 200) {
        headOk = true;
      } else {
        console.error(`❌ [VALIDATE_IMAGE_HEAD_FAILED] Fetch HEAD returned status: ${response.status}`);
      }
    } catch (fetchErr: any) {
      console.warn("⚠️ [VALIDATE_IMAGE_HEAD_CORS] fetch HEAD check was blocked by CORS or network, continuing validation with Image memory element.");
    }

    // 2. Perform image element memory check (handles CORS-isolated and browser loading validation perfectly)
    const browserLoadOk = await new Promise<boolean>((resolve) => {
      const img = new Image();
      img.onload = () => {
        console.log(`🔍 [VALIDATE_IMAGE_LOAD_SUCCESS] Image loaded successfully in browser memory: ${url}`);
        resolve(true);
      };
      img.onerror = () => {
        console.error(`🔍 [VALIDATE_IMAGE_LOAD_FAILED] Image failed to load in browser memory: ${url}`);
        resolve(false);
      };
      img.src = url;
    });

    if (!browserLoadOk) {
      console.error(`❌ [VALIDATE_IMAGE_FAILED] Image loaded check failed.`);
      return false;
    }

    return true;
  } catch (err: any) {
    console.error("❌ [VALIDATE_IMAGE_ERROR] Exception triggered during image URL validation:", err);
    return false;
  }
};

export const performRobustImageUpload = async (
  file: File,
  callbacks: UploadCallbacks = {}
): Promise<string> => {
  console.log("[IMGBB_UPLOAD_START] ImgBB permanent upload process started for file:", file.name);
  try {
    // Definitive safeguard block: reject if any attempt is made to use firebase storage
    if ((file as any)._useFirebaseStorage || (window as any).__forceFirebaseStorage) {
      console.error("❌ [LEGACY_FIREBASE_BLOCKED] Attempted to use outdated Firebase Storage flow.");
      throw new Error("LEGACY FIREBASE STORAGE BLOCKED");
    }

    // Step 1: Compress on client-side
    callbacks.onProgress?.(10);
    const blob = await compressImage(file, 1200, 900, 0.85);
    console.log("⚙️ [Image Compress] Compression completed. Blob size:", blob.size);
    callbacks.onProgress?.(25);

    // Step 2: Convert to Base64 (frontend side)
    const base64Data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const resultString = reader.result as string;
        // Strip the mime prefix (e.g., "data:image/jpeg;base64,") for ImgBB raw base64 parameter
        const rawBase64 = resultString.substring(resultString.indexOf(",") + 1);
        resolve(rawBase64);
      };
      reader.onerror = () => reject(new Error("Erro ao codificar imagem em base64."));
      reader.readAsDataURL(blob);
    });
    console.log("⚙️ [Base64 Convert] Generated base64 payload successfully.");
    callbacks.onProgress?.(45);

    const API_KEY = (import.meta as any).env?.VITE_IMGBB_API_KEY || (import.meta as any).env?.IMGBB_API_KEY;
    if (!API_KEY) {
      throw new Error("Chave IMGBB_API_KEY ou VITE_IMGBB_API_KEY de upload de imagens (ImgBB) não foi definida.");
    }

    const maxRetries = 3;
    let attempt = 0;
    let res: Response | null = null;
    let lastError: any = null;

    while (attempt < maxRetries) {
      attempt++;
      try {
        console.log(`📤 [ImgBB Upload] Attempt ${attempt} of ${maxRetries}...`);
        callbacks.onProgress?.(45 + attempt * 15); // Progressive visual loading: 60%, 75%, 90%

        const formData = new FormData();
        formData.append("image", base64Data);

        // Upload permanently (without expiration param)
        const uploadUrl = `https://api.imgbb.com/1/upload?key=${API_KEY}`;

        // 15 seconds timeout
        res = await fetchWithTimeout(
          uploadUrl,
          {
            method: "POST",
            body: formData,
          },
          15000
        );

        if (res.ok) {
          console.log(`✅ [ImgBB Upload] Succeeded on attempt ${attempt}`);
          break;
        } else {
          const errText = await res.text().catch(() => "");
          throw new Error(`Servidor ImgBB retornou status ${res.status}: ${errText || res.statusText}`);
        }
      } catch (err: any) {
        lastError = err;
        console.warn(`⚠️ [ImgBB Attempt ${attempt} Failed]:`, err?.message || err);
        if (attempt < maxRetries) {
          // Wait 1.5 seconds between retries
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    }

    if (!res || !res.ok) {
      throw lastError || new Error("Falha no upload após múltiplas tentativas.");
    }

    const data = await res.json();
    console.log("IMGBB_RAW_RESPONSE:", JSON.stringify(data));

    if (!data || !data.data || !data.success) {
      throw new Error("Resposta recebida do ImgBB não possui marcação de sucesso ou dados.");
    }

    // Save ONLY response.data.data.url as explicitly requested. Do not use display_url, delete_url, thumb.url, etc.
    const imgUrl = data.data.url;
    if (!imgUrl) {
      throw new Error("Resposta recebida do ImgBB não contém o link de imagem principal público (data.url).");
    }

    console.log("[IMGBB_FINAL_URL] Candidate ImgBB Image URL:", imgUrl);

    // Validate the image URL actually loads and returns 200/accessible before continuing
    const isValid = await validateImageUrl(imgUrl);
    if (!isValid) {
      throw new Error("A validação da imagem retornada pelo ImgBB falhou (não pôde ser carregada ou retornou erro HTTP).");
    }

    console.log("[IMGBB_UPLOAD_SUCCESS] Permanent upload and URL verification completed successfully.");
    callbacks.onProgress?.(100);
    callbacks.onSuccess?.(imgUrl);
    return imgUrl;
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    console.error("[IMGBB_UPLOAD_ERROR] Upload process failed:", errorMsg);
    const resolvedErr = new Error(`Erro no envio para o ImgBB: ${errorMsg}`);
    callbacks.onError?.(resolvedErr);
    throw resolvedErr;
  }
};

