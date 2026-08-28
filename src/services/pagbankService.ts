import "dotenv/config";

export const pagbankService = {
  async createPixOrder({
    orderId,
    raffleTitle,
    amount,
    customerName,
    customerEmail,
    customerPhone,
    expiresAt,
    notificationUrl,
    idempotencyKey,
  }: {
    orderId: string;
    raffleTitle: string;
    amount: number;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    expiresAt: number;
    notificationUrl?: string;
    idempotencyKey: string;
  }) {
    const accessToken = process.env.PAGBANK_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error("PAGBANK_ACCESS_TOKEN environment variable is missing.");
    }
    const baseUrl = process.env.PAGBANK_API_BASE_URL || "https://sandbox.api.pagseguro.com";

    const sanitizedPhone = customerPhone.replace(/\D/g, "");
    let area = "11";
    let number = "999999999";
    if (sanitizedPhone.length >= 10) {
      area = sanitizedPhone.substring(0, 2);
      number = sanitizedPhone.substring(2);
    } else if (sanitizedPhone.length > 0) {
      number = sanitizedPhone;
    }

    const amountInCents = Math.round(amount * 100);
    const expirationDateIso = new Date(expiresAt).toISOString();

    const payload: any = {
      reference_id: orderId,
      customer: {
        name: customerName || "Cliente Rifa",
        email: customerEmail || `cliente_${orderId.toLowerCase()}@rifamaster.com`,
        tax_id: "12345678909",
        phones: [
          {
            country: "55",
            area,
            number,
            type: "MOBILE",
          },
        ],
      },
      items: [
        {
          reference_id: `item_${orderId}`,
          name: raffleTitle || "Rifa Cotas",
          quantity: 1,
          unit_amount: amountInCents,
        },
      ],
      qr_codes: [
        {
          amount: {
            value: amountInCents,
          },
          expiration_date: expirationDateIso,
        },
      ],
    };

    if (notificationUrl) {
      payload.notification_urls = [notificationUrl];
    }

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "accept": "application/json",
    };

    if (idempotencyKey) {
      headers["x-idempotency-key"] = idempotencyKey;
    }

    console.log(`[PAGBANK_CREATE_ORDER] Sending request to ${baseUrl}/orders for orderId: ${orderId}`);

    const response = await fetch(`${baseUrl}/orders`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ [PagBank API Error]:", JSON.stringify(data));
      throw new Error(data.message || data.error_messages?.[0]?.description || "Erro ao criar pedido Pix no PagBank");
    }

    return data;
  },

  async getOrder(orderIdOrPagBankId: string) {
    const accessToken = process.env.PAGBANK_ACCESS_TOKEN;
    if (!accessToken) {
      throw new Error("PAGBANK_ACCESS_TOKEN environment variable is missing.");
    }
    const baseUrl = process.env.PAGBANK_API_BASE_URL || "https://sandbox.api.pagseguro.com";

    const response = await fetch(`${baseUrl}/orders/${orderIdOrPagBankId}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "accept": "application/json",
      },
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Erro ao consultar pedido no PagBank");
    }
    return data;
  },
};
