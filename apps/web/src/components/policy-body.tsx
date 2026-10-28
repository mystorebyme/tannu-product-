"use client";

import { useStoreSettings } from "@/components/store-settings-provider";
import { whatsappNumber } from "@/lib/phone";
import { renderMarkdown } from "@/lib/markdown";

/**
 * R53 (owner): "agr sheet mai number change kru to instant sabhi jgho pr number
 * change ho jana chiye ok khi pr bi hard code nhai ho ye hai main baat".
 *
 * Policy text me WhatsApp number **placeholder** (`{{WHATSAPP}}`) hai — live
 * number sheet settings se aata hai (jahan se header/footer/PDP/checkout ka
 * number aata hai). Sheet me number badalte hi policy pages par bhi turant naya
 * number (settings ki TTL ke andar). Number khali ho to sentence bina number ke
 * padha jaata hai aur "WhatsApp:" jaisi adhoori line hat jaati hai (R45 rule:
 * number set nahi = customer ko number dikhata hi nahi).
 */
export function PolicyBody({ markdown }: { markdown: string }) {
  const { whatsapp } = useStoreSettings();
  const number = whatsappNumber(whatsapp);
  const withNumber = markdown.replace(/ ?\{\{WHATSAPP\}\}/g, number ? ` ${number}` : "");
  const text = number
    ? withNumber
    : withNumber.replace(/^[ \t]*WhatsApp:[ \t]*$/gm, "").replace(/\n{3,}/g, "\n\n");
  return <article className="border border-[#eee6de] p-6 sm:p-9">{renderMarkdown(text)}</article>;
}
