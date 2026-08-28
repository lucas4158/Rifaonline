import { purchaseHistoryService } from "../src/services/supabase/purchaseHistoryService.js";
import { auditService } from "../src/services/supabase/auditService.js";
import { drawService } from "../src/services/supabase/drawService.js";
import { notificationService } from "../src/services/supabase/notificationService.js";
import { activityService } from "../src/services/supabase/activityService.js";
import { raffleNumbersService } from "../src/services/supabase/raffleNumbersService.js";

/**
 * Executes a sync action with up to maxRetries attempts.
 * Guaranteed never to throw or crash the main request.
 */
async function runWithRetry(actionName: string, fn: () => Promise<boolean>, maxRetries = 2): Promise<boolean> {
  let attempt = 0;
  while (attempt < maxRetries) {
    attempt++;
    try {
      const success = await fn();
      if (success) return true;
    } catch (err: any) {
      console.debug(`[SUPABASE_SYNC_BYPASSED] Optional sync '${actionName}' failed attempt ${attempt}/${maxRetries}. Firestore operational state unaffected.`);
    }
    if (attempt < maxRetries) {
      await new Promise((res) => setTimeout(res, 300));
    }
  }
  return false;
}

export const serverSupabaseSync = {
  /**
   * Syncs a confirmed purchase to purchase_history, audit_logs, admin_notifications, and activity_logs.
   */
  async syncConfirmedPayment(order: {
    orderId: string;
    raffleId?: string;
    customerName?: string;
    customerPhone?: string;
    amount?: number;
    paymentId?: string;
    numsCount?: number;
    numbers?: string[];
    bonusNums?: string[];
  }) {
    const raffleId = order.raffleId || "current";
    const orderId = order.orderId;

    try {
      if (Array.isArray(order.numbers) && order.numbers.length > 0) {
        const bonusSet = new Set(order.bonusNums || []);
        await this.syncNumberStates(
          raffleId,
          order.numbers.map((num) => ({
            number: num,
            status: "paid",
            order_id: orderId,
            is_bonus: bonusSet.has(num),
            reserved_until: null,
          }))
        );
      }

      // 1. purchase_history
      runWithRetry(`purchase_history (${orderId})`, () =>
        purchaseHistoryService.recordPurchase({
          firestore_order_id: orderId,
          raffle_id: raffleId,
          customer_name: order.customerName,
          customer_phone: order.customerPhone,
          amount: order.amount,
          payment_id: order.paymentId,
          payment_status: "approved",
          purchase_status: "completed",
        })
      ).catch(() => {});

      // 2. audit_logs
      runWithRetry(`audit_logs payment_confirmed (${orderId})`, () =>
        auditService.logEvent({
          raffle_id: raffleId,
          event_type: "payment_confirmed",
          entity_type: "order",
          entity_id: orderId,
          actor_id: "system",
          actor_name: "Mercado Pago Webhook",
          metadata: {
            amount: order.amount,
            paymentId: order.paymentId,
            numsCount: order.numsCount || 0,
          },
        })
      ).catch(() => {});

      // 3. admin_notifications
      runWithRetry(`admin_notifications (${orderId})`, () =>
        notificationService.recordNotification({
          firestore_event_id: `pay_${orderId}_${order.paymentId || Date.now()}`,
          type: "new_paid_order",
          title: "Nova compra confirmada via Pix",
          customer_name: order.customerName,
          customer_phone: order.customerPhone,
          amount: order.amount,
          raffle_id: raffleId,
        })
      ).catch(() => {});

      // 4. activity_logs
      runWithRetry(`activity_logs (${orderId})`, () =>
        activityService.logActivity({
          raffle_id: raffleId,
          activity_type: "payment_confirmed",
          description: `Pagamento Pix de R$ ${(order.amount || 0).toFixed(2)} confirmado para o cliente ${order.customerName || "Cliente"}.`,
          metadata: { orderId, paymentId: order.paymentId },
        })
      ).catch(() => {});
    } catch (e) {
      console.debug("[SUPABASE_SYNC_BYPASSED] Main execution continuing safely in Firestore.");
    }
  },

  /**
   * Syncs a manual payment approval to purchase_history, audit_logs, admin_notifications, and activity_logs.
   */
  async syncManualApproval(order: {
    orderId: string;
    raffleId?: string;
    customerName?: string;
    customerPhone?: string;
    amount?: number;
    paymentId?: string;
    numsCount?: number;
    adminUid?: string;
    previousStatus?: string;
  }) {
    const raffleId = order.raffleId || "current";
    const orderId = order.orderId;

    try {
      // 1. purchase_history
      runWithRetry(`purchase_history (${orderId})`, () =>
        purchaseHistoryService.recordPurchase({
          firestore_order_id: orderId,
          raffle_id: raffleId,
          customer_name: order.customerName,
          customer_phone: order.customerPhone,
          amount: order.amount,
          payment_id: order.paymentId || "MANUAL_APPROVAL",
          payment_status: "approved",
          purchase_status: "completed",
        })
      ).catch(() => {});

      // 2. audit_logs
      runWithRetry(`audit_logs MANUAL_PAYMENT_APPROVED (${orderId})`, () =>
        auditService.logEvent({
          raffle_id: raffleId,
          event_type: "MANUAL_PAYMENT_APPROVED",
          entity_type: "order",
          entity_id: orderId,
          actor_id: order.adminUid || "admin",
          actor_name: "Administrador (Manual)",
          metadata: {
            orderId,
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            amount: order.amount,
            paymentId: order.paymentId,
            numsCount: order.numsCount || 0,
            previousStatus: order.previousStatus || "Aguardando",
            nextStatus: "Pago",
            approvedAt: new Date().toISOString(),
          },
        })
      ).catch(() => {});

      // 3. admin_notifications
      runWithRetry(`admin_notifications (${orderId})`, () =>
        notificationService.recordNotification({
          firestore_event_id: `manual_appr_${orderId}_${Date.now()}`,
          type: "manual_payment_approved",
          title: "Pagamento aprovado manualmente pelo administrador",
          customer_name: order.customerName,
          customer_phone: order.customerPhone,
          amount: order.amount,
          raffle_id: raffleId,
        })
      ).catch(() => {});

      // 4. activity_logs
      runWithRetry(`activity_logs (${orderId})`, () =>
        activityService.logActivity({
          raffle_id: raffleId,
          activity_type: "manual_payment_approved",
          description: `Aprovação manual de pagamento no valor de R$ ${(order.amount || 0).toFixed(2)} para o cliente ${order.customerName || "Cliente"}.`,
          metadata: { orderId, approvedBy: order.adminUid || "admin" },
        })
      ).catch(() => {});
    } catch (e) {
      console.debug("[SUPABASE_SYNC_BYPASSED] Main execution continuing safely in Firestore.");
    }
  },

  /**
   * Syncs an expired reservation to audit_logs ONLY.
   */
  async syncExpiredReservation(reservation: {
    orderId: string;
    raffleId?: string;
    nums?: string[];
  }) {
    const raffleId = reservation.raffleId || "current";
    try {
      runWithRetry(`audit_logs reservation_expired (${reservation.orderId})`, () =>
        auditService.logEvent({
          raffle_id: raffleId,
          event_type: "reservation_expired",
          entity_type: "reservation",
          entity_id: reservation.orderId,
          actor_id: "background_cleaner",
          actor_name: "Server Cleaner",
          metadata: {
            releasedNumbers: reservation.nums || [],
          },
        })
      ).catch(() => {});
    } catch (e) {
      console.debug("[SUPABASE_SYNC_BYPASSED] Main execution continuing safely in Firestore.");
    }
  },

  /**
   * Syncs a completed or legacy draw to draws and audit_logs.
   */
  async syncDrawCompleted(draw: {
    drawId?: string;
    raffleId: string;
    seed?: string | null;
    winnerNumber?: string;
    winnerName?: string;
    participantsCount?: number;
    method?: string;
    isLegacy?: boolean;
    executedBy?: string;
  }) {
    const raffleId = draw.raffleId || "current";
    const drawId = draw.drawId || `draw_${raffleId}_${Date.now()}`;

    try {
      runWithRetry(`draws record (${drawId})`, () =>
        drawService.recordDraw({
          firestore_draw_id: drawId,
          raffle_id: raffleId,
          status: draw.isLegacy ? "legacy" : "completed",
          method: draw.method || (draw.isLegacy ? "historical_manual" : "deterministic_seed"),
          seed: draw.seed !== undefined ? draw.seed : null,
          winner_number: draw.winnerNumber,
          winner_name: draw.winnerName,
          participants_count: draw.participantsCount || 0,
          executed_by: draw.executedBy || "Admin",
        })
      ).catch(() => {});

      runWithRetry(`audit_logs draw (${drawId})`, () =>
        auditService.logEvent({
          raffle_id: raffleId,
          event_type: draw.isLegacy ? "draw_legacy_registered" : "draw_completed",
          entity_type: "draw",
          entity_id: drawId,
          actor_id: "admin",
          actor_name: draw.executedBy || "Admin",
          metadata: {
            winnerNumber: draw.winnerNumber,
            winnerName: draw.winnerName,
            hasSeed: !!draw.seed,
          },
        })
      ).catch(() => {});
    } catch (e) {
      console.debug("[SUPABASE_SYNC_BYPASSED] Main execution continuing safely in Firestore.");
    }
  },

  /**
   * Syncs number state changes (reserve, paid, etc.) to Supabase raffle_numbers.
   */
  async syncNumberStates(
    raffleId: string,
    numbers: Array<{
      number: string;
      status: string;
      order_id?: string | null;
      is_bonus?: boolean;
      reserved_until?: number | null;
    }>
  ) {
    const rId = raffleId || "current";
    for (const num of numbers) {
      runWithRetry(`raffle_numbers (${rId}-${num.number})`, () =>
        raffleNumbersService.upsertNumber({
          raffle_id: rId,
          number: num.number,
          status: num.status,
          order_id: num.order_id || null,
          is_bonus: Boolean(num.is_bonus),
          reserved_until: num.reserved_until || null,
        })
      ).catch(() => {});
    }
  },

  /**
   * Syncs number deletions or releases to Supabase raffle_numbers.
   */
  async syncDeleteNumbers(raffleId: string, numbers: string[]) {
    const rId = raffleId || "current";
    for (const num of numbers) {
      runWithRetry(`raffle_numbers delete (${rId}-${num})`, () =>
        raffleNumbersService.deleteNumber(rId, String(num))
      ).catch(() => {});
    }
  }
};
