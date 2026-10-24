import test from "node:test";
import assert from "node:assert/strict";
import {
  deliveryStates,
  evaluatePincode,
  isPincodeFormat,
  lookupPincode,
  normalizePincode,
  pincodeCount,
} from "../../apps/web/src/lib/pincodes.ts";

/**
 * Delivery serviceability — asli India Post data par.
 * Yahan "kuch bhi number daal do" wala bug pakda jaata hai.
 */

const baseRules = {
  allowAllStates: true,
  states: {} as Record<string, boolean>,
  blockedPincodes: [] as { pincode: string }[],
  allowedPincodes: [] as { pincode: string }[],
  deliveryDays: "4-7 business days",
};

test("pincode dataset India Post ka hai (19k+ pincodes, 36 states)", () => {
  assert.ok(pincodeCount() > 19_000, `only ${pincodeCount()} pincodes`);
  assert.ok(deliveryStates.length >= 36);
  assert.deepEqual(lookupPincode("302001"), { state: "Rajasthan", district: "Jaipur" });
  assert.deepEqual(lookupPincode("400001"), { state: "Maharashtra", district: "Mumbai" });
});

test("faltu pincode deliverable nahi hota", () => {
  for (const fake of ["123456", "999999", "000000", "3020", "abcdef"]) {
    const result = evaluatePincode(fake, baseRules);
    assert.equal(result.serviceable, false, `${fake} accept ho gaya`);
  }
  // 5 digit / leading zero = invalid format
  const short = evaluatePincode("30200", baseRules);
  assert.equal(short.reason, "invalid");
});

test("valid pincode deliverable (default: sab states allowed)", () => {
  const result = evaluatePincode("302001", baseRules);
  assert.equal(result.serviceable, true);
  assert.equal(result.state, "Rajasthan");
  assert.equal(result.district, "Jaipur");
  assert.equal(result.deliveryDays, "4-7 business days");
});

test("normalizePincode sirf digits rakhta hai", () => {
  assert.equal(normalizePincode(" 302 001 "), "302001");
  assert.equal(normalizePincode("3020011234"), "302001");
  assert.equal(isPincodeFormat("012345"), false);
  assert.equal(isPincodeFormat("302001"), true);
});

test("admin sirf Rajasthan allow kare to Gujarat ka pincode band", () => {
  const rules = { ...baseRules, allowAllStates: false, states: { Rajasthan: true } };
  assert.equal(evaluatePincode("302001", rules).serviceable, true);
  const gujarat = evaluatePincode("380001", rules);
  assert.equal(gujarat.serviceable, false);
  assert.equal(gujarat.reason, "state_blocked");
  assert.match(gujarat.message, /Gujarat/);
});

test("admin ka blocked pincode state allowed hone par bhi band rehta hai", () => {
  const rules = { ...baseRules, blockedPincodes: [{ pincode: "302001" }] };
  const result = evaluatePincode("302001", rules);
  assert.equal(result.serviceable, false);
  assert.equal(result.reason, "blocked");
  // baaki Jaipur pincodes chalte rahenge
  assert.equal(evaluatePincode("302002", rules).serviceable, true);
});

test("allowed override blocked state me bhi kaam karta hai", () => {
  const rules = {
    ...baseRules,
    allowAllStates: false,
    states: { Rajasthan: true },
    allowedPincodes: [{ pincode: "400001" }],
  };
  assert.equal(evaluatePincode("400001", rules).serviceable, true);
  assert.equal(evaluatePincode("400002", rules).serviceable, false);
});

test("block list allowed override se jeetti hai", () => {
  const rules = {
    ...baseRules,
    blockedPincodes: [{ pincode: "400001" }],
    allowedPincodes: [{ pincode: "400001" }],
  };
  const result = evaluatePincode("400001", rules);
  assert.equal(result.serviceable, false);
  assert.equal(result.reason, "blocked");
});
