# Flask API reference

All endpoints are served by `backend/app.py` under `/api/learnhub/`. The Next.js frontend proxies its `/api/*` paths to this namespace.

- `GET /health`, `GET /categories`, `GET /courses`
- `POST /auth/password/register`, `POST /auth/password/login`, `POST /auth/logout`, `GET /auth/verify-role`, `POST /auth/role`
- `GET/PATCH /profile`
- `GET /student/courses`, `GET /student/courses/:slug`, `GET /student/lessons/:id`, `POST /student/progress`, `POST /student/tests/:id/submit`, `GET /student/checkout`, `POST /student/subscribe`, `POST /student/payments/verify`, `GET /student/billing`, `POST /student/subscription/cancel`, `GET/PATCH /student/notifications`, `GET/POST /student/certificate/:courseId`
- `GET/POST /instructor/courses`, `GET/PUT/PATCH/DELETE /instructor/courses/:id`, `GET /instructor/courses/:id/studio`, `POST /instructor/lessons`, `POST /instructor/lessons/:id/resources`, `POST /instructor/upload`
- `GET /admin/courses?status=pending_review`, `POST /admin/courses/:id/approve`, `POST /admin/courses/:id/reject`, `POST /admin/courses/:id/unpublish`
- `GET /admin/users`, `GET /admin/users/:id`, `POST /admin/users/:id/suspend`, `POST /admin/users/:id/reactivate`, `POST /admin/users/:id/delete`
- `GET /admin/instructor-applications`, `POST /admin/instructor-applications/:id/approve`, `POST /admin/instructor-applications/:id/reject`, `GET /admin/instructors`, `PATCH /admin/instructors/:id/verification`
- `GET/POST /admin/categories`, `PATCH/DELETE /admin/categories/:id`, `GET /admin/audit-logs`
- `GET/POST/PATCH /admin/plans`, `GET /admin/overview`, `GET /admin/analytics`, `GET /admin/payments`, `POST /admin/payments/:id/refund`, `GET /admin/payouts`, `POST /admin/payouts/:instructorId/mark-paid`, `GET/POST /admin/moderation`, `PATCH /admin/moderation/:id/resolve`
- `GET /instructor/earnings`
- `POST /webhooks/razorpay`

LearnHub uses an HttpOnly JWT cookie. Admin routes require the account email to match `ADMIN_EMAIL`.

## Payments

- `POST /student/subscribe` accepts only `{ "planKey": "monthly" | "yearly" }`. The amount and INR currency are read from the active plan record. The response includes the Razorpay order ID, amount in paise, currency, and public key ID.
- `POST /student/payments/verify` accepts Razorpay's order ID, payment ID, and checkout signature. It verifies ownership and HMAC before recording capture and subscription entitlement. The webhook provides idempotent server-to-server capture processing.
- `GET /student/billing` returns the current subscription, plan, entitlement, and recent payment history. `POST /student/subscription/cancel` schedules cancellation at period end.
- `GET /admin/payments?status=created|captured|failed|refund_pending|partially_refunded|refunded` lists payment records. `POST /admin/payments/:id/refund` requests a full refund and audits the action.
- `GET /admin/payouts` aggregates pending/paid instructor revenue-share estimates. `POST /admin/payouts/:instructorId/mark-paid` requires `{ "reference": "..." }` and records the manual transfer reference.
- `GET /instructor/earnings` returns the authenticated instructor's pending and paid estimated earnings.
- `POST /webhooks/razorpay` verifies the raw-body signature and deduplicates event IDs in `webhook_events`.
- `POST /instructor/upload/presign` creates a short-lived S3 PUT URL; direct browser uploads require the bucket CORS policy documented in `docs/uploads.md`.
- Login, register, admin register, and instructor requests are limited to five attempts per rolling 15 minutes per key. Login counters are per normalized email and IP; HTTP 429 includes `retry_after` seconds.

All monetary amounts use the existing `amount_cents` field, stored in paise.

## Course approval workflow

Instructor course status moves from `draft` to `pending_review`; only an administrator can move a pending course to `published`. Administrators can reject a submission with a required 10-1000 character reason or unpublish a published course (`unpublished`). Instructors can withdraw a pending course to `draft` before editing and resubmitting it.

- `GET /admin/courses?status=pending_review` lists courses for review. The optional status filter accepts `draft`, `pending_review`, `published`, `rejected`, `unpublished`, or `archived`.
- `POST /admin/courses/:id/approve` publishes a pending course and notifies its instructor.
- `POST /admin/courses/:id/reject` requires JSON `{ "reason": "..." }`, saves the rejection reason, and notifies its instructor.
- `POST /admin/courses/:id/unpublish` removes a published course from student-facing catalog and lesson routes.
- `PATCH /instructor/courses/:id` accepts `status: "draft"` or `status: "pending_review"` only. A pending-review submission must have a title, description, configured price, and at least one lesson.

Course decision notifications are stored in `notifications`. Optional email delivery uses SMTP when `SMTP_HOST` and `EMAIL_FROM` are configured; optional credentials are `SMTP_USERNAME` and `SMTP_PASSWORD`, and `SMTP_PORT` defaults to 587.

## Admin operations

All `/admin/*` API routes require an authenticated admin account whose email matches `ADMIN_EMAIL`.

- `GET /admin/users` supports `search`, `role`, `status`, `page`, and `limit` (maximum 100). `GET /admin/users/:id` returns profile, recent subscriptions, enrollments with courses, and payment history.
- `POST /admin/users/:id/suspend` and `/reactivate` change account status; `POST /admin/users/:id/delete` performs a soft delete. Suspended and deleted accounts cannot log in or use existing JWTs. An admin cannot change their own status or suspend/delete the last active admin.
- `GET /admin/instructor-applications?status=pending` lists applications. Approve promotes the applicant to instructor, sets `verified_badge` and `status: approved`, and notifies the applicant. Reject requires a 10-1000 character reason. `PATCH /admin/instructors/:id/verification` accepts only `{ "verified_badge": boolean }`.
- `GET /admin/instructors` lists instructors and current verification state so admins can manage badges even when an instructor has no application record.
- `GET/POST /admin/categories` lists and creates categories. `PATCH/DELETE /admin/categories/:id` updates or deletes one. Slugs are unique; deletion is blocked while any course references the category. Course authoring selects an active category.
- `GET /admin/audit-logs` supports `page`, `limit`, `action`, and `target_type`.
- Moderation flags link to a course, lesson, or user. Resolve accepts `{ "status": "resolved" | "dismissed", "unpublishCourse": boolean }`; `unpublishCourse: true` is allowed only for a resolved course flag and unpublishes a currently published course.

Admin mutations are recorded in `audit_logs` with actor, action, target, metadata, and timestamp. Notifications are stored in `notifications`.
