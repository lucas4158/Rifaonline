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

  // Generic calculation: works for 2x1, 5x1, 2x3, 5x5, etc.
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

  // Find free available numbers from the database
  const numbersCollection = db.collection("raffles").doc(targetRaffleId).collection("numbers");
  const numbersSnap = await numbersCollection.get();
  const busy = new Set<string>();

  const now = Date.now();
  numbersSnap.forEach((docSnap) => {
    const d = docSnap.data();
    if (d) {
      const status = (d.status || "").toLowerCase().trim();
      const expires = d.expiresAt || 0;
      const isExp = expires > 0 && now >= expires;

      if (status === "paid" || status === "pago") {
        busy.add(docSnap.id);
      } else if (
        (status === "reserved" || status === "pending_payment" || status === "aguardando") &&
        !isExp
      ) {
        busy.add(docSnap.id);
      }
    }
  });

  const available: string[] = [];
  const padLen = String(totalNumbers).length < 3 ? 3 : String(totalNumbers).length;

  for (let i = 1; i <= totalNumbers; i++) {
    const formatted = String(i).padStart(padLen, "0");
    if (!busy.has(formatted)) {
      available.push(formatted);
    }
  }

  const neededNewBonusCount = calculatedBonus - preallocatedBonus.length;

  if (available.length < neededNewBonusCount) {
    console.warn(`[INSUFFICIENT_PROMOTION_CAPACITY] Not enough available numbers for promotional allocation! Free available: ${available.length}, Needed: ${neededNewBonusCount}`);
    return;
  }

  const shuffled = available.sort(() => 0.5 - Math.random());
  const selectedBonus = shuffled.slice(0, neededNewBonusCount);
  console.log(`[BONUS_SELECTED] orderId: ${orderId}, newlySelectedBonus: ${selectedBonus.join(", ")}`);

  const mergedBonus = Array.from(new Set([...preallocatedBonus, ...selectedBonus]));
  const existingNums = orderData.nums || [];
  const mergedNums = Array.from(new Set([...existingNums, ...selectedBonus]));

  batch.update(db.collection("orders").doc(orderId), {
    nums: mergedNums,
    bonusNums: mergedBonus,
    raffleId: targetRaffleId
  });

  batch.update(db.collection("reservations").doc(orderId), {
    nums: mergedNums,
    bonusNums: mergedBonus
  });

  selectedBonus.forEach((num) => {
    const numDocRef = db.collection("raffles").doc(targetRaffleId).collection("numbers").doc(num);
    batch.set(numDocRef, {
      id: num,
      status: "paid",
      orderId: orderId,
      name: orderData.name,
      phone: orderData.phone,
      isBonus: true,
      updatedAt: new Date().toISOString()
    });
  });

  console.log(`[BONUS_PAID] orderId: ${orderId}, totalBonusNums: ${mergedBonus.join(", ")}`);
}
