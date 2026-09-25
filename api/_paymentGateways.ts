/**
 * Gateway Architecture
 * Defines available payment gateways and normalization helpers for RifaMaster.
 * Current active gateway: Mercado Pago
 */

export type PaymentGateway = "mercadopago" | "manual";

/**
 * Normalizes payment gateway strings from database or requests.
 * Preserves 'mercadopago' and 'manual'.
 * Legacy gateways (e.g. asaas) or unknown values gracefully fallback to 'mercadopago'.
 */
export function normalizePaymentGateway(gateway?: string | null): PaymentGateway {
  const g = String(gateway || "").toLowerCase().trim();
  if (g === "manual") {
    return "manual";
  }
  return "mercadopago";
}
