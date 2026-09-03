import "dotenv/config";
import { getAdminFirestore, isAdminInitialized } from "./_firebaseAdmin.js";

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

  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ error: "orderId é obrigatório." });
  }

  if (!isAdminInitialized()) {
    return res.status(500).json({ error: "Banco de dados não inicializado." });
  }

  try {
    const adminDb = getAdminFirestore();
    const orderDoc = await adminDb.collection("orders").doc(orderId).get();

    if (!orderDoc.exists) {
      return res.status(404).json({ error: "Pedido não encontrado." });
    }

    const orderData = orderDoc.data();
    const name = orderData?.name || "Cliente";
    const phone = orderData?.phone || "";
    const nums = orderData?.nums || [];
    const totalAmount = Number(orderData?.val || 0);
    const status = orderData?.status || "Aguardando";

    console.log(`📠 [Receipt API] Processing authoritative receipt for Order ID: ${orderId} (Client: ${name})`);

    await adminDb.collection("receipts").doc(orderId).set({
      orderId,
      name,
      phone,
      nums,
      totalAmount,
      status,
      submittedAt: new Date().toISOString()
    }, { merge: true });

    const extWebhookUrl = process.env.RECEIPT_WEBHOOK_URL;
    if (extWebhookUrl && extWebhookUrl.startsWith("http")) {
      try {
        await fetch(extWebhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "receipt_submitted",
            orderId,
            name,
            phone,
            nums,
            totalAmount,
            status,
            timestamp: new Date().toISOString()
          })
        });
      } catch (webErr: any) {
        console.error(`❌ [Receipt API] Failed to forward webhook:`, webErr?.message || webErr);
      }
    }

    return res.status(200).json({
      success: true,
      message: "Comprovante enviado com sucesso para o administrador!"
    });
  } catch (err: any) {
    console.error("❌ [Receipt API] Error processing receipt:", err);
    return res.status(500).json({ error: "Erro interno ao processar comprovante." });
  }
}
