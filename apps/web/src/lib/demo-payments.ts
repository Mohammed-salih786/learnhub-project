export type PlanKey = "monthly" | "yearly";
export type DemoPlan = { key: PlanKey; name: string; price: number; durationDays: number };
export const DEMO_PLANS: DemoPlan[] = [
  { key: "monthly", name: "Monthly", price: 499, durationDays: 30 },
  { key: "yearly", name: "Yearly", price: 3999, durationDays: 365 }
];
export type DemoPayment = { id: string; planKey: PlanKey; amount: number; method: string; last4?: string; status: "success" | "failed"; createdAt: string; invoiceNo: string; subtotal: number; discount: number; tax: number };
export type DemoBilling = { currentSubscription: { planKey: PlanKey; status: "active" | "cancelled"; startedAt: string; renewsAt: string } | null; payments: DemoPayment[]; coupon: string | null };
const KEY = "learnhub-demo-billing-v1";
let memory: DemoBilling = { currentSubscription: null, payments: [], coupon: null };
function read(): DemoBilling {
  try { const raw = localStorage.getItem(KEY); if (raw) memory = JSON.parse(raw) as DemoBilling; } catch { /* use in-memory copy */ }
  return memory;
}
function write(value: DemoBilling) { memory = value; try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { /* keep in memory */ } }
export function getBilling() { return read(); }
export function setCoupon(code: string | null) { const data = read(); data.coupon = code; write(data); return data; }
export function startPayment() { return new Promise<void>((resolve) => window.setTimeout(resolve, 1000 + Math.floor(Math.random() * 1000))); }
export function completePayment(payment: DemoPayment) {
  const plan = DEMO_PLANS.find((item) => item.key === payment.planKey)!;
  const started = new Date(); const end = new Date(started); end.setDate(end.getDate() + plan.durationDays);
  const data = read(); data.payments.unshift(payment); data.currentSubscription = { planKey: payment.planKey, status: "active", startedAt: started.toISOString(), renewsAt: end.toISOString() }; write(data); return data;
}
export function failPayment(payment: DemoPayment) { const data = read(); data.payments.unshift(payment); write(data); return data; }
export function cancelSubscription() { const data = read(); if (data.currentSubscription) data.currentSubscription.status = "cancelled"; write(data); return data; }
export function reset() { const data: DemoBilling = { currentSubscription: null, payments: [], coupon: null }; write(data); return data; }
export function useDemoBilling() {
  const [billing, setBilling] = React.useState<DemoBilling>(memory);
  React.useEffect(() => { setBilling(getBilling()); const sync = () => setBilling(getBilling()); window.addEventListener("storage", sync); window.addEventListener("demo-billing-change", sync); return () => { window.removeEventListener("storage", sync); window.removeEventListener("demo-billing-change", sync); }; }, []);
  return { billing, refresh: () => { const value = getBilling(); window.dispatchEvent(new Event("demo-billing-change")); setBilling(value); } };
}
import * as React from "react";
export function applyCoupon(code: string, price: number) { const normalized = code.trim().toUpperCase(); const rate = normalized === "LEARN50" ? .5 : normalized === "WELCOME10" ? .1 : 0; const discount = Math.round(price * rate); const tax = Math.round((price - discount) * .18); return { valid: rate > 0, discount, tax, total: price - discount + tax }; }
export function isLuhnValid(value: string) { const digits = value.replace(/\D/g, ""); if (digits.length < 12 || digits.length > 19) return false; let sum = 0; for (let i = digits.length - 1, parity = 0; i >= 0; i--, parity++) { let n = Number(digits[i]); if (parity % 2) { n *= 2; if (n > 9) n -= 9; } sum += n; } return sum % 10 === 0; }
export function isFutureExpiry(value: string) { const match = /^(\d{2})\/(\d{2})$/.exec(value); if (!match) return false; const month = Number(match[1]); const year = 2000 + Number(match[2]); if (month < 1 || month > 12) return false; const end = new Date(year, month, 0, 23, 59, 59); return end.getTime() > Date.now(); }
