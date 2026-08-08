import "dotenv/config";
import { getAdminFirestore } from "./_firebaseAdmin.js";

export default async function handler(req: any, res: any) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { numberId, sessionId, action, numbers, raffleId } = req.body;
  const targetRaffleId = raffleId || "current";

  const idsToProcess: string[] = numbers && Array.isArray(numbers) && numbers.length > 0
    ? numbers
    : numberId ? [numberId] : [];

  if (idsToProcess.length === 0 || !sessionId || !action || (action !== "lock" && action !== "unlock")) {
    return res.status(400).json({ error: "Parâmetros inválidos ou insuficientes." });
  }

  let db: any;
  try {
    db = getAdminFirestore();
  } catch (err) {
    console.error("❌ [Lock API] Failed to initialize Admin Firestore:", err);
    return res.status(500).json({ error: "Serviço de banco de dados administrativo indisponível." });
  }

  const currentNow = Date.now();
  const locksDuration = 180 * 1000; // 3 minutes selection lock

  try {
    if (action === "lock") {
      const expiresAt = currentNow + locksDuration;
      if (idsToProcess.length > 500) {
        return res.status(400).json({ error: "Limite de cotas excedido na requisição." });
      }

      // Chunk execution into batches of 100 max per transaction
      const chunkSize = 100;
      const successIds: string[] = [];
      const failures: string[] = [];

      for (let i = 0; i < idsToProcess.length; i += chunkSize) {
        const chunk = idsToProcess.slice(i, i + chunkSize);

        const chunkResult = await db.runTransaction(async (transaction: any) => {
          const lockRefs = chunk.map((num: string) => db.collection("locks").doc(num));
          const numRefs = chunk.map((num: string) =>
            db.collection("raffles").doc(targetRaffleId).collection("numbers").doc(num)
          );

          const allSnaps = await transaction.getAll(...lockRefs, ...numRefs);
          const reads = allSnaps.slice(0, lockRefs.length);
          const numReads = allSnaps.slice(lockRefs.length);

          const chunkFailures: string[] = [];
          const chunkSuccesses: string[] = [];

          for (let index = 0; index < reads.length; index++) {
            const num = chunk[index];
            const lockSnap = reads[index];
            const numSnap = numReads[index];
            let fail = false;

            if (lockSnap.exists) {
              const data = lockSnap.data();
              if (data.expiresAt > currentNow && data.sessionId !== sessionId) {
                fail = true;
              }
            }
            if (numSnap.exists) {
              const numData = numSnap.data();
              const status = (numData.status || "").toLowerCase();
              const expAt = numData.expiresAt || 0;
              const isExpired = expAt > 0 && currentNow >= expAt;

              if (status === "paid" || status === "pago") {
                fail = true;
              } else if (
                (status === "reserved" || status === "pending_payment" || status === "aguardando") &&
                !isExpired
              ) {
                if (numData.sessionId !== sessionId) fail = true;
              }
            }

            if (fail) chunkFailures.push(num);
            else chunkSuccesses.push(num);
          }

          if (chunkFailures.length > 0 && idsToProcess.length === 1) {
            throw new Error("already_locked");
          }

          chunkSuccesses.forEach((num) => {
            transaction.set(db.collection("locks").doc(num), {
              sessionId,
              expiresAt,
              raffleId: targetRaffleId,
              updatedAt: new Date().toISOString(),
            });

            transaction.set(
              db.collection("raffles").doc(targetRaffleId).collection("numbers").doc(num),
              {
                id: num,
                status: "reserved",
                sessionId: sessionId,
                expiresAt: expiresAt,
                updatedAt: new Date().toISOString(),
              },
              { merge: true }
            );
          });

          return { chunkSuccesses, chunkFailures };
        });

        successIds.push(...chunkResult.chunkSuccesses);
        failures.push(...chunkResult.chunkFailures);
      }

      console.log(`[LOCK_CREATED] Session ${sessionId} locked numbers: ${successIds.join(", ")}`);
      return res.status(200).json({
        success: true,
        lockedNumbers: successIds,
        failedNumbers: failures,
        expiresAt,
      });

    } else if (action === "unlock") {
      // Chunk execution into batches of 100 max per transaction
      const chunkSize = 100;

      for (let i = 0; i < idsToProcess.length; i += chunkSize) {
        const chunk = idsToProcess.slice(i, i + chunkSize);

        await db.runTransaction(async (transaction: any) => {
          const lockRefs = chunk.map((num: string) => db.collection("locks").doc(num));
          const numRefs = chunk.map((num: string) =>
            db.collection("raffles").doc(targetRaffleId).collection("numbers").doc(num)
          );

          const allSnaps = await transaction.getAll(...lockRefs, ...numRefs);
          const reads = allSnaps.slice(0, lockRefs.length);
          const numReads = allSnaps.slice(lockRefs.length);

          reads.forEach((lockSnap: any, index: number) => {
            const num = chunk[index];
            if (lockSnap.exists) {
              const data = lockSnap.data();
              // Validate session ownership or TTL expiry
              if (data.sessionId === sessionId || data.expiresAt <= currentNow) {
                transaction.delete(db.collection("locks").doc(num));
              }
            }
          });

          numReads.forEach((numSnap: any, index: number) => {
            const num = chunk[index];
            if (numSnap.exists) {
              const data = numSnap.data();
              const status = (data.status || "").toLowerCase();
              const isReservedOrPending =
                status === "reserved" || status === "pending_payment" || status === "aguardando";

              // Validate session ownership or TTL expiry & NEVER delete paid numbers
              if (
                isReservedOrPending &&
                (data.sessionId === sessionId || data.expiresAt <= currentNow)
              ) {
                transaction.delete(
                  db.collection("raffles").doc(targetRaffleId).collection("numbers").doc(num)
                );
              }
            }
          });
        });
      }

      console.log(`[LOCK_RELEASED] Session ${sessionId} released/unlocked numbers: ${idsToProcess.join(", ")}`);
      return res.status(200).json({ success: true, message: "Liberação concluída." });
    }
  } catch (err: any) {
    if (err.message === "already_locked") {
      return res.status(409).json({
        error: "already_locked",
        message: "Desculpe, este número acabou de ser reservado ou comprado por outro usuário!",
      });
    }
    const errStr = String(err) + " " + String(err?.message || "");
    if (errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("Quota exceeded") || err?.code === 8) {
      console.warn("⚠️ [Lock API] Quota limit hit on Firestore:", errStr);
      return res.status(429).json({
        error: "quota_exceeded",
        message: "Limite diário do banco de dados atingido. Tente novamente em alguns instantes.",
      });
    }
    console.error("❌ [Lock API] Internal Error:", err);
    return res.status(500).json({ error: "Erro interno no servidor ao processar lock/unlock." });
  }
}
