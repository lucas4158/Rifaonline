import { initializeApp as initClientApp } from "firebase/app";
import { getFirestore as getClientFirestore, collection, getDocs } from "firebase/firestore";
import admin from "firebase-admin";
import { getFirestore as getAdminFirestore } from "firebase-admin/firestore";
import fs from "fs";
import path from "path";

// 1. Read source config (coastal-ceiling-sw1xt)
const configPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

console.log(`📡 Connecting to source Firestore (Client SDK): ${firebaseConfig.projectId} [db: ${firebaseConfig.firestoreDatabaseId}]`);
const clientApp = initClientApp(firebaseConfig, "sourceApp");
const sourceDb = getClientFirestore(clientApp, firebaseConfig.firestoreDatabaseId);

// 2. Initialize target Firestore (rifamaster-prod) via Admin SDK
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!serviceAccountJson) {
  throw new Error("FIREBASE_SERVICE_ACCOUNT env var is missing!");
}
const serviceAccount = JSON.parse(serviceAccountJson);
if (serviceAccount.private_key) {
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
}

console.log(`🔒 Connecting to target Firestore (Admin SDK): ${serviceAccount.project_id}`);
const adminApp = admin.initializeApp(
  { credential: admin.credential.cert(serviceAccount) },
  "targetApp"
);
const targetDb = getAdminFirestore(adminApp); // default database for rifamaster-prod

async function runMigration() {
  const exportData: Record<string, any[]> = {
    raffles: [],
    raffleNumbers: [],
    orders: [],
    reservations: [],
    payments: [],
    draws: [],
    winners_history: [],
  };

  const counts: Record<string, number> = {
    raffles: 0,
    raffleNumbers: 0,
    orders: 0,
    reservations: 0,
    payments: 0,
    draws: 0,
    winners_history: 0,
  };

  console.log("\n--- STEP 1: EXPORTING FROM coastal-ceiling-sw1xt ---");

  // A. Raffles and Subcollection numbers
  const rafflesSnap = await getDocs(collection(sourceDb, "raffles"));
  console.log(`Found ${rafflesSnap.size} raffles in source.`);
  for (const docSnap of rafflesSnap.docs) {
    const data = docSnap.data();
    exportData.raffles.push({ id: docSnap.id, data });
    counts.raffles++;

    // Subcollection numbers
    const numbersSnap = await getDocs(collection(sourceDb, "raffles", docSnap.id, "numbers"));
    console.log(`  Raffle "${docSnap.id}": found ${numbersSnap.size} numbers.`);
    for (const numSnap of numbersSnap.docs) {
      exportData.raffleNumbers.push({
        raffleId: docSnap.id,
        numberId: numSnap.id,
        data: numSnap.data(),
      });
      counts.raffleNumbers++;
    }
  }

  // B. Orders
  const ordersSnap = await getDocs(collection(sourceDb, "orders"));
  counts.orders = ordersSnap.size;
  console.log(`Found ${ordersSnap.size} orders in source.`);
  ordersSnap.forEach((docSnap) => {
    exportData.orders.push({ id: docSnap.id, data: docSnap.data() });
  });

  // C. Reservations
  const reservationsSnap = await getDocs(collection(sourceDb, "reservations"));
  counts.reservations = reservationsSnap.size;
  console.log(`Found ${reservationsSnap.size} reservations in source.`);
  reservationsSnap.forEach((docSnap) => {
    exportData.reservations.push({ id: docSnap.id, data: docSnap.data() });
  });

  // D. Payments
  const paymentsSnap = await getDocs(collection(sourceDb, "payments"));
  counts.payments = paymentsSnap.size;
  console.log(`Found ${paymentsSnap.size} payments in source.`);
  paymentsSnap.forEach((docSnap) => {
    exportData.payments.push({ id: docSnap.id, data: docSnap.data() });
  });

  // E. Draws
  const drawsSnap = await getDocs(collection(sourceDb, "draws"));
  counts.draws = drawsSnap.size;
  console.log(`Found ${drawsSnap.size} draws in source.`);
  drawsSnap.forEach((docSnap) => {
    exportData.draws.push({ id: docSnap.id, data: docSnap.data() });
  });

  // F. Winners History
  const winnersSnap = await getDocs(collection(sourceDb, "winners_history"));
  counts.winners_history = winnersSnap.size;
  console.log(`Found ${winnersSnap.size} winners_history in source.`);
  winnersSnap.forEach((docSnap) => {
    exportData.winners_history.push({ id: docSnap.id, data: docSnap.data() });
  });

  // Save JSON backup
  const backupPath = path.join(process.cwd(), "backup_coastal_ceiling.json");
  fs.writeFileSync(backupPath, JSON.stringify(exportData, null, 2), "utf-8");
  console.log(`\n💾 Backup saved to ${backupPath}`);

  console.log("\n--- STEP 2: IMPORTING TO rifamaster-prod ---");

  // Helper batch writer
  async function writeInBatches(items: { ref: admin.firestore.DocumentReference; data: any }[]) {
    const BATCH_SIZE = 400;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const chunk = items.slice(i, i + BATCH_SIZE);
      const batch = targetDb.batch();
      chunk.forEach((item) => batch.set(item.ref, item.data, { merge: true }));
      await batch.commit();
    }
  }

  // Write Raffles
  const raffleItems = exportData.raffles.map((item) => ({
    ref: targetDb.collection("raffles").doc(item.id),
    data: item.data,
  }));
  await writeInBatches(raffleItems);
  console.log(`✅ Imported ${raffleItems.length} raffles to rifamaster-prod.`);

  // Write Raffle Numbers
  const numberItems = exportData.raffleNumbers.map((item) => ({
    ref: targetDb.collection("raffles").doc(item.raffleId).collection("numbers").doc(item.numberId),
    data: item.data,
  }));
  await writeInBatches(numberItems);
  console.log(`✅ Imported ${numberItems.length} raffle numbers to rifamaster-prod.`);

  // Write Orders
  const orderItems = exportData.orders.map((item) => ({
    ref: targetDb.collection("orders").doc(item.id),
    data: item.data,
  }));
  await writeInBatches(orderItems);
  console.log(`✅ Imported ${orderItems.length} orders to rifamaster-prod.`);

  // Write Reservations
  const reservationItems = exportData.reservations.map((item) => ({
    ref: targetDb.collection("reservations").doc(item.id),
    data: item.data,
  }));
  await writeInBatches(reservationItems);
  console.log(`✅ Imported ${reservationItems.length} reservations to rifamaster-prod.`);

  // Write Payments
  const paymentItems = exportData.payments.map((item) => ({
    ref: targetDb.collection("payments").doc(item.id),
    data: item.data,
  }));
  await writeInBatches(paymentItems);
  console.log(`✅ Imported ${paymentItems.length} payments to rifamaster-prod.`);

  // Write Draws
  const drawItems = exportData.draws.map((item) => ({
    ref: targetDb.collection("draws").doc(item.id),
    data: item.data,
  }));
  await writeInBatches(drawItems);
  console.log(`✅ Imported ${drawItems.length} draws to rifamaster-prod.`);

  // Write Winners History
  const winnerItems = exportData.winners_history.map((item) => ({
    ref: targetDb.collection("winners_history").doc(item.id),
    data: item.data,
  }));
  await writeInBatches(winnerItems);
  console.log(`✅ Imported ${winnerItems.length} winners_history to rifamaster-prod.`);

  console.log("\n================ MIGRATION SUMMARY ================");
  console.log(`raffles: ${counts.raffles}`);
  console.log(`raffles/{id}/numbers: ${counts.raffleNumbers}`);
  console.log(`orders: ${counts.orders}`);
  console.log(`reservations: ${counts.reservations}`);
  console.log(`payments: ${counts.payments}`);
  console.log(`draws: ${counts.draws}`);
  console.log(`winners_history: ${counts.winners_history}`);
  console.log("===================================================");

  process.exit(0);
}

runMigration().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
