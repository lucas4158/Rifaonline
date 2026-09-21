/**
 * Gateway Architecture
 * Defines available payment gateways and normalization helpers for RifaMaster.
 * Current active gateway: Mercado Pago
 */

export type PaymentGateway = "mercadopago";

/**
 * Normalizes payment gateway strings from database or requests.
 * Legacy gateways (e.g. asaas) or unknown values gracefully fallback to 'mercadopago'.
 */
export function normalizePaymentGateway(gateway?: string | null): PaymentGateway {
  return "mercadopago";
}
