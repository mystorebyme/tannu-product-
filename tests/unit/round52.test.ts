import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * R52 (owner):
 *  "Send order on WhatsApp ye press krte hi direct whatsapp hi khule ok kisi api
 *   se load na hi dabate hai whatshap aajana chiye or website pr background mai
 *   processi chlta rhe order number vhara ye sb … or custumer whatshap pr pauch
 *   jaye instant or fir agr website aakr dekhe to usko vha pr vo order created
 *   placed hua dikhe"
 *
 * Matlab:
 *  1. tap → WhatsApp INSTANT khule (poori selection message me) — beech me
 *     "Placing your order… please wait" jaisa koi API-load gate nahi;
 *  2. order number / sheet save website par BACKGROUND me chale;
 *  3. customer website par wapas aaye to order created/placed dikhe
 *     (step 3 "Order placed!" + number + tracking link).
 */

const root = process.cwd();
const read = (file: string) => fs.readFileSync(path.join(root, file), "utf8");
const FORM = "apps/web/src/components/checkout-form.tsx";
const form = read(FORM);
const submitBody = form.slice(form.indexOf("async function submit("));

test("R52: press karte hi WhatsApp — instant open, poora selection, zero API wait", () => {
  // instant message local state se banta hai — order number ke bina (wo abhi bana nahi hota)
  assert.match(form, /function orderWhatsAppHref\(target\?: string\): string/, "order number optional hai");
  assert.match(form, /target \? `Order number: \*\$\{target\}\*` : ""/, "bina number ke message me number line nahi");
  assert.match(submitBody, /const instantWaHref = orderWhatsAppHref\(\);/, "instant message tap par banta hai");
  // open synchronously user gesture me — order API ke await se pehle
  const openAt = submitBody.indexOf("const waOpened = openWhatsAppNow(instantWaHref)");
  const awaitAt = submitBody.indexOf("await postJson");
  assert.ok(openAt > -1 && awaitAt > openAt, "WhatsApp API await se PEHLE khulta hai");
  // helper seedha final wa.me URL kholta hai — blank tab + wait wala beech ka step nahi
  assert.match(form, /return Boolean\(window\.open\(href, "_blank"\)\)/, "seedha wa.me link naye tab me");
  assert.ok(!form.includes("WhatsApp will open here in a moment"), "purani wait copy kahin nahi");
});

test("R52: order background me banta rehta hai — number, sheet save, tracking", () => {
  // POST instant-open ke BAAD background me (customer tab tak WhatsApp par hai)
  assert.match(submitBody, /const result = await postJson<\{ orderNumber\?: string; error\?: string \}>\(/);
  assert.match(submitBody, /headers: \{ "Idempotency-Key": idempotencyKey \}/, "double-click se do order nahi");
  // number aate hi step 3 placed; WhatsApp already khula ho to dobara tab nahi
  assert.match(submitBody, /goToPlaced\(result\.data\.orderNumber, waOpened \? undefined : waHref \|\| undefined\)/);
  // snapshot + saved details + tracking events barkaraar
  assert.match(submitBody, /savePlacedOrder\(\{/);
  assert.match(submitBody, /saveCheckoutDetails\(form\)/);
  assert.match(submitBody, /trackCheckout\("order\.placed"/);
});

test("R52: website par wapas aane par order created/placed dikhta hai", () => {
  assert.match(form, /Order placed!/, "step 3 heading");
  assert.match(form, /data-testid="placed-order-number"/, "order number dikhta hai");
  assert.match(form, /href=\{`\/orders\/\$\{encodeURIComponent\(orderNumber \?\? ""\)\}`\}/, "View order details link");
  // placed URL refresh/share par bhi step 3 khulta hai; back par review snapshot
  assert.match(form, /window\.history\.pushState\(\{\}, "", placedUrl\(target\)\)/);
  assert.match(form, /has been received\. WhatsApp should have opened with your complete order details/, "placed copy");
});

test("R52: WhatsApp ja chuka + website save fail — reassuring copy, retry, resend link", () => {
  assert.match(form, /function waAlreadySentCopy\(\): string/);
  assert.match(form, /have already reached us on WhatsApp/, "detail team tak pahunch gayi — customer dare nahi");
  assert.match(submitBody, /setError\(waOpened \? waAlreadySentCopy\(\) : message\)/, "API-error path par");
  assert.match(submitBody, /setError\(\s*waOpened\s*\? waAlreadySentCopy\(\)/, "network-fail path par");
  // fallback link = wahi instant message (ek tap me dobara WhatsApp)
  assert.match(submitBody, /setFallbackHref\(instantWaHref \|\| whatsappOrderLink\(\)\)/);
});

test("R52: background saving ka label sach bolta hai — WA khula to 'saving', warna 'sending'", () => {
  assert.match(submitBody, /waOpenedRef\.current = waOpened;/);
  assert.match(
    form,
    /waOpenedRef\.current\s*\?\s*"Saving your order… WhatsApp has your details"\s*: "Sending your order…"/,
    "submitting label instant-open ke hisaab se",
  );
});

test("R52: WhatsApp number sheet se hi — R45 rule barkaraar, koi hardcode nahi", () => {
  assert.match(form, /const \{ whatsapp \} = useStoreSettings\(\)/);
  assert.ok(!form.includes("8005900581"), "koi hardcoded number nahi");
  assert.match(form, /orderWhatsAppHref\(target\?: string\): string \{\s*const wa = whatsappNumber\(whatsapp\);/, "number sheet settings se normalize hota hai");
});
