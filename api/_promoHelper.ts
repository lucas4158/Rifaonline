import crypto from "crypto";

console.log("🚀 [PROMO_HELPER_LOADED] Promotional helper loading successfully into current thread context.");

export async function allocatePromotionalBonus(
  db: any,
  orderId: string,
  orderData: any,
  batch: any,
  raffleId: string = "current"
) {
  const targetRaffleId = orderData.raffleId || raffleId || "current";
  const configRef = db.collection("raffles").doc(targetRaffleId);
  const configSnap = await configRef.get();
  if (!configSnap.exists) {
    console.log(`[PROMOTION_DISABLED] No config found for orderId ${orderId} on raffle ${targetRaffleId}.`);
    return;
  }

  const config = configSnap.data();
  if (!config.promotionEnabled) {
    console.log(`[PROMOTION_DISABLED] Automatic promotions disabled in settings for orderId ${orderId}.`);
    return;
  }

  const buy = Number(config.promotionBuy || 5);
  const bonus = Number(config.promotionBonus || 1);
  const totalNumbers = Number(config.totalNumbers || 150);

  // Filter out any existing bonus numbers to avoid infinite scaling
  const originalNums = (orderData.nums || []).filter(
    (num: string) => !(orderData.bonusNums || []).includes(num)
  );

  if (buy <= 0 || bonus <= 0 || originalNums.length === 0) {
    return;
  }

  const calculatedBonus = Math.floor(originalNums.length / buy) * bonus;
  console.log(`[PROMO_CALCULATED] orderId: ${orderId}, boughtCount: ${originalNums.length}, buyRule: ${buy}, bonusRatio: ${bonus}, calculatedBonus: ${calculatedBonus}`);

  if (calculatedBonus <= 0) {
    return;
  }

  const preallocatedBonus = orderData.bonusNums || [];
  if (preallocatedBonus.length >= calculatedBonus) {
    console.log(`[BONUS_ALREADY_ALLOCATED] orderId: ${orderId}, existingBonusCount: ${preallocatedBonus.length}, calculatedBonus: ${calculatedBonus}, bonusNums: ${preallocatedBonus.join(", ")}`);
    return;
  }

  const neededNewBonusCount = calculatedBonus - preallocatedBonus.length;
  const padLen = String(totalNumbers).length < 3 ? 3 : String(totalNumbers).length;
  const existingSet = new Set<string>([...(orderData.nums || []), ...preallocatedBonus]);

  let selectedBonus: string[] = [];

  try {
    await db.runTransaction(async (transaction: any) => {
      const candidateNumbers: string[] = [];
      let attempts = 0;
      const maxAttempts = totalNumbers * 2;

      while (candidateNumbers.length < neededNewBonusCount + 15 && attempts < maxAttempts) {
        attempts++;
        const randomVal = crypto.randomInt(1, totalNumbers + 1);
        const formatted = String(randomVal).padStart(padLen, "0");
        if (!existingSet.has(formatted) && !candidateNumbers.includes(formatted)) {
          candidateNumbers.push(formatted);
        }
      }

      if (candidateNumbers.length === 0) return;

      const candRefs = candidateNumbers.map((num) =>
        db.collection("raffles").doc(targetRaffleId).collection("numbers").doc(num)
      );
      const candSnaps = await transaction.getAll(...candRefs);

      const now = Date.now();
      const claimed: string[] = [];

      for (let i = 0; i < candSnaps.length; i++) {
        if (claimed.length >= neededNewBonusCount) break;
        const docSnap = candSnaps[i];
        const candNum = candidateNumbers[i];

        if (!docSnap.exists) {
          claimed.push(candNum);
          transaction.set(candRefs[i], {
            id: candNum,
            status: "paid",
            orderId: orderId,
            name: orderData.name,
            phone: orderData.phone,
            isBonus: true,
            updatedAt: new Date().toISOString()
          });
        } else {
          const d = docSnap.data();
          const status = (d?.status || "").toLowerCase().trim();
          const expires = d?.expiresAt || 0;
          const isExp = expires > 0 && now >= expires;

          const isBusy =
            status === "paid" ||
            status === "pago" ||
            ((status === "reserved" || status === "pending_payment" || status === "aguardando") && !isExp);

          if (!isBusy) {
            claimed.push(candNum);
            transaction.set(candRefs[i], {
              id: candNum,
              status: "paid",
              orderId: orderId,
              name: orderData.name,
              phone: orderData.phone,
              isBonus: true,
              updatedAt: new Date().toISOString()
            }, { merge: true });
          }
        }
      }

      selectedBonus = claimed;
    });
  } catch (txErr: any) {
    console.error(`❌ [PromoHelper] Atomic transaction error allocating bonus for order ${orderId}:`, txErr?.message || txErr);
    return;
  }

  if (selectedBonus.length === 0) {
    console.warn(`[INSUFFICIENT_PROMOTION_CAPACITY] Could not claim any bonus numbers atomically for order ${orderId}`);
    return;
  }

  console.log(`[BONUS_SELECTED_ATOMIC] orderId: ${orderId}, newlyClaimedBonus: ${selectedBonus.join(", ")}`);

  const mergedBonus = Array.from(new Set([...preallocatedBonus, ...selectedBonus]));
  const existingNums = orderData.nums || [];
  const mergedNums = Array.from(new Set([...existingNums, ...selectedBonus]));

  batch.update(db.collection("orders").doc(orderId), {
    nums: mergedNums,
    bonusNums: mergedBonus,
    raffleId: targetRaffleId
  });

  batch.set(db.collection("reservations").doc(orderId), {
    nums: mergedNums,
    bonusNums: mergedBonus
  }, { merge: true });

  console.log(`[BONUS_PAID] orderId: ${orderId}, totalBonusNums: ${mergedBonus.join(", ")}`);
}
