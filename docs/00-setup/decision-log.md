# LearnHub — Decision Log

This log records the implementation assumptions needed to move from product definition into build, while keeping the product lean and launch-safe for India-only delivery.

## 1) Brand and domain

- Brand: LearnHub
- Domain recommendation: `learnhub.in`
- Reasoning: simple, memorable, India-first, and aligned with a portable education brand
- Fallback: if the legal owner prefers a different domain, the product should use the approved brand name and the equivalent `.in` or `.co.in` variant only after final domains are registered and verified
- Assumption: early marketing will use the product name and direct app domain, not a more complex sub-branded naming scheme

## 2) Legal entity for Razorpay KYC

- Decision: the merchant account must be registered under the actual business entity that owns the platform and will receive payouts
- Lean default: use the registered company/LLP name that is approved for business operations in India; the platform should not be launched under an informal personal account if a formal entity is required for compliance
- Assumption: at launch, we will use the legal entity that is already in place for the business or is being formed before KYC submission

## 3) GST and tax-inclusive pricing

- Decision: all public pricing will be GST-inclusive and clearly marked as India pricing
- Pricing model:
  - Trial: 7-day free trial, no card required, 2 free courses included, limited test attempts
  - Monthly: ₹149/month
  - Yearly: ₹999/year
  - Yearly plan includes certificates and priority support
- Reasoning: simple, transparent, and compliant with Indian subscription pricing expectations
- Notes: when invoicing or receipts are generated, the platform should ensure the GST-inclusive display remains consistent with the underlying accounting records

## 4) Revenue-share model and pool definition

- Decision: revenue share is calculated from net subscription revenue after Razorpay fees and GST are removed from the subscription income pool
- Standard working model:
  - LearnHub revenue share: 20%
  - Instructor share: 80%
- Pool definition:
  - `Revenue pool = net subscription revenue attributable to paid students after payment gateway fees and tax adjustments`
  - `Instructor earnings estimate = (instructor watch-minutes / total watch-minutes) × revenue pool × instructor share %`
- Labeling: the dashboard and instructor UX must label this as an estimate only; it is not a guaranteed payout amount
- Assumption: manual payout operations remain out of scope for this phase; only estimates and export reporting are included

## 5) Refund policy

- Decision: refund policy is intentionally strict but consumer-friendly
- Policy:
  - 7-day free trial is non-chargeable and requires no card
  - Paid plans are generally non-refundable after activation unless there is a gateway error, duplicate charge, fraud, or a legal requirement to refund
  - Students must be able to request support via email or in-app support flow; admin may approve exceptions manually
- Reasoning: this reduces operational complexity while protecting the platform against churn abuse and refund fraud

## 6) Instructor content policy

- Decision: instructors may publish only original content or content they have lawful rights to distribute
- Required rules:
  - no copyrighted videos, PDFs, or test banks without authorization
  - no abusive, discriminatory, hateful, or harmful content
  - no misleading claims or impersonation of institutional brands
  - no sexual, explicit, or unsafe content
  - all content must be explained clearly and be suitable for the public marketplace
- Moderation approach:
  - instructor uploads are subject to admin review before final publication for the first cohort of creators
  - repeat violations trigger course blocking and account review

## 7) The 2 free courses

- Decision: every eligible student on a free trial receives access to 2 free courses total, not 2 per day or 2 per month
- Rules:
  - the free trial grants up to 2 course enrollments across the platform within the trial period
  - once consumed, a student must subscribe to continue access
  - if the student subscribes after the free trial, the trial benefits are not renewable
- Reasoning: this preserves the cost-control and retention objective while giving students enough initial value to validate the platform

## 8) Key launch assumptions

- India-only launch for now
- Mobile-first experience is the priority; app UX should be optimized for phones before desktop polish
- Lean MVP is preferred over feature completeness
- There is no in-app live class or chat feature in scope
- Instructor payout automation is intentionally out of scope; payouts are manual and reporting is admin-only
- The project is designed for future mobile app reuse via a shared package layer, but the initial production launch is web-only

## 9) Immediate decision blockers

The following items must be confirmed before the engineering build begins in earnest:

- final brand and domain ownership
- final legal entity and KYC identity used for Razorpay
- final GST and invoice structure
- approved subscription pricing and tax-inclusive display
- final routing of OTP provider and DLT registration ownership
- final choice between MSG91 and Twilio
- approved support and refund workflow

Once these are confirmed, Phase 1 can proceed with the monorepo and design system setup.
