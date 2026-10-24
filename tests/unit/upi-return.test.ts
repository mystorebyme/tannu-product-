import test from "node:test";
import assert from "node:assert/strict";
import {
  referenceFromReturnQuery,
  returnLooksSuccessful,
  signUpiReturn,
  upiReturnCallbackUrl,
  verifyUpiReturn,
} from "../../apps/web/src/lib/upi-return";

test("UPI return token order ke saath bind hota hai", () => {
  const token = signUpiReturn("LK-ABC123");
  assert.ok(verifyUpiReturn("LK-ABC123", token));
  assert.ok(verifyUpiReturn("lk-abc123", token), "case-insensitive order number");
  assert.equal(verifyUpiReturn("LK-OTHER1", token), false);
  assert.equal(verifyUpiReturn("LK-ABC123", ""), false);
  assert.equal(verifyUpiReturn("LK-ABC123", "hacked"), false);
});

test("secret badalne par purana token invalid ho jaata hai", () => {
  const token = signUpiReturn("LK-ABC123", "secret-one");
  assert.equal(verifyUpiReturn("LK-ABC123", token, "secret-two"), false);
});

test("callback URL site base + signed token deta hai", () => {
  const url = upiReturnCallbackUrl("https://designerclothes.in/", "LK-ABC123", "tok123");
  assert.equal(url, "https://designerclothes.in/orders/LK-ABC123?upi=return&t=tok123");
});

test("UPI app ke query params se reference nikalta hai", () => {
  assert.equal(referenceFromReturnQuery(new URLSearchParams("txnId=416123456789&txnStatus=SUCCESS")), "416123456789");
  assert.equal(referenceFromReturnQuery(new URLSearchParams("approvalRefNo=abc-123-xyz")), "ABC-123-XYZ");
  assert.equal(referenceFromReturnQuery(new URLSearchParams("upi=return&t=token")), null);
});

test("failure status auto-confirm nahi karta, success/manual return karta hai", () => {
  assert.equal(returnLooksSuccessful(new URLSearchParams("txnStatus=SUCCESS")), true);
  assert.equal(returnLooksSuccessful(new URLSearchParams("status=SUCCESSFUL")), true);
  assert.equal(returnLooksSuccessful(new URLSearchParams("")), true, "status na ho to return hi signal hai");
  for (const failed of ["FAILURE", "FAILED", "DECLINED", "PENDING"]) {
    assert.equal(returnLooksSuccessful(new URLSearchParams(`txnStatus=${failed}`)), false, failed);
  }
});
