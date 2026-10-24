"use client";

import { useEffect, useRef, useState } from "react";
import { firebaseConfigured, getFirebaseAuthClient } from "@/lib/firebase-client";

type Stage = "idle" | "sending" | "sent" | "verifying" | "verified";

/**
 * Checkout ka phone verification step.
 *
 * Firebase configured -> asli SMS OTP (invisible reCAPTCHA + signInWithPhoneNumber).
 * Firebase nahi -> server ka dev code (sandbox/testing), clearly labelled.
 * Verified hone par `onVerified({ phone, phoneToken })` milta hai, jise order ke saath bhejte hain.
 */
export function PhoneOtp({
  phone,
  onPhoneChange,
  onVerified,
  verified,
}: {
  phone: string;
  onPhoneChange: (value: string) => void;
  onVerified: (payload: { phone: string; phoneToken: string } | null) => void;
  verified: boolean;
}) {
  const [stage, setStage] = useState<Stage>("idle");
  const [mode, setMode] = useState<"firebase" | "dev" | "off" | null>(null);
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const recaptchaRef = useRef<HTMLDivElement | null>(null);
  const confirmationRef = useRef<unknown>(null);

  useEffect(() => {
    if (!verified) setStage("idle");
  }, [verified, phone]);

  async function sendFirebaseOtp(fullPhone: string) {
    const auth = getFirebaseAuthClient();
    if (!auth) throw new Error("Firebase initialize nahi hua.");
    const { RecaptchaVerifier, signInWithPhoneNumber } = await import("firebase/auth");
    if (!recaptchaRef.current) throw new Error("reCAPTCHA container missing.");
    const verifier = new RecaptchaVerifier(auth, recaptchaRef.current, { size: "invisible" });
    const confirmation = await signInWithPhoneNumber(auth, `+91${fullPhone}`, verifier);
    confirmationRef.current = confirmation;
  }

  async function send() {
    const fullPhone = phone.replace(/\D/g, "").slice(-10);
    if (!/^[6-9]\d{9}$/.test(fullPhone)) {
      setMessage("Valid 10-digit mobile number daaliye.");
      return;
    }
    setStage("sending");
    setMessage(null);
    try {
      const start = await fetch("/api/otp/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone }),
      });
      const payload = (await start.json()) as { mode?: "firebase" | "dev" | "off"; devCode?: string; error?: string };
      if (!start.ok) throw new Error(payload.error ?? "OTP bhejne me dikkat aayi.");
      setMode(payload.mode ?? null);

      if (payload.mode === "firebase") {
        await sendFirebaseOtp(fullPhone);
      } else if (payload.mode === "dev") {
        setDevCode(payload.devCode ?? null);
        if (!payload.devCode) {
          setMessage("OTP bhej diya gaya hai. (Is deployment par code server log me hai.)");
        }
      } else {
        setMessage("Is deployment par OTP off hai — order bina verification ke chalega.");
        onVerified(null);
        setStage("verified");
        return;
      }
      setStage("sent");
      setMessage(`OTP ${fullPhone.slice(0, 2)}****${fullPhone.slice(-2)} par bheja gaya.`);
    } catch (error) {
      setStage("idle");
      setMessage(error instanceof Error ? error.message : "OTP bhejne me dikkat aayi.");
    }
  }

  async function verify() {
    const fullPhone = phone.replace(/\D/g, "").slice(-10);
    if (!/^\d{6}$/.test(code.trim())) {
      setMessage("6-digit OTP daaliye.");
      return;
    }
    setStage("verifying");
    setMessage(null);
    try {
      let idToken: string | undefined;
      if (mode === "firebase") {
        const confirmation = confirmationRef.current as
          | { confirm: (code: string) => Promise<{ user: { getIdToken: () => Promise<string> } }> }
          | null;
        if (!confirmation) throw new Error("Pehle OTP bhejiye.");
        const credential = await confirmation.confirm(code.trim());
        idToken = await credential.user.getIdToken();
      }

      const response = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: fullPhone, idToken, code: idToken ? undefined : code.trim() }),
      });
      const payload = (await response.json()) as { phoneToken?: string; phone?: string; error?: string };
      if (!response.ok || !payload.phoneToken) throw new Error(payload.error ?? "OTP verify nahi hua.");
      onVerified({ phone: fullPhone, phoneToken: payload.phoneToken });
      setStage("verified");
      setMessage("Mobile number verified ✓");
    } catch (error) {
      setStage("sent");
      setMessage(error instanceof Error ? error.message : "OTP verify nahi hua.");
    }
  }

  return (
    <div className="sm:col-span-2" data-testid="phone-otp">
      <label className="text-[10.5px] tracking-[.12em] text-[#6b6259] uppercase" htmlFor="checkout-phone">
        Phone (WhatsApp) <span className="text-[#862222]">*</span>
      </label>
      <div className="mt-1 flex">
        <span className="flex h-11 items-center border border-r-0 border-[#ddd2c6] bg-[#f7f2ec] px-3 text-[12.5px] text-[#6b6259]">
          +91
        </span>
        <input
          id="checkout-phone"
          type="tel"
          inputMode="numeric"
          required
          maxLength={10}
          value={phone}
          disabled={stage === "sent" || stage === "verifying" || verified}
          onChange={(event) => onPhoneChange(event.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="98765 43210"
          className="h-11 w-full border border-[#ddd2c6] bg-white px-3 text-[13px] outline-none focus:border-[#862222] disabled:bg-[#faf8f5]"
        />
        {verified ? (
          <span className="flex h-11 shrink-0 items-center bg-[#e6f2e8] px-3 text-[10.5px] font-semibold tracking-[.12em] text-[#2f7a3f] uppercase">
            Verified
          </span>
        ) : (
          <button
            type="button"
            onClick={send}
            disabled={stage === "sending" || phone.replace(/\D/g, "").length !== 10}
            className="h-11 shrink-0 bg-[#222] px-3.5 text-[10.5px] font-semibold tracking-[.12em] text-white uppercase disabled:opacity-50"
          >
            {stage === "sending" ? "Sending…" : stage === "idle" ? "Send OTP" : "Resend"}
          </button>
        )}
      </div>

      {stage === "sent" || stage === "verifying" ? (
        <div className="mt-2 flex">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            placeholder="6-digit OTP"
            aria-label="One time password"
            className="h-11 w-full border border-[#ddd2c6] bg-white px-3 text-[13px] tracking-[.3em] outline-none focus:border-[#862222]"
          />
          <button
            type="button"
            onClick={verify}
            disabled={stage === "verifying" || code.length !== 6}
            className="h-11 shrink-0 bg-[#862222] px-4 text-[10.5px] font-semibold tracking-[.12em] text-white uppercase disabled:opacity-50"
          >
            {stage === "verifying" ? "Verifying…" : "Verify"}
          </button>
        </div>
      ) : null}

      {devCode ? (
        <p className="mt-1.5 text-[11px] text-[#8a6a1f]">
          Dev mode (Firebase keys nahi hain): OTP <strong>{devCode}</strong>
        </p>
      ) : null}
      {message ? (
        <p
          className={`mt-1.5 text-[11.5px] ${verified ? "text-[#2f7a3f]" : "text-[#b3261e]"}`}
          role="status"
        >
          {message}
        </p>
      ) : null}
      {!firebaseConfigured ? (
        <p className="mt-1 text-[10.5px] text-[#a49a90]">
          Firebase keys set karte hi asli SMS OTP chalu ho jaayega — docs/07-security/phone-otp.md
        </p>
      ) : null}
      <div ref={recaptchaRef} />
    </div>
  );
}
