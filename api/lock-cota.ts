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

  const idsToProcess = numbers && Array.isArray(numbers) && numbers.length > 0
    ? numbers
    : numberId ? [numberId] : [];

  if (idsToProcess.length === 0 || !sessionId || !action || (action !== "lock" && action !== "unlock")) {
    return res.status(400).json({ error: "Parâmetros inválidos ou insuficientes." });
  }

  let db;
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

      const resultArr = await db.runTransaction(async (transaction: any) => {
        const lockRefs = idsToProcess.map((num: string) => db.collection("locks").doc(num));
        const numRefs = idsToProcess.map((num: string) => db.collection("raffles").doc(targetRaffleId).collection("numbers").doc(num));
        
        const allSnaps = await transaction.getAll(...lockRefs, ...numRefs);
        const reads = allSnaps.slice(0, lockRefs.length);
        const numReads = allSnaps.slice(lockRefs.length);
        
        const failures: string[] = [];
        const successIds: string[] = [];
        
        for (let index = 0; index < reads.length; index++) {
           const num = idsToProcess[index];
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
             } else if ((status === "reserved" || status === "pending_payment" || status === "aguardando") && !isExpired) {
                 if (numData.sessionId !== sessionId) fail = true;
             }
           }

           if (fail) failures.push(num);
           else successIds.push(num);
        }

        if (failures.length > 0 && idsToProcess.length === 1) { // Single failure logic
             throw new Error("already_locked");
        }

        // Lock all successes
        successIds.forEach((num) => {
            transaction.set(db.collection("locks").doc(num), {
               sessionId,
               expiresAt,
               raffleId: targetRaffleId,
               updatedAt: new Date().toISOString()
            });

            // Update the nested scalable Raffle Number
            transaction.set(db.collection("raffles").doc(targetRaffleId).collection("numbers").doc(num), {
              id: num,
              status: "reserved",
              sessionId: sessionId,
              expiresAt: expiresAt,
              updatedAt: new Date().toISOString()
            }, { merge: true });
        });

        return { successIds, failures, expiresAt };
      });

      console.log(`[LOCK_CREATED] Session ${sessionId} locked numbers: ${resultArr.successIds.join(", ")}`);
      console.log(`🔒 [Lock API] Locked ${resultArr.successIds.length} cotas for session ${sessionId}`);

      return res.status(200).json({ 
         success: true, 
         lockedNumbers: resultArr.successIds, 
         failedNumbers: resultArr.failures, 
         expiresAt: resultArr.expiresAt 
       });

    } else if (action === "unlock") {
        await db.runTransaction(async (transaction: any) => {
            const lockRefs = idsToProcess.map((num: string) => db.collection("locks").doc(num));
            const numRefs = idsToProcess.map((num: string) => db.collection("raffles").doc(targetRaffleId).collection("numbers").doc(num));
            
            const allSnaps = await transaction.getAll(...lockRefs, ...numRefs);
            const reads = allSnaps.slice(0, lockRefs.length);
            const numReads = allSnaps.slice(lockRefs.length);

            reads.forEach((lockSnap: any, index: number) => {
                const num = idsToProcess[index];
                if (lockSnap.exists) {
                    const data = lockSnap.data();
                    if (data.sessionId === sessionId || data.expiresAt <= currentNow) { 
                         transaction.delete(db.collection("locks").doc(num));
                    }
                }
            });
            
            numReads.forEach((numSnap: any, index: number) => {
                const num = idsToProcess[index];
                if (numSnap.exists) {
                    const data = numSnap.data();
                    const status = (data.status || "").toLowerCase();
                    const isReservedOrPending = status === "reserved" || status === "pending_payment" || status === "aguardando";
                    
                    if (isReservedOrPending && (data.sessionId === sessionId || data.expiresAt <= currentNow)) { 
                         transaction.delete(db.collection("raffles").doc(targetRaffleId).collection("numbers").doc(num));
                    }
                }
            });
        });
      console.log(`[LOCK_RELEASED] Session ${sessionId} released/unlocked numbers: ${idsToProcess.join(", ")}`);
      return res.status(200).json({ success: true, message: "Liberação concluída." });
    }
  } catch (err: any) {
    if (err.message === "already_locked") {
       return res.status(409).json({ error: "already_locked", message: "Desculpe, este número acabou de ser reservado ou comprado por outro usuário!" });
    }
    const errStr = String(err) + " " + String(err?.message || "");
    if (errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("Quota exceeded") || err?.code === 8) {
       console.warn("⚠️ [Lock API] Quota limit hit on Firestore:", errStr);
       return res.status(429).json({
          error: "quota_exceeded",
          message: "Limite diário do banco de dados atingido. Tente novamente em alguns instantes."
        });
    }
    console.error("❌ [Lock API] Internal Error:", err);
    return res.status(500).json({ error: "Erro interno no servidor ao processar lock/unlock." });
  }
}
