/**
 * Seed and Deterministic Draw Cryptographic Utilities for RifaMaster v2
 * 
 * Provides:
 * 1. Pure TypeScript SHA-256 hash function (compatible with both Node.js and browser).
 * 2. Deterministic pseudo-random number generator (PRNG) using SHA-256 with counter (counter-based PRNG).
 * 3. Deterministic Fisher-Yates shuffle for sorting-agnostic, reproducible winner draws.
 */

/**
 * Pure TypeScript implementation of the SHA-256 cryptographic hash algorithm.
 * This guarantees identical outputs on any JS/TS environment with zero dependencies.
 */
export function sha256(ascii: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }
  
  const words: number[] = [];
  const asciiLength = ascii.length;
  for (let i = 0; i < asciiLength; i++) {
    words[i >> 2] |= (ascii.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  
  words[asciiLength >> 2] |= 0x80 << (24 - (asciiLength % 4) * 8);
  const wordsLength = ((asciiLength + 8) >> 6) * 16 + 14;
  while (words.length < wordsLength) words.push(0);
  words.push(0);
  words.push(asciiLength * 8);
  
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  const k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  for (let i = 0; i < words.length; i += 16) {
    const w = words.slice(i, i + 16);
    while (w.length < 64) {
      const s0 = rightRotate(w[w.length - 15], 7) ^ rightRotate(w[w.length - 15], 18) ^ (w[w.length - 15] >>> 3);
      const s1 = rightRotate(w[w.length - 2], 17) ^ rightRotate(w[w.length - 2], 19) ^ (w[w.length - 2] >>> 10);
      w.push((w[w.length - 16] + s0 + w[w.length - 7] + s1) | 0);
    }
    
    let [a, b, c, d, e, f, g, h] = hash;
    for (let j = 0; j < 64; j++) {
      const S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + k[j] + w[j]) | 0;
      const S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;
      
      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }
    
    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }
  
  return hash.map(h => ("00000000" + (h >>> 0).toString(16)).slice(-8)).join("");
}

/**
 * Deterministic PRNG using a counter-based SHA-256 generator.
 */
export class SeededPRNG {
  private seed: string;
  private counter: number = 0;

  constructor(seed: string) {
    this.seed = seed;
  }

  /**
   * Generates a deterministic pseudo-random unsigned 32-bit integer.
   */
  public nextUint32(): number {
    const combinedInput = `${this.seed}:${this.counter}`;
    const hashHex = sha256(combinedInput);
    this.counter++;
    // Extract first 8 hex chars (32 bits) and convert to integer
    return parseInt(hashHex.slice(0, 8), 16);
  }

  /**
   * Generates a pseudo-random integer within the range [min, max] (inclusive).
   */
  public nextInt(min: number, max: number): number {
    const range = max - min + 1;
    if (range <= 0) return min;
    const randVal = this.nextUint32();
    return min + (randVal % range);
  }
}

/**
 * Normalizes a list of sold/paid numbers to ensure sorting stability, 
 * then shuffles them deterministically using the Fisher-Yates algorithm and SeededPRNG.
 * 
 * @param array Array of items to shuffle.
 * @param seed The unique cryptographic seed of the raffle.
 * @returns A new shuffled array.
 */
export function deterministicShuffle<T>(array: T[], seed: string): T[] {
  if (!array || array.length === 0) return [];
  
  // Create a sorted copy of the array to guarantee canon order.
  // We sort either numerically or lexicographically depending on input types.
  const canonical = [...array].sort((a, b) => {
    const strA = String(a).trim();
    const strB = String(b).trim();
    
    // Attempt numerical sorting if both are numeric
    const numA = Number(strA);
    const numB = Number(strB);
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB;
    }
    
    // Lexicographical sorting fallback
    return strA.localeCompare(strB);
  });

  const prng = new SeededPRNG(seed);
  const shuffled = [...canonical];
  
  // Classic Fisher-Yates Shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = prng.nextInt(0, i);
    // Swap elements i and j
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }

  return shuffled;
}

/**
 * Calculates a SHA-256 commitment hash of a seed value.
 * Used for publicly proving a seed was set before drawing, without exposing the seed.
 */
export function getSeedCommitment(seed: string): string {
  return sha256(seed);
}
