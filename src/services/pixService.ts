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
        const trimmed = responseText.trim();
        if (trimmed.startsWith("<") || trimmed.includes("<html") || trimmed.includes("<!doctype")) {
          throw new Error("O servidor está iniciando. Por favor, aguarde alguns instantes e tente novamente.");
        }
        try {
          resData = JSON.parse(responseText);
        } catch (e) {
          console.error("Failed to parse JSON response from server:", responseText.slice(0, 200));
        }
      }

      if (!response.ok) {
        throw new Error(resData.error || resData.message || `Erro ao gerar PIX (${response.status})`);
      }

      if (resData.orderId && resData.cancellationToken) {
        localStorage.setItem(`cancel_token_${resData.orderId}`, resData.cancellationToken);
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
    phone?: string;
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
          phone: params.phone,
        }),
      });
      let responseText = "";
      try {
        responseText = await response.text();
      } catch (readErr) {
        console.warn("Could not read lock-cota response text:", readErr);
      }
      let data: any = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch (parseErr) {
          console.warn("Non-JSON response from lock-cota:", responseText.slice(0, 100));
        }
      }
      if (!response.ok) {
        throw new Error(data.error || "Erro ao bloquear cotas.");
      }
      return data;
    } catch (err: any) {
      console.warn("⚠️ [PixService lockCota Warning]:", err?.message || err);
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

      if (!orderId) {
        return { success: false, error: "Missing orderId" };
      }

      const cancellationToken = localStorage.getItem(`cancel_token_${orderId}`) || "";

      const response = await fetch("/api/cancel-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, cancellationToken, raffleId: rId }),
      });
      let responseText = "";
      try {
        responseText = await response.text();
      } catch (readErr) {
        console.warn("Could not read cancel-order response text:", readErr);
      }
      let data: any = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch (parseErr) {
          console.warn("Non-JSON response from cancel-order:", responseText.slice(0, 100));
        }
      }
      return data;
    } catch (err: any) {
      console.warn("⚠️ [PixService cancelOrder Warning]:", err?.message || err);
      return { success: false, error: err?.message };
    }
  },

  async checkPaymentStatus(orderId?: string, paymentId?: string, raffleId?: string): Promise<any> {
    const cleanOrderId = String(orderId || "").trim();
    const cleanPaymentId = String(paymentId || "").trim();
    if (!cleanOrderId && !cleanPaymentId) {
      return { approved: false, status: "pending" };
    }

    try {
      const response = await fetch("/api/check-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: cleanOrderId || undefined,
          paymentId: cleanPaymentId || undefined,
          raffleId: raffleId || "current",
        }),
      });

      let responseText = "";
      try {
        responseText = await response.text();
      } catch (readErr) {
        console.warn("Could not read check-payment response text:", readErr);
      }

      let data: any = {};
      if (responseText) {
        try {
          data = JSON.parse(responseText);
        } catch (parseErr) {
          console.warn("Non-JSON response from check-payment:", responseText.slice(0, 100));
          return { approved: false, status: "pending" };
        }
      }

      if (!response.ok) {
        return { approved: false, status: "pending", error: data.error };
      }

      return data;
    } catch (err: any) {
      console.warn("⚠️ [PixService checkPaymentStatus Warning]:", err?.message || err);
      return { approved: false, status: "pending", error: err?.message };
    }
  },

  async checkPayment(params: { paymentId?: string; orderId?: string; raffleId?: string }): Promise<any> {
    return this.checkPaymentStatus(params?.orderId, params?.paymentId, params?.raffleId);
  }
};
