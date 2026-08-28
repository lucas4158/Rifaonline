import "dotenv/config";

// Helper function to process token and collect safe non-sensitive metadata for diagnostics
function getSanitizedPagBankToken() {
  const rawToken = process.env.PAGBANK_ACCESS_TOKEN || "";
  const tokenExists = rawToken.length > 0;
  const tokenLength = rawToken.length;
  const hasLeadingWhitespace = /^\s/.test(rawToken);
  const hasTrailingWhitespace = /\s$/.test(rawToken);
  const hasLeadingQuote = /^['"]/.test(rawToken);
  const hasTrailingQuote = /['"]$/.test(rawToken);
  
  let cleanToken = rawToken.trim().replace(/^["']|["']$/g, "").trim();
  const hasBearerPrefix = /^bearer\s+/i.test(cleanToken);
  
  if (hasBearerPrefix) {
    cleanToken = cleanToken.replace(/^bearer\s+/i, "").trim();
  }

  console.log("[PAGBANK_TOKEN_DIAGNOSTIC]", {
    tokenExists,
    tokenLength,
    hasLeadingWhitespace,
    hasTrailingWhitespace,
    hasLeadingQuote,
    hasTrailingQuote,
    hasBearerPrefix,
    authorizationPrefix: "Bearer"
  });

  return cleanToken;
}

export const pagbankService = {
  // Isolated diagnostic test function as requested in item 6
  async testIsolatedCall(): Promise<{ success: boolean; status?: number; error?: string }> {
    try {
      const accessToken = getSanitizedPagBankToken();
      const rawBase = process.env.PAGBANK_API_BASE_URL || "https://sandbox.api.pagseguro.com";
      const cleanBaseUrl = rawBase.replace(/\/+$/, "");
      const testUrl = `${cleanBaseUrl}/orders`;

      console.log(`[PAGBANK_ISOLATED_TEST] Testing fetch to ${testUrl}`);
      const response = await fetch(testUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          reference_id: "diag_test_123",
          customer: { name: "Teste", email: "teste@teste.com", tax_id: "12345678909", phones: [{ country: "55", area: "11", number: "999999999", type: "MOBILE" }] },
          items: [{ reference_id: "item_1", name: "Teste", quantity: 1, unit_amount: 100 }],
          qr_codes: [{ amount: { value: 100 }, expiration_date: new Date(Date.now() + 3600000).toISOString() }]
        })
      });

      const data = await response.json().catch(() => ({}));
      return {
        success: response.ok,
        status: response.status,
        error: response.ok ? undefined : (data.message || JSON.stringify(data))
      };
    } catch (err: any) {
      return { success: false, error: err?.message || String(err) };
    }
  },

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
    const accessToken = getSanitizedPagBankToken();
    if (!accessToken) {
      throw new Error("PAGBANK_ACCESS_TOKEN environment variable is missing.");
    }
    const rawBase = process.env.PAGBANK_API_BASE_URL || "https://sandbox.api.pagseguro.com";
    const cleanBaseUrl = rawBase.replace(/\/+$/, "");

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

    const targetUrl = `${cleanBaseUrl}/orders`;
    console.log(`[PAGBANK_CREATE_ORDER] Sending request to ${targetUrl} for orderId: ${orderId}`);

    const response = await fetch(targetUrl, {
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
    const accessToken = getSanitizedPagBankToken();
    if (!accessToken) {
      throw new Error("PAGBANK_ACCESS_TOKEN environment variable is missing.");
    }
    const rawBase = process.env.PAGBANK_API_BASE_URL || "https://sandbox.api.pagseguro.com";
    const cleanBaseUrl = rawBase.replace(/\/+$/, "");

    const response = await fetch(`${cleanBaseUrl}/orders/${orderIdOrPagBankId}`, {
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

