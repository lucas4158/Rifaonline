/**
 * Cryptographic and Deterministic Reproducibility Verification Suite
 * Tests:
 * D) Executar o mesmo sorteio duas vezes com os mesmos dados → mesmo resultado.
 * E) Alterar a lista de participantes → resultado potencialmente diferente.
 * F) Alterar o seed → resultado diferente.
 * G) Verificar SHA-256(seed) → deve corresponder ao seedCommitment.
 */

import { deterministicShuffle, getSeedCommitment, sha256 } from "./src/utils/seed.js";
import crypto from "crypto";

console.log("======================================================================");
console.log("🧪 RUNNING COMPLIANCE CRYPTOGRAPHIC & REPRODUCIBILITY VERIFICATION SUITE");
console.log("======================================================================\n");

function runTests() {
  let passed = true;

  // Test 1: Generate seeds and check if they are cryptographically secure and unique
  console.log("🔹 Test A/B/C: Seed Uniqueness and Commitment verification...");
  const seed1 = crypto.randomBytes(32).toString("hex");
  const seed2 = crypto.randomBytes(32).toString("hex");
  
  if (seed1 === seed2) {
    console.error("❌ FAIL: Two separately generated seeds are identical! (Not secure)");
    passed = false;
  } else {
    console.log("✅ PASS: Seeds are uniquely generated.");
  }

  const commitment1 = getSeedCommitment(seed1);
  const calculatedCommitment1 = sha256(seed1);
  if (commitment1 !== calculatedCommitment1) {
    console.error("❌ FAIL: getSeedCommitment(seed) does not match sha256(seed) output.");
    passed = false;
  } else {
    console.log("✅ PASS: Seed commitment corresponds exactly to SHA-256(seed).");
  }

  // Test 2: Reproducibility of draw (Test D)
  console.log("\n🔹 Test D: Execution of draw twice with identical parameters...");
  const baseParticipants = ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  
  const draw1 = deterministicShuffle(baseParticipants, seed1);
  const draw2 = deterministicShuffle(baseParticipants, seed1);

  if (JSON.stringify(draw1) !== JSON.stringify(draw2)) {
    console.error("❌ FAIL: Two drawing operations with identical seed and participants yielded different results!");
    passed = false;
  } else {
    console.log("✅ PASS: Draw is 100% reproducible and deterministic.");
    console.log(`   Winner number: "${draw1[0]}" (Represents deterministic index 0)`);
  }

  // Test 3: Alter participant list yields potentially different results (Test E)
  console.log("\n🔹 Test E: Altering participants list change outcomes...");
  const modifiedParticipants = [...baseParticipants, "13", "14", "15"];
  const drawModified = deterministicShuffle(modifiedParticipants, seed1);
  
  console.log(`   Original winner: "${draw1[0]}", Modified list winner: "${drawModified[0]}"`);
  // Even if they happen to end up matching, the whole shuffle array should be different due to the nature of the Fisher-Yates mapping of PRNG index bounds
  if (JSON.stringify(draw1) === JSON.stringify(drawModified)) {
    console.warn("⚠️ Warning: Shuffled lists are identical. While mathematically possible on tiny sets, this is extremely rare.");
  } else {
    console.log("✅ PASS: Altering the participant database changes the canonical shuffle map successfully.");
  }

  // Test 4: Alter seed yields different results (Test F)
  console.log("\n🔹 Test F: Altering the cryptographic seed change outcomes...");
  const drawWithDifferentSeed = deterministicShuffle(baseParticipants, seed2);
  console.log(`   Seed 1 winner: "${draw1[0]}", Seed 2 winner: "${drawWithDifferentSeed[0]}"`);
  
  if (JSON.stringify(draw1) === JSON.stringify(drawWithDifferentSeed)) {
    console.error("❌ FAIL: Shuffled outputs with two completely different seeds are identical!");
    passed = false;
  } else {
    console.log("✅ PASS: Altering the cryptographic seed changes the winner shuffle correctly.");
  }

  console.log("\n======================================================================");
  if (passed) {
    console.log("🎉 SUCCESS: ALL CRYPTOGRAPHIC DETERMINISTIC PROPERTIES AND REPRODUCIBILITY GUARANTEES ARE VALIDATED!");
  } else {
    console.error("❌ FAILURE: One or more cryptographic verification tests failed!");
    process.exit(1);
  }
  console.log("======================================================================\n");
}

runTests();
