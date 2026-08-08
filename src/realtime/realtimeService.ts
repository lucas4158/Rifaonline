import { doc, collection, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import { OperationType, RaffleConfig } from "../types";
import { handleFirestoreError } from "../utils/helpers";

export const realtimeService = {
  subscribeConfig(
    db: any,
    onSync: (config: RaffleConfig) => void,
    onLoaded: () => void,
    raffleId: string = "current"
  ) {
    if (!raffleId) {
      onLoaded();
      return () => {};
    }
    const docRef = doc(db, "raffles", raffleId);
    const unsub = onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          onSync({ ...data, id: docSnap.id } as any);
          console.log(`📸 [IMAGE_REALTIME_SYNC] Syncing raffle config (${raffleId}). Title: "${data.title}", ImageUrl: "${data.imageUrl || ""}", Active: ${data.isActive}`);
        }
        onLoaded();
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.GET, `raffles/${raffleId}`);
        } catch (e) {
          console.error("Config realtime sync error:", e);
        }
        onLoaded();
      }
    );
    return unsub;
  },

  subscribeNumbers(
    db: any,
    onSyncThrottled: (numbers: any) => void,
    raffleId: string = "current"
  ) {
    if (!raffleId) {
      onSyncThrottled({});
      return () => {};
    }
    const colRef = collection(db, "raffles", raffleId, "numbers");
    const unsub = onSnapshot(
      colRef,
      (querySnap) => {
        const activeNumbers: Record<string, { id: string; status: string; orderId?: string; name?: string; expiresAt?: number }> = {};
        querySnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (data) {
            activeNumbers[docSnap.id] = data;
          }
        });
        onSyncThrottled(activeNumbers);
        console.log(`[REALTIME_SYNC] Syncing numbers database (${raffleId}). Total active numbers count: ${querySnap.size}`);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, `raffles/${raffleId}/numbers`);
        } catch (e) {
          console.error("Numbers realtime sync error:", e);
        }
      }
    );
    return unsub;
  },

  subscribeOrders(
    db: any,
    isAdminAuthenticated: boolean,
    onSync: (orders: any[]) => void,
    onPaidOrderNotification?: (notification: {
      orderId: string;
      name: string;
      total: number;
      numsCount: number;
      raffleTitle?: string;
      raffleId?: string;
    }) => void,
    options?: { limitCount?: number; raffleId?: string }
  ) {
    if (!isAdminAuthenticated) return () => {};

    const limitCount = options?.limitCount || 50;
    const targetRaffleId = options?.raffleId;
    const colRef = collection(db, "orders");
    const q = (targetRaffleId && targetRaffleId !== "all")
      ? query(colRef, where("raffleId", "==", targetRaffleId), limit(limitCount))
      : query(colRef, orderBy("createdAt", "desc"), limit(limitCount));

    let isInitialLoad = true;

    const unsub = onSnapshot(
      q,
      (querySnap) => {
        if (!isInitialLoad && onPaidOrderNotification) {
          querySnap.docChanges().forEach((change) => {
            if (change.type === "added" || change.type === "modified") {
              const data = change.doc.data() as any;
              const statusRaw = String(data.status || "").toLowerCase();
              const isPaid =
                statusRaw === "paid" ||
                statusRaw === "pago" ||
                statusRaw === "confirmed" ||
                statusRaw === "approved";

              if (isPaid) {
                onPaidOrderNotification({
                  orderId: change.doc.id,
                  name: data.name || data.customerName || "Cliente",
                  total: Number(data.total || data.totalValue || data.val || data.amount || 0),
                  numsCount: Array.isArray(data.nums) ? data.nums.length : 0,
                  raffleTitle: data.raffleTitle || "",
                  raffleId: data.raffleId || "current",
                });
              }
            }
          });
        }
        isInitialLoad = false;

        const ordersList: any[] = [];
        querySnap.forEach((doc) => {
          const data = doc.data() as any;
          let status = data.status;
          if (status === "pending_payment" || status === "Aguardando") {
            status = "Aguardando";
          } else if (status === "paid" || status === "Pago" || status === "confirmed") {
            status = "Pago";
          } else if (status === "canceled" || status === "Cancelado") {
            status = "Cancelado";
          } else if (status === "expired" || status === "expired") {
            status = "expired";
          } else if (status === "refunded" || status === "Reembolsado") {
            status = "Reembolsado";
          } else if (status === "PAYMENT_AFTER_EXPIRATION") {
            status = "PAYMENT_AFTER_EXPIRATION";
          } else {
            status = "Aguardando";
          }
          ordersList.push({ ...data, id: doc.id, status });
        });

        ordersList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        onSync(ordersList);
        console.log(`[REALTIME_SYNC] Syncing administrative orders list (limit ${limitCount}). Count: ${querySnap.size}`);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, "orders");
        } catch (e) {
          console.error("Orders realtime sync error:", e);
        }
      }
    );
    return unsub;
  },

  subscribeLocks(
    db: any,
    onSyncThrottled: (locks: any) => void,
    raffleId?: string
  ) {
    if (!raffleId || raffleId === "all") {
      onSyncThrottled({});
      return () => {};
    }
    const colRef = collection(db, "locks");
    const q = query(
      colRef,
      where("raffleId", "==", raffleId),
      where("expiresAt", ">", Date.now())
    );
    const unsub = onSnapshot(
      q,
      (querySnap) => {
        const activeLocks: {
          [numberId: string]: { sessionId: string; expiresAt: number; raffleId?: string };
        } = {};
        const currentNow = Date.now();
        querySnap.forEach((docSnap) => {
          const data = docSnap.data() as any;
          if (data && data.expiresAt > currentNow) {
            // Filter by raffleId if provided to isolate multi-raffle locks
            if (!raffleId || !data.raffleId || data.raffleId === raffleId) {
              activeLocks[docSnap.id] = {
                sessionId: data.sessionId,
                expiresAt: data.expiresAt,
                raffleId: data.raffleId,
              };
            }
          }
        });
        onSyncThrottled(activeLocks);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, "locks");
        } catch (e) {
          console.error("Locks realtime sync error:", e);
        }
      }
    );
    return unsub;
  }
};
