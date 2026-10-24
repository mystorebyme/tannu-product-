import { createDevCode, otpMode } from "@/lib/otp";

export const dynamic = "force-dynamic";

/**
 * POST /api/otp/start { phone }
 *
 * - Firebase mode: client khud SMS bhejta hai (SDK), is route se sirf mode pata chalta hai.
 * - Dev mode: server 6-digit code banata hai. Code response me sirf non-production me
 *   jaata hai — production me kabhi nahi (warna OTP ka matlab hi nahi raha).
 */
export async function POST(request: Request) {
  let body: { phone?: string };
  try {
    body = (await request.json()) as { phone?: string };
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const phone = (body.phone ?? "").replace(/\D/g, "").slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone)) {
    return Response.json({ error: "Valid 10-digit mobile number daaliye." }, { status: 400 });
  }

  const mode = otpMode();
  if (mode === "off") {
    return Response.json({ mode, phone, message: "OTP is disabled on this deployment." });
  }
  if (mode === "firebase") {
    return Response.json({ mode, phone });
  }

  const code = createDevCode(phone);
  // Code response me sirf tab jaata hai jab build production ka na ho aur OTP_DEV_MODE ne
  // explicitly block na kiya ho. Deployed site par OTP kabhi screen par nahi aata.
  const expose = process.env.NODE_ENV !== "production" && process.env.OTP_DEV_MODE !== "off";
  console.info(`[otp:dev] ${phone.slice(0, 2)}****${phone.slice(-2)} code ${expose ? code : "hidden"}`);
  return Response.json({ mode, phone, ...(expose ? { devCode: code } : {}) });
}
