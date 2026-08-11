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
      type?: "pending" | "paid";
    }) => void,
    options?: { limitCount?: number; raffleId?: string }
  ) {
    if (!isAdminAuthenticated) return () => {};

    const limitCount = options?.limitCount || 500;
    const targetRaffleId = options?.raffleId;

    let previousOrdersMap = new Map<string, string>();
    let isInitialLoad = true;

    const processOrders = (rawOrdersList: any[]) => {
      const processedList: any[] = [];
      const currentMap = new Map<string, string>();

      rawOrdersList.forEach((data) => {
        const sLower = String(data.status || "").toLowerCase().trim();
        let status = data.status;
        if (
          sLower === "pago" ||
          sLower === "paid" ||
          sLower === "approved" ||
          sLower === "aprovado" ||
          sLower === "confirmed" ||
          sLower === "paga" ||
          sLower === "pagas" ||
          sLower === "concluido" ||
          sLower === "concluído"
        ) {
          status = "Pago";
        } else if (sLower === "cancelado" || sLower === "canceled" || sLower === "cancelled") {
          status = "Cancelado";
        } else if (sLower === "expired") {
          status = "expired";
        } else if (sLower === "refunded" || sLower === "reembolsado") {
          status = "Reembolsado";
        } else if (data.status === "PAYMENT_AFTER_EXPIRATION") {
          status = "PAYMENT_AFTER_EXPIRATION";
        } else {
          status = "Aguardando";
        }

        const id = data.id;
        const statusRaw = String(data.status || "").toLowerCase();
        currentMap.set(id, statusRaw);

        if (!isInitialLoad && onPaidOrderNotification) {
          const prevStatus = previousOrdersMap.get(id);
          const isPaid =
            statusRaw === "paid" ||
            statusRaw === "pago" ||
            statusRaw === "confirmed" ||
            statusRaw === "approved" ||
            statusRaw === "aprovado" ||
            statusRaw === "paga" ||
            statusRaw === "pagas" ||
            statusRaw === "concluido" ||
            statusRaw === "concluído";
          const numsList = Array.isArray(data.nums) ? data.nums : (Array.isArray(data.purchasedNums) ? data.purchasedNums : []);

          if (!prevStatus) {
            // New order added
            onPaidOrderNotification({
              orderId: id,
              name: data.name || data.customerName || "Cliente",
              total: Number(data.total || data.totalValue || data.val || data.amount || 0),
              numsCount: numsList.length,
              raffleTitle: data.raffleTitle || "",
              raffleId: data.raffleId || "current",
              type: isPaid ? "paid" : "pending",
            });
          } else if (prevStatus !== statusRaw && isPaid) {
            // Status changed to paid
            onPaidOrderNotification({
              orderId: id,
              name: data.name || data.customerName || "Cliente",
              total: Number(data.total || data.totalValue || data.val || data.amount || 0),
              numsCount: numsList.length,
              raffleTitle: data.raffleTitle || "",
              raffleId: data.raffleId || "current",
              type: "paid",
            });
          }
        }

        processedList.push({ ...data, id, status });
      });

      previousOrdersMap = currentMap;
      isInitialLoad = false;

      processedList.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      onSync(processedList);
    };

    const fetchViaAdminApi = async () => {
      try {
        const token =
          (typeof window !== "undefined" &&
            localStorage.getItem("raffle_admin_token")) ||
          "";
        const res = await fetch("/api/admin-action", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
          body: JSON.stringify({
            action: "list-orders",
            raffleId: targetRaffleId,
            limitCount,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.orders)) {
            processOrders(data.orders);
          }
        } else if (res.status === 401 || res.status === 403) {
          console.warn("🚨 [Admin] Sessão expirada ou inválida. É necessário fazer login novamente.");
        }
      } catch (err) {
        // Silently catch network errors in background poll
      }
    };

    // Initial fetch via Admin API
    fetchViaAdminApi();

    // Setup periodic 4s poll interval for real-time responsiveness
    const pollInterval = setInterval(() => {
      fetchViaAdminApi();
    }, 4000);

    return () => {
      clearInterval(pollInterval);
    };
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
      where("raffleId", "==", raffleId)
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
