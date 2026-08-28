import { safeFetch } from "../utils/helpers";

const fetch = safeFetch;

export const pixService = {
  async createPix(params: {
    name: string;
    phone: string;
    nums?: string[];
    numbers?: string[];
    price: number;
    sessionId: string;
    existingBonusNums?: string[];
    raffleId?: string;
  }): Promise<any> {
    const numsArr = params.nums || params.numbers || [];
    console.log(`[PIX_CREATED] Initiating client-side Pix order creation. RaffleId: ${params.raffleId || "current"}, Numbers: ${numsArr.join(", ")}, Price: ${params.price}`);
    try {
      const response = await fetch("/api/create-pix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: params.name,
          phone: params.phone,
          nums: numsArr,
          totalAmount: numsArr.length * params.price,
          price: params.price,
          sessionId: params.sessionId,
          existingBonusNums: params.existingBonusNums || [],
          raffleId: params.raffleId || "current",
        }),
      });

      let responseText = "";
      try {
        responseText = await response.text();
      } catch (e) {
        console.error("Error reading response text:", e);
      }

      let resData: any = {};
      if (responseText) {
        try {
          resData = JSON.parse(responseText);
        } catch (e) {
          console.error("Failed to parse JSON response from server:", responseText);
        }
      }

      if (!response.ok) {
        throw new Error(resData.error || resData.message || `Erro ao gerar PIX (${response.status})`);
      }

      return resData;
    } catch (err: any) {
      console.error("❌ [PixService CreatePix Error]:", err);
      throw err;
    }
  },

  async lockCota(params: {
    numbers?: string[];
    nums?: string[];
    numberId?: string;
    sessionId: string;
    action?: string;
    raffleId?: string;
  }): Promise<any> {
    try {
      const list = params.numbers || params.nums || (params.numberId ? [params.numberId] : []);
      const response = await fetch("/api/lock-cota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          numbers: list,
          nums: list,
          numberId: params.numberId,
          sessionId: params.sessionId,
          action: params.action || "lock",
          raffleId: params.raffleId || "current",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao bloquear cotas.");
      }
      return data;
    } catch (err: any) {
      console.error("❌ [PixService lockCota Error]:", err);
      throw err;
    }
  },

  async cancelOrder(orderIdOrParams: string | { orderId?: string; sessionId?: string; raffleId?: string }, raffleId?: string): Promise<any> {
    try {
      let orderId = "";
      let rId = raffleId || "current";
      if (typeof orderIdOrParams === "object" && orderIdOrParams !== null) {
        orderId = orderIdOrParams.orderId || "";
        rId = orderIdOrParams.raffleId || rId;
      } else if (typeof orderIdOrParams === "string") {
        orderId = orderIdOrParams;
      }

      const response = await fetch("/api/cancel-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, raffleId: rId }),
      });
      const data = await response.json();
      return data;
    } catch (err: any) {
      console.error("❌ [PixService cancelOrder Error]:", err);
      return { success: false, error: err.message };
    }
  },

  async checkPaymentStatus(orderId: string, raffleId?: string): Promise<any> {
    try {
      const response = await fetch(`/api/check-payment?orderId=${encodeURIComponent(orderId)}&raffleId=${encodeURIComponent(raffleId || "current")}`);
      const data = await response.json();
      return data;
    } catch (err: any) {
      console.error("❌ [PixService checkPaymentStatus Error]:", err);
      return { success: false, error: err.message };
    }
  },

  async checkPayment(params: { paymentId?: string; orderId?: string; raffleId?: string }): Promise<any> {
    const idToUse = params.orderId || params.paymentId || "";
    return this.checkPaymentStatus(idToUse, params.raffleId);
  }
};
