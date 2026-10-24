# UPI payments — seedha owner ke account me

Koi Razorpay/third-party gateway nahi. Customer order place karta hai, order page par
**UPI QR + UPI ID + exact amount** milta hai, pay karke **UTR / reference** daalta hai;
admin verify karke order confirm karta hai.

## Flow

1. **Checkout** — address + OTP (Firebase) → `POST /api/orders` → order `paymentStatus: "pending"`.
2. **Payment page** (`/orders/LK-…`) — QR (`qrcode`, browser me banta hai) + `upi://pay` deep link,
   amount pehle se bhara hua. GitHub Pages par bhi QR chalta hai (koi API nahi chahiye).
3. **Reference submit** — `POST /api/payments/manual {orderNumber, reference, phoneLast4}`
   → order par reference + audit entry, Google Sheet me `payment.reference_submitted` row.
4. **Admin verify** — admin panel → order → *Mark payment verified* → `payment.paid`,
   status `placed → confirmed`, sheet me `payment.paid` row.
5. Customer ko order page par "Payment received" card + WhatsApp confirmation.

## Security

- Reference submit ke liye order ka **phone last 4** (ya OTP token) match hona zaroori hai —
  koi order number guess karke kisi aur ke order me UTR nahi daal sakta.
- `paid` status sirf admin action set kar sakta hai; API se "success" nahi bheja ja sakta.
- UPI ID config: Google Sheet `upi_id` > admin settings > `STORE_UPI_ID` env > default.

## Static preview (GitHub Pages)

Pages par server nahi hai, isliye:

- Checkout **WhatsApp order** banata hai (poora item list + total + address) — network error nahi.
- Order page / UTR form ki jagah **WhatsApp screenshot** button.
- Repo → Settings → Variables → Actions me `STORE_API_URL` set ho to Pages seedha
  Render API par jaata hai aur poora flow chalta hai (`NEXT_PUBLIC_API_BASE_URL`).
