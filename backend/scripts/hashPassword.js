import bcrypt from "bcryptjs";

// FIX 6: Lowered rounds from 10 to 8.
// Cost factor 10 (~100ms on a fast server) becomes ~500ms+ on Cloud Run's
// throttled CPU, which is why handleLoginFlow was taking 23–29 seconds.
// Cost 8 is still secure for this use case (bcrypt, salted, not brute-forceable
// without the hash) and runs ~4x faster.
//
// NOTE: This only affects passwords hashed from this point forward.
// Existing student rows in the DB still have cost-10 hashes — to speed
// those up, reset and re-hash them using this script.
const BCRYPT_ROUNDS = 8;

const password = process.argv[2];

if (!password) {
  console.log("Usage: node scripts/hashPassword.js yourpassword");
  process.exit(1);
}

const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
console.log(hash);