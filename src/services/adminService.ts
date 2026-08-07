import { RaffleConfig } from "../types";
import { localStorage } from "../utils/storage";
import { auth } from "./firebase";

const getActiveToken = async (token: string): Promise<string> => {
  if (token && token.trim() !== "") return token;
  if (auth.currentUser) {
    try {
      return await auth.currentUser.getIdToken();
    } catch (e) {
      console.warn("Failed to get Firebase Auth ID token", e);
    }
  }
  if (typeof window !== "undefined") {
    return localStorage.getItem("admin_token") || localStorage.getItem("raffle_admin_token") || "";
  }
  return "";
};

const getActiveHeaders = async (token: string, contentType: string = "application/json"): Promise<Record<string, string>> => {
  const headers: Record<string, string> = {
    "Content-Type": contentType,
  };
  const activeToken = (await getActiveToken(token)).trim();
  if (activeToken) {
    if (/^[A-Za-z0-9\-_./+=]+$/.test(activeToken)) {
      headers["Authorization"] = `Bearer ${activeToken}`;
    } else {
      console.warn("⚠️ [SECURITY_WARN] activeToken in getActiveHeaders has non-ASCII or corrupt characters. Stripped to protect fetch call:", activeToken);
    }
  }
  return headers;
};

export const adminService = {
  async verifySession(token: string): Promise<boolean> {
    console.log("🍪 [COOKIE_SENT] verifySession starting. Transmitting cookie...");
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({ action: "verify" }),
        credentials: "include",
      });
      return res.ok;
    } catch (err) {
      console.error("Session verification error:", err);
      return false;
    }
  },

  async login(password: string): Promise<{ token: string } | { error: string }> {
    console.log("[ADMIN_ACTION_START] Action: login");
    console.log("🍪 [COOKIE_SENT] login starting. Transmitting credentials...");
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "login", password }),
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) {
        console.log("[ADMIN_ACTION_SUCCESS] Action: login successfully completed.");
        return { token: data.token };
      } else {
        console.warn("ADMIN_ACTION_ERROR: Falha ao autenticar admin:", data.error);
        return { error: data.error || "Senha incorreta!" };
      }
    } catch (err: any) {
      console.error("[ADMIN_ACTION_ERROR] Action: login failed:", err);
      return { error: err.message || "Erro ao autenticar." };
    }
  },

  async orderAction(
    token: string,
    orderId: string,
    action: "confirm" | "cancel" | "refund",
    raffleId?: string
  ): Promise<any> {
    console.log(`[ADMIN_ACTION_START] Action: order-action [${action}] orderId: ${orderId} raffleId: ${raffleId || "current"}`);
    console.log("🍪 [COOKIE_SENT] orderAction starting. Transmitting cookie...");
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({
          action: "order-action",
          orderId,
          statusAction: action,
          raffleId: raffleId || "current",
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao atualizar status da ordem.");
      }
      console.log(`[ADMIN_ACTION_SUCCESS] Action: order-action [${action}] completed for orderId: ${orderId}`);
      return data;
    } catch (err: any) {
      console.error(`[ADMIN_ACTION_ERROR] Action: order-action [${action}] failed:`, err);
      throw err;
    }
  },

  async manualApprovePayment(
    token: string,
    orderId: string,
    raffleId?: string
  ): Promise<any> {
    console.log(`[ADMIN_ACTION_START] Action: manual-approve-payment orderId: ${orderId} raffleId: ${raffleId || "current"}`);
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({
          action: "manual-approve-payment",
          orderId,
          raffleId: raffleId || "current",
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao aprovar pagamento manualmente.");
      }
      console.log(`[ADMIN_ACTION_SUCCESS] Action: manual-approve-payment completed for orderId: ${orderId}`);
      return data;
    } catch (err: any) {
      console.error(`[ADMIN_ACTION_ERROR] Action: manual-approve-payment failed:`, err);
      throw err;
    }
  },

  async deleteOrder(
    token: string,
    orderId: string
  ): Promise<any> {
    console.log(`[ADMIN_ACTION_START] Action: delete-order for orderId: ${orderId}`);
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({
          action: "delete-order",
          orderId,
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao excluir o pedido.");
      }
      console.log(`[ADMIN_ACTION_SUCCESS] Action: delete-order completed for orderId: ${orderId}`);
      return data;
    } catch (err: any) {
      console.error("[ADMIN_ACTION_ERROR] Action: delete-order failed:", err);
      throw err;
    }
  },

  async releaseCota(
    token: string,
    orderId: string,
    numberToRelease: string,
    raffleId?: string
  ): Promise<any> {
    console.log(`[ADMIN_ACTION_START] Action: release-cota number: ${numberToRelease} orderId: ${orderId} raffleId: ${raffleId || "current"}`);
    console.log("🍪 [COOKIE_SENT] releaseCota starting. Transmitting cookie...");
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({
          action: "release-cota",
          orderId,
          numberToRelease,
          raffleId: raffleId || "current",
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao liberar cota.");
      }
      console.log(`[ADMIN_ACTION_SUCCESS] Action: release-cota number: ${numberToRelease} completed for orderId: ${orderId}`);
      return data;
    } catch (err: any) {
      console.error("[ADMIN_ACTION_ERROR] Action: release-cota failed:", err);
      throw err;
    }
  },

  async clearRaffle(token: string, raffleId?: string): Promise<any> {
    console.log(`[ADMIN_ACTION_START] Action: reset for raffleId: ${raffleId || "current"}`);
    console.log("🍪 [COOKIE_SENT] clearRaffle starting. Transmitting cookie...");
    console.log("[RAFFLE_RESET_PAYLOAD] Sending request to reset/restart the raffle.");
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({ action: "reset", raffleId: raffleId || "current" }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("[RAFFLE_RESET_ERROR] Reset rejected on server side with error:", data.error);
        throw new Error(data.error || "Erro ao reiniciar rifa.");
      }
      console.log("[ADMIN_ACTION_SUCCESS] Action: reset successfully completed.");
      return data;
    } catch (err: any) {
      if (err.name === "SyntaxError" || err.message?.includes("pattern") || err.name?.includes("DOMException")) {
        console.error("[RAFFLE_RESET_ERROR] CRITICAL: Captured browser pattern/DOM Exception during reset:", {
          errorName: err.name,
          errorMessage: err.message,
          errorStack: err.stack,
          activeHeaders: await getActiveHeaders(token)
        });
        throw new Error(`Erro de Requisição de Reinício: "${err.message}".`);
      }
      console.error("[RAFFLE_RESET_ERROR] Action: reset failed:", err);
      throw err;
    }
  },

  async draw(token: string, raffleId?: string, winnerNumber?: string, drawMethod?: string, drawAudit?: any): Promise<any> {
    console.log(`[ADMIN_ACTION_START] Action: draw for raffleId: ${raffleId || "current"} with winnerNumber: ${winnerNumber || "none"}`);
    console.log("🍪 [COOKIE_SENT] draw starting. Transmitting cookie...");
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({ 
          action: "draw", 
          raffleId: raffleId || "current",
          winnerNumber: winnerNumber || undefined,
          drawMethod: drawMethod || undefined,
          drawAudit: drawAudit || undefined
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao realizar o sorteio.");
      }
      console.log("[ADMIN_ACTION_SUCCESS] Action: draw successfully completed.");
      return data;
    } catch (err: any) {
      console.error("[ADMIN_ACTION_ERROR] Action: draw failed:", err);
      throw err;
    }
  },

  async publishDraw(
    token: string,
    drawId: string,
    configToPublish: any,
    raffleId?: string
  ): Promise<any> {
    console.log(`[ADMIN_ACTION_START] Action: publish-draw for raffleId: ${raffleId || configToPublish?.id || "current"}`);
    console.log("🍪 [COOKIE_SENT] publishDraw starting. Transmitting cookie...");
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({
          action: "publish-draw",
          drawId,
          configToPublish,
          raffleId: raffleId || configToPublish?.id || "current",
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao publicar sorteio.");
      }
      console.log("[ADMIN_ACTION_SUCCESS] Action: publish-draw successfully completed.");
      return data;
    } catch (err: any) {
      console.error("[ADMIN_ACTION_ERROR] Action: publish-draw failed:", err);
      throw err;
    }
  },

  async importBackup(token: string, backupData: any): Promise<any> {
    console.log("[ADMIN_ACTION_START] Action: import-backup");
    console.log("🍪 [COOKIE_SENT] importBackup starting. Transmitting cookie...");
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({
          action: "import-backup",
          backup: backupData,
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao restaurar backup remoto.");
      }
      console.log("[ADMIN_ACTION_SUCCESS] Action: import-backup successfully completed.");
      return data;
    } catch (err: any) {
      console.error("[ADMIN_ACTION_ERROR] Action: import-backup failed:", err);
      throw err;
    }
  },

  async saveConfig(
    token: string,
    config: RaffleConfig,
    isActive?: boolean,
    raffleId?: string
  ): Promise<any> {
    console.log(`[ADMIN_ACTION_START] Action: save-config for raffleId: ${raffleId || config.id || "current"}`);
    console.log("🍪 [COOKIE_SENT] saveConfig starting. Transmitting cookie...");
    
    const configToSend = {
      ...config,
      id: raffleId || config.id || "current",
      isActive: isActive !== undefined ? isActive : config.isActive,
    };

    // Filter out and sanitize any calculator/planning related fields from payload
    const calculatorKeys = ["lucroDesejado", "custoPremio", "taxaMP", "profitGoal", "prizeCost", "feePercentage", "planningData", "simulationResults", "promotionSimulation"];
    const payloadKeys = Object.keys(configToSend);
    const containedCalculatorKeys = payloadKeys.filter(k => calculatorKeys.includes(k));

    console.log("[CONFIG_SAVE_PAYLOAD] Saving configurations payload keys:", payloadKeys);
    
    if (containedCalculatorKeys.length > 0) {
      console.warn(`🚨 [CONFIG_SAVE_PAYLOAD] WARNING: Calculator/planning fields [${containedCalculatorKeys.join(", ")}] are being sent in the save-config payload! Deleting them to isolate the calculator.`);
      containedCalculatorKeys.forEach(k => {
        delete (configToSend as any)[k];
      });
    }

    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({
          action: "save-config",
          config: configToSend,
          raffleId: raffleId || config.id || "current",
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        const errMessage = data.error || "Erro ao salvar configurações.";
        console.error("[CONFIG_SAVE_ERROR] Server validation/save failed:", errMessage);
        throw new Error(errMessage);
      }
      console.log("[ADMIN_ACTION_SUCCESS] Action: save-config successfully completed.");
      return configToSend;
    } catch (err: any) {
      console.error("[CONFIG_SAVE_ERROR] Action: save-config failed:", err);
      throw err;
    }
  },

  async updateGlobalPix(
    token: string,
    payload: { pixKey: string; pixReceiver: string; pixBank: string; pixPhone: string }
  ): Promise<any> {
    console.log("[ADMIN_ACTION_START] Action: update-global-pix");
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({
          action: "update-global-pix",
          ...payload,
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao atualizar PIX global.");
      }
      return data;
    } catch (err: any) {
      console.error("[ADMIN_ACTION_ERROR] Action: update-global-pix failed:", err);
      throw err;
    }
  },

  async toggleRaffleStatus(token: string, isRaffleActive: boolean, raffleId?: string): Promise<any> {
    console.log(`[ADMIN_ACTION_START] Action: toggle-raffle-status [${isRaffleActive}] for raffle ${raffleId || "current"}`);
    console.log("🍪 [COOKIE_SENT] toggleRaffleStatus starting. Transmitting cookie...");
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({
          action: "toggle-raffle-status",
          isRaffleActive,
          raffleId: raffleId || "current",
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao alternar status de ativação da rifa.");
      }
      console.log(`[ADMIN_ACTION_SUCCESS] Action: toggle-raffle-status [${isRaffleActive}] successfully completed.`);
      return data;
    } catch (err: any) {
      console.error("[ADMIN_ACTION_ERROR] Action: toggle-raffle-status failed:", err);
      throw err;
    }
  },

  async listRaffles(token: string): Promise<any> {
    console.log("[ADMIN_ACTION_START] Action: list-raffles");
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({ action: "list-raffles" }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao listar rifas.");
      return data.raffles || [];
    } catch (err: any) {
      console.error("[ADMIN_ACTION_ERROR] Action: list-raffles failed:", err);
      throw err;
    }
  },

  async createRaffle(token: string, config: Partial<RaffleConfig>): Promise<any> {
    console.log("[ADMIN_ACTION_START] Action: create-raffle");
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({ action: "create-raffle", config }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar nova rifa.");
      return data;
    } catch (err: any) {
      console.error("[ADMIN_ACTION_ERROR] Action: create-raffle failed:", err);
      throw err;
    }
  },

  async duplicateRaffle(token: string, sourceRaffleId: string): Promise<any> {
    console.log(`[ADMIN_ACTION_START] Action: duplicate-raffle source: ${sourceRaffleId}`);
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({ action: "duplicate-raffle", sourceRaffleId }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao duplicar rifa.");
      return data;
    } catch (err: any) {
      console.error("[ADMIN_ACTION_ERROR] Action: duplicate-raffle failed:", err);
      throw err;
    }
  },

  async archiveRaffle(token: string, raffleId: string): Promise<any> {
    console.log(`[ADMIN_ACTION_START] Action: archive-raffle ID: ${raffleId}`);
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({ action: "archive-raffle", raffleId }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao arquivar rifa.");
      return data;
    } catch (err: any) {
      console.error("[ADMIN_ACTION_ERROR] Action: archive-raffle failed:", err);
      throw err;
    }
  },

  async endRaffle(token: string, raffleId: string): Promise<any> {
    console.log(`[ADMIN_ACTION_START] Action: end-raffle ID: ${raffleId}`);
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({ action: "end-raffle", raffleId }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao encerrar rifa.");
      return data;
    } catch (err: any) {
      console.error("[ADMIN_ACTION_ERROR] Action: end-raffle failed:", err);
      throw err;
    }
  },

  async deleteRaffle(token: string, raffleId: string): Promise<any> {
    console.log(`[ADMIN_ACTION_START] Action: delete-raffle ID: ${raffleId}`);
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({ action: "delete-raffle", raffleId }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao excluir rifa.");
      return data;
    } catch (err: any) {
      console.error("[ADMIN_ACTION_ERROR] Action: delete-raffle failed:", err);
      throw err;
    }
  },

  async reallocateExpired(
    token: string,
    orderId: string,
    newNumbers: string[]
  ): Promise<any> {
    console.log(`[ADMIN_ACTION_START] Action: reallocate-expired orderId: ${orderId} newNumbers: ${newNumbers.join(", ")}`);
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({
          action: "reallocate-expired",
          orderId,
          newNumbers,
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao realocar cotas.");
      }
      return data;
    } catch (err: any) {
      console.error("[ADMIN_ACTION_ERROR] Action: reallocate-expired failed:", err);
      throw err;
    }
  },

  async refundExpired(
    token: string,
    orderId: string
  ): Promise<any> {
    console.log(`[ADMIN_ACTION_START] Action: refund-expired orderId: ${orderId}`);
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({
          action: "refund-expired",
          orderId,
        }),
        credentials: "include",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Erro ao reembolsar pagamento tardio.");
      }
      return data;
    } catch (err: any) {
      console.error("[ADMIN_ACTION_ERROR] Action: refund-expired failed:", err);
      throw err;
    }
  },

  async createManualDraw(token: string, payload: any): Promise<any> {
    console.log("[ADMIN_ACTION_START] Action: create-manual-draw");
    const res = await fetch("/api/admin-action", {
      method: "POST",
      headers: await getActiveHeaders(token),
      body: JSON.stringify({ action: "create-manual-draw", ...payload }),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao criar ganhador manual.");
    return data;
  },

  async updateManualDraw(token: string, payload: any): Promise<any> {
    console.log("[ADMIN_ACTION_START] Action: update-manual-draw");
    const res = await fetch("/api/admin-action", {
      method: "POST",
      headers: await getActiveHeaders(token),
      body: JSON.stringify({ action: "update-manual-draw", ...payload }),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao atualizar ganhador.");
    return data;
  },

  async deleteManualDraw(token: string, drawId: string): Promise<any> {
    console.log("[ADMIN_ACTION_START] Action: delete-manual-draw");
    const res = await fetch("/api/admin-action", {
      method: "POST",
      headers: await getActiveHeaders(token),
      body: JSON.stringify({ action: "delete-manual-draw", drawId }),
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Erro ao excluir ganhador.");
    return data;
  },

  async updateWinner(token: string, winnerId: string, data: any): Promise<any> {
    console.log(`[ADMIN_ACTION_START] Action: update-winner for ID: ${winnerId}`);
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({ action: "update-winner", winnerId, data }),
        credentials: "include",
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Erro ao atualizar ganhador.");
      return resData;
    } catch (err: any) {
      console.error("[ADMIN_ACTION_ERROR] Action: update-winner failed:", err);
      throw err;
    }
  },

  async addWinnerHistory(token: string, winnerData: any): Promise<any> {
    console.log(`[ADMIN_ACTION_START] Action: add-winner-history`);
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({ action: "add-winner-history", winnerData }),
        credentials: "include",
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Erro ao adicionar ganhador.");
      return resData;
    } catch (err: any) {
      console.error("[ADMIN_ACTION_ERROR] Action: add-winner-history failed:", err);
      throw err;
    }
  },

  async deleteWinnerHistory(token: string, winnerId: string): Promise<any> {
    console.log(`[ADMIN_ACTION_START] Action: delete-winner-history for ID: ${winnerId}`);
    try {
      const res = await fetch("/api/admin-action", {
        method: "POST",
        headers: await getActiveHeaders(token),
        body: JSON.stringify({ action: "delete-winner-history", winnerId }),
        credentials: "include",
      });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || "Erro ao excluir ganhador.");
      return resData;
    } catch (err: any) {
      console.error("[ADMIN_ACTION_ERROR] Action: delete-winner-history failed:", err);
      throw err;
    }
  },
};
