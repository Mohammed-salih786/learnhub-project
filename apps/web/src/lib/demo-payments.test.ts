import { beforeEach, describe, expect, it } from "vitest";
import { applyCoupon, cancelSubscription, completePayment, failPayment, getBilling, isFutureExpiry, isLuhnValid, reset, type DemoPayment } from "./demo-payments";
const payment: DemoPayment = { id: "demo_test", planKey: "monthly", amount: 590, method: "Card", last4: "1111", status: "success", createdAt: new Date().toISOString(), invoiceNo: "LH-DEMO-1", subtotal: 1000, discount: 500, tax: 90 };
describe("demo checkout helpers and store", () => {
 beforeEach(() => reset());
 it("validates Luhn card numbers", () => { expect(isLuhnValid("4111 1111 1111 1111")).toBe(true); expect(isLuhnValid("4000 0000 0000 0002")).toBe(true); expect(isLuhnValid("4111 1111 1111 1112")).toBe(false); });
 it("checks future card expiry", () => { const future = new Date(); future.setFullYear(future.getFullYear()+2); expect(isFutureExpiry(`${String(future.getMonth()+1).padStart(2,"0")}/${String(future.getFullYear()).slice(-2)}`)).toBe(true); expect(isFutureExpiry("13/30")).toBe(false); });
 it("calculates coupon and GST", () => { expect(applyCoupon("LEARN50",1000)).toEqual({valid:true,discount:500,tax:90,total:590}); expect(applyCoupon("WELCOME10",1000).total).toBe(1062); expect(applyCoupon("bad",1000).valid).toBe(false); });
 it("activates only success, keeps failed attempts from changing the subscription, and cancels", () => { completePayment(payment); const renewsAt = getBilling().currentSubscription?.renewsAt; failPayment({...payment,id:"demo_fail",status:"failed"}); expect(getBilling().currentSubscription?.status).toBe("active"); expect(getBilling().currentSubscription?.renewsAt).toBe(renewsAt); cancelSubscription(); expect(getBilling().currentSubscription?.status).toBe("cancelled"); });
 it("resets demo state", () => { completePayment(payment); reset(); expect(getBilling()).toEqual({currentSubscription:null,payments:[],coupon:null}); });
});
