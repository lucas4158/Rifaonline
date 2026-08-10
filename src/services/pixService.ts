export const pixService = {
  async createPix(params: {
    name: string;
    phone: string;
    nums: string[];
    price: number;
    sessionId: string;
    existingBonusNums?: string[];
    raffleId?: string;
  }): Promise<any> {
    console.log(`[PIX_CREATED] Initiating client-side Pix order creation. RaffleId: ${params.raffleId || "current"}, Numbers: ${params.nums.join(", ")}, Price: ${params.price}`);
    try {
      const response = await fetch("/api/create-pix", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: params.name,
          phone: params.phone,
          nums: params.nums,
          totalAmount: params.nums.length * params.price,
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
        const errorMsg = resData.error || resData.message || "Falha ao processar pagamento com o Mercado Pago. Tente novamente em instantes.";
        const error = new Error(errorMsg) as any;
        if (resData.conflicts) {
          error.conflicts = resData.conflicts;
        }
        throw error;
      }

      console.log(`[PIX_CREATED] Pix created successfully! orderId: ${resData.orderId}, paymentId: ${resData.paymentId || "simulated"}`);
      return resData;
    } catch (err: any) {
      console.error("Error creating Pix checkout:", err);
      throw err;
    }
  },

  async lockCota(params: {
    numberId?: string;
    numbers?: string[];
    sessionId: string;
    action: "lock" | "unlock";
    raffleId?: string;
    keepalive?: boolean;
  }): Promise<any> {
    const idsLog = params.numberId ? params.numberId : (params.numbers ? params.numbers.join(", ") : "");
    if (params.action === "lock") {
      console.log(`[LOCK_CREATED] Requesting lock for cota(s): ${idsLog} (Raffle: ${params.raffleId || "current"}, Session: ${params.sessionId})`);
    } else {
      console.log(`[LOCK_RELEASED] Requesting unlock/release for cota(s): ${idsLog} (Raffle: ${params.raffleId || "current"}, Session: ${params.sessionId})`);
    }

    try {
      const bodyPayload = params.numberId 
        ? { numberId: params.numberId, sessionId: params.sessionId, action: params.action, raffleId: params.raffleId || "current" }
        : { numbers: params.numbers, sessionId: params.sessionId, action: params.action, raffleId: params.raffleId || "current" };

      const res = await fetch("/api/lock-cota", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
        ...(params.keepalive ? { keepalive: true } : {})
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || data.message || "Erro de Lock no servidor.");
      }
      return data;
    } catch (err: any) {
      if (params.action === "unlock") {
        console.warn(`[Lock API Warning] Non-critical unlock failure for:`, idsLog, err.message || err);
      } else {
        console.error(`Error in lockCota [${params.action}] for:`, idsLog, err);
      }
      throw err;
    }
  },

  async cancelOrder(
    param1?: string | { orderId?: string; sessionId?: string; raffleId?: string; keepalive?: boolean },
    param2?: string | boolean,
    param3?: string
  ): Promise<any> {
    let orderId: string | undefined;
    let sessionId: string | undefined;
    let raffleId: string | undefined;
    let keepalive = false;

    if (typeof param1 === "object" && param1 !== null) {
      orderId = param1.orderId;
      sessionId = param1.sessionId;
      raffleId = param1.raffleId;
      keepalive = !!param1.keepalive;
    } else if (typeof param1 === "string") {
      orderId = param1;
      if (typeof param2 === "string") {
        sessionId = param2;
      } else if (typeof param2 === "boolean") {
        keepalive = param2;
      }
      if (typeof param3 === "string") {
        raffleId = param3;
      }
    }

    console.log(`[ORDER_CANCEL_START] Requesting backend to cancel order: ${orderId || "N/A"}, session: ${sessionId || "N/A"}`);
    try {
      const response = await fetch("/api/cancel-order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ orderId, sessionId, raffleId: raffleId || "current" }),
        ...(keepalive ? { keepalive: true } : {})
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || "Failed to cancel order remotely");
      }

      const data = await response.json();
      console.log(`[ORDER_CANCEL_SUCCESS] Successfully cancelled order / released session: ${orderId || sessionId}`);
      return data;
    } catch (err: any) {
      console.error(`[ORDER_CANCEL_ERROR] error while cancelling order/session ${orderId || sessionId}:`, err);
      throw err;
    }
  },

  logPixExpired(orderId: string, paymentId: string) {
    console.log(`[PIX_EXPIRED] Order expired or late check-in. orderId: ${orderId}, paymentId: ${paymentId}`);
  },

  async checkPayment(params: {
    paymentId: string;
    orderId?: string;
    raffleId?: string;
  }): Promise<any> {
    console.log(`[PAYMENT_STATUS_CHECKED] Requesting check-payment for paymentId: ${params.paymentId}, orderId: ${params.orderId || "N/A"}`);
    try {
      const response = await fetch("/api/check-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId: params.paymentId,
          orderId: params.orderId,
          raffleId: params.raffleId || "current",
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Erro ao consultar status do pagamento");
      }
      return data;
    } catch (err: any) {
      console.error("[PAYMENT_STATUS_CHECK_ERROR]", err);
      throw err;
    }
  }
};
