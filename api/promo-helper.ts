

console.log("🚀 [PROMO_HELPER_LOADED] Promotional helper loading successfully into current thread context.");

export async function allocatePromotionalBonus(
  db: any,
  orderId: string,
  orderData: any,
  batch: any,
  raffleId: string = "current"
) {
  const targetRaffleId = orderData.raffleId || raffleId || "current";
  // 1. Fetch current configuration
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

  // Calculate bonus count
  const calculatedBonus = Math.floor(originalNums.length / buy) * bonus;
  if (calculatedBonus <= 0) {
    console.log(`[PROMOTION_DISABLED] Order has ${originalNums.length} bought numbers. Below buy threshold of ${buy}.`);
    return;
  }

  // If we already have preallocated the correct number of bonus numbers, do not generate new random ones!
  const preallocatedBonus = orderData.bonusNums || [];
  if (preallocatedBonus.length >= calculatedBonus) {
    console.log(`[PROMOTION_ALREADY_ALLOCATED] Order ${orderId} already has ${preallocatedBonus.length} preallocated bonus numbers. Skipping regeneration.`);
    return;
  }

  console.log(`[PROMOTION_APPLIED] Order ${orderId} has ${originalNums.length} bought numbers. Eligible for ${calculatedBonus} bonus numbers.`);

  // Find free available numbers from the database
  const numbersCollection = db.collection("raffles").doc(targetRaffleId).collection("numbers");
  const numbersSnap = await numbersCollection.get();
  const busy = new Set<string>();

  // Mark already used/reserved numbers as busy (excluding expired reservations)
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

  // Gather free numbers
  const available: string[] = [];
  const requiredPad = 3; // ALWAYS match the frontend's padStart(3, "0") padding

  for (let i = 1; i <= totalNumbers; i++) {
    const formatted = String(i).padStart(requiredPad, "0");
    if (!busy.has(formatted)) {
      available.push(formatted);
    }
  }

  if (available.length < calculatedBonus) {
    console.warn(`[INSUFFICIENT_PROMOTION_CAPACITY] Not enough available numbers for promotional allocation! Free available: ${available.length}, Requested bonus: ${calculatedBonus}`);
    return;
  }

  // Shuffled and select
  const shuffled = available.sort(() => 0.5 - Math.random());
  const selectedBonus = shuffled.slice(0, calculatedBonus);

  // Update order doc in the batch
  const existingBonus = orderData.bonusNums || [];
  const mergedBonus = Array.from(new Set([...existingBonus, ...selectedBonus]));
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

  // Assign individual bonus cota markers
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
    console.log(`[BONUS_GENERATED] Bonus cota generated successfully for num: ${num} linked to order: ${orderId}`);
  });

  console.log(`[PROMOTION_APPLIED] Finished allocation of ${selectedBonus.length} bonus numbers: ${selectedBonus.join(", ")}`);
}
