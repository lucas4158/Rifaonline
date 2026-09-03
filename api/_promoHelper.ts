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

  // Find free available numbers from the database WITHOUT full collection scan
  const neededNewBonusCount = calculatedBonus - preallocatedBonus.length;
  const padLen = String(totalNumbers).length < 3 ? 3 : String(totalNumbers).length;
  const existingSet = new Set<string>([...(orderData.nums || []), ...preallocatedBonus]);

  const candidateNumbers: string[] = [];
  let attempts = 0;
  const maxAttempts = totalNumbers * 2;

  while (candidateNumbers.length < neededNewBonusCount + 10 && attempts < maxAttempts) {
    attempts++;
    const randomVal = crypto.randomInt(1, totalNumbers + 1);
    const formatted = String(randomVal).padStart(padLen, "0");
    if (!existingSet.has(formatted) && !candidateNumbers.includes(formatted)) {
      candidateNumbers.push(formatted);
    }
  }

  if (candidateNumbers.length === 0) {
    console.warn(`[INSUFFICIENT_PROMOTION_CAPACITY] No candidates available for bonus allocation.`);
    return;
  }

  // Fetch candidate document references in parallel (only candidateNumbers.length reads, e.g. 5-10 reads max)
  const candRefs = candidateNumbers.map((num) =>
    db.collection("raffles").doc(targetRaffleId).collection("numbers").doc(num)
  );
  const candSnaps = await Promise.all(candRefs.map((ref: any) => ref.get()));

  const now = Date.now();
  const selectedBonus: string[] = [];

  for (let i = 0; i < candSnaps.length; i++) {
    if (selectedBonus.length >= neededNewBonusCount) break;
    const docSnap = candSnaps[i];
    const candNum = candidateNumbers[i];

    if (!docSnap.exists) {
      // Document does not exist in numbers collection -> 100% free!
      selectedBonus.push(candNum);
    } else {
      const d = docSnap.data();
      if (d) {
        const status = (d.status || "").toLowerCase().trim();
        const expires = d.expiresAt || 0;
        const isExp = expires > 0 && now >= expires;

        const isBusy =
          status === "paid" ||
          status === "pago" ||
          ((status === "reserved" || status === "pending_payment" || status === "aguardando") && !isExp);

        if (!isBusy) {
          selectedBonus.push(candNum);
        }
      }
    }
  }

  if (selectedBonus.length < neededNewBonusCount) {
    console.warn(`[INSUFFICIENT_PROMOTION_CAPACITY] Could not find enough free candidate numbers! Selected: ${selectedBonus.length}, Needed: ${neededNewBonusCount}`);
    if (selectedBonus.length === 0) return;
  }

  console.log(`[BONUS_SELECTED] orderId: ${orderId}, newlySelectedBonus: ${selectedBonus.join(", ")}`);

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
