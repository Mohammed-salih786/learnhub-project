# Demo payments

All checkout activity is simulated in the browser. No gateway, backend route, or real card collection is used. Demo mode is labeled on checkout, billing, and invoice screens.

## Coupons

- `LEARN50`: 50% off
- `WELCOME10`: 10% off
- GST is 18% after the coupon discount.

## Test values

- Card `4111 1111 1111 1111`: success
- Card `4000 0000 0000 0002`: declined
- Use any future `MM/YY` expiry and any three digit CVV.
- UPI `success@demo`: success
- UPI `fail@demo`: failure
- 

Card numbers are held only in component memory during checkout. The store persists payment method and last four digits only. Billing data uses `localStorage` with an in-memory fallback; clearing browser data resets it.

## Flow

Choose a monthly or yearly plan, optionally apply a coupon, then use the payment modal. Successful payments activate the local demo subscription and create a printable invoice. Failed attempts are recorded and leave the subscription unchanged. Billing lets you cancel or reset the demo state.

## Replacing this demo later

Delete or replace `apps/web/src/lib/demo-payments.ts`, `apps/web/src/lib/use-entitlement.ts`, the checkout and billing pages, and `apps/web/src/app/student/billing/invoice/[id]/page.tsx`. Remove the demo plan badge in `apps/web/src/components/layout/student-shell.tsx`. Add the real provider client and verified server API flow, then connect `useEntitlement` to the server entitlement. Keep the demo invoice route out of production billing.

