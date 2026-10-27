"use client";

import { useStoreSettings } from "@/components/store-settings-provider";
import { whatsappLink } from "@/lib/whatsapp";

/** WhatsApp CTA — number sheet se live, kahin hardcode nahi. */
export function WhatsAppLink({
  label = "WhatsApp us",
  className = "",
  message,
}: {
  label?: string;
  className?: string;
  message?: string;
}) {
  const { whatsapp } = useStoreSettings();
  const href = whatsappLink(message ?? "Hi! I need help with my order.", whatsapp);
  // R45: sheet me number khali = CTA dikhta hi nahi
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={className} data-testid="whatsapp-link">
      {label}
    </a>
  );
}
